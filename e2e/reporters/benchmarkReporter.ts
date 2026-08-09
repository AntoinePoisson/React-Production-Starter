import fs from 'node:fs';
import path from 'node:path';

import type { FullConfig, FullResult, Reporter, Suite, TestCase, TestResult } from '@playwright/test/reporter';

/** Payload of a benchmark: attachment written by testInfo.attach() in a spec. */
interface BenchmarkAttachment {
  name: string;
  unit: string;
  value: number;
  direction: 'smaller' | 'bigger';
}

/**
 * Output format expected by github-action-benchmark.
 * @see https://github.com/benchmark-action/github-action-benchmark
 */
interface BenchmarkEntry {
  name: string;
  unit: string;
  value: number;
  extra?: string;
}

interface MetricAccumulator {
  unit: string;
  direction: 'smaller' | 'bigger';
  values: number[];
  source: string; // "test title / suite title", from the first occurrence
}

const OUTPUT_DIR = 'reports/benchmark';
const ATTACHMENT_CONTENT_TYPE = 'application/json';
const ATTACHMENT_NAME_PREFIX = 'benchmark:';

function median(sorted: number[]): number {
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 !== 0 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
}

function variance(values: number[], mean: number): number {
  const sumSquaredDiffs = values.reduce((acc, v) => acc + (v - mean) ** 2, 0);
  return sumSquaredDiffs / values.length;
}

/**
 * Collects benchmark: attachments from passed tests into benchmark-{smaller,bigger}.json for
 * github-action-benchmark. Repeated values for one metric (--repeat-each) collapse to their
 * median, with the spread in `extra`. Enable with BENCHMARK=true.
 */
class BenchmarkReporter implements Reporter {
  private metrics: Map<string, MetricAccumulator> = new Map();

  onBegin(_config: FullConfig, _suite: Suite) {
    this.metrics = new Map();
  }

  onTestEnd(test: TestCase, result: TestResult) {
    // Failed results are unreliable.
    if (result.status !== 'passed') return;

    for (const attachment of result.attachments) {
      if (!attachment.name.startsWith(ATTACHMENT_NAME_PREFIX)) continue;
      if (attachment.contentType !== ATTACHMENT_CONTENT_TYPE) continue;
      if (!attachment.body) continue;

      let data: BenchmarkAttachment;
      try {
        data = JSON.parse(attachment.body.toString('utf-8'));
      } catch {
        continue;
      }

      if (!data.name || typeof data.value !== 'number' || !isFinite(data.value) || !data.unit || !data.direction)
        continue;

      const existing = this.metrics.get(data.name);
      if (existing) {
        existing.values.push(data.value);
      } else {
        this.metrics.set(data.name, {
          unit: data.unit,
          direction: data.direction,
          values: [data.value],
          source: `${test.title} / ${test.parent.title}`
        });
      }
    }
  }

  onEnd(_result: FullResult) {
    const smaller: BenchmarkEntry[] = [];
    const bigger: BenchmarkEntry[] = [];

    for (const [name, metric] of this.metrics) {
      const sorted = [...metric.values].sort((a, b) => a - b);
      const med = median(sorted);
      const mean = metric.values.reduce((a, b) => a + b, 0) / metric.values.length;
      const v = variance(metric.values, mean);
      const stddev = Math.sqrt(v);

      const entry: BenchmarkEntry = {
        name,
        unit: metric.unit,
        value: Math.round(med * 100) / 100,
        extra:
          sorted.length > 1
            ? `${metric.source} | median of ${sorted.length} runs [${sorted.map((v) => Math.round(v * 100) / 100).join(', ')}] σ=${Math.round(stddev * 100) / 100}`
            : metric.source
      };

      if (metric.direction === 'smaller') {
        smaller.push(entry);
      } else {
        bigger.push(entry);
      }
    }

    fs.mkdirSync(path.resolve(OUTPUT_DIR), { recursive: true });

    if (smaller.length > 0) {
      fs.writeFileSync(path.resolve(OUTPUT_DIR, 'benchmark-smaller.json'), JSON.stringify(smaller, null, 2));
    }

    if (bigger.length > 0) {
      fs.writeFileSync(path.resolve(OUTPUT_DIR, 'benchmark-bigger.json'), JSON.stringify(bigger, null, 2));
    }

    const total = smaller.length + bigger.length;
    if (total > 0) {
      const runs = this.metrics.values().next().value?.values.length ?? 1;
      console.info(
        `[benchmark] Wrote ${smaller.length} smaller-is-better + ${bigger.length} bigger-is-better metrics (median of ${runs} runs) to ${OUTPUT_DIR}/`
      );
    }
  }
}

/**
 * Instantiated by Playwright from playwright.config.ts, never imported by hand. Tagged to keep
 * knip's includeEntryExports quiet.
 *
 * @public
 */
export default BenchmarkReporter;
