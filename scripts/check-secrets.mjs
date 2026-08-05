#!/usr/bin/env node

/**
 * Git Secrets Detection Script
 * Scans for secrets, API keys, tokens and other credential shapes.
 *
 * Two modes: the staged diff by default, which is what the pre-commit hook wants, and
 * every tracked file with `--all`, which is what CI needs — after `actions/checkout` the
 * index equals HEAD, so the default mode inspects nothing at all there.
 *
 * Exit policy: CRITICAL and HIGH block the commit, MEDIUM is reported only. MEDIUM
 * patterns are heuristics (entropy, shapes that merely resemble a key) and blocking on
 * them teaches everyone to reach for `--no-verify`, which costs more than it saves.
 *
 * Escape hatch: append `secrets-check:ignore` to a line to exempt it.
 */

import { execFileSync } from 'child_process';
import { existsSync, readFileSync } from 'fs';

/** Lines carrying this marker are never reported. */
const INLINE_IGNORE = 'secrets-check:ignore';

/** Severities that fail the run. */
const BLOCKING_SEVERITIES = new Set(['CRITICAL', 'HIGH']);

// ANSI colors for terminal output
const colors = {
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  cyan: '\x1b[36m',
  reset: '\x1b[0m',
  bold: '\x1b[1m'
};

// Files and paths to skip (legitimate uses of secret-like patterns)
//
// `.github/workflows` is deliberately NOT here any more. It was, and it made the whole
// exercise circular: those files are the only tracked place that names `CLOUDFLARE_API_TOKEN`
// (`.env` is gitignored), so the HIGH `Generic Token` pattern — which carries a comment
// explaining it was fixed specifically to catch that name — could never run against the one
// file it was fixed for. A token pasted in place of `${{ secrets.… }}` to unblock a deploy
// passed both the pre-commit hook and the `Secrets Detection` job, itself a `needs:` of all
// three deployments. `${{ secrets.X }}` does not false-positive: `$` and `{` fall outside the
// `[a-zA-Z0-9_\-]` character class every value pattern uses.
const SKIP_PATTERNS = [
  /pnpm-lock\.yaml$/,
  /package-lock\.json$/,
  /yarn\.lock$/,
  /\.lock$/,
  /scripts\/check-secrets\.mjs$/, // This file contains secret patterns as examples
  /node_modules/,
  /\.git\//,
  // Vendored, minified third-party code. The Draco decoder alone trips the MEDIUM entropy
  // heuristic 16 times on every run, and a wall of constant false positives is the one way
  // a non-blocking scanner fails: the real MEDIUM, when it comes, scrolls past unread.
  /(^|\/)public\/assets\/models\/draco\//,
  // Anchored to a path segment. Unanchored, `/out\//` also matched `src/components/
  // layout/`, `/build\//` matched `src/rebuild/`, and `/out\//` matched `src/checkout/` —
  // so a secret pasted into a `layout/` directory, which every Next project grows within
  // a fortnight, was skipped in silence.
  /(^|\/)dist\//,
  /(^|\/)build\//,
  /(^|\/)out\//,
  /(^|\/)coverage\//
];

// Comprehensive secret patterns
// Each pattern has: regex, name, and severity
const SECRET_PATTERNS = [
  // Generic API Keys & Secrets
  {
    name: 'Generic API Key',
    pattern: /\b(api[_-]?key|apikey)\s*[:=]\s*['"]?([a-zA-Z0-9_\-]{20,})['"]?/i,
    severity: 'HIGH'
  },
  {
    name: 'Generic Secret Key',
    pattern: /\b(secret[_-]?key|secretkey)\s*[:=]\s*['"]?([a-zA-Z0-9_\-]{20,})['"]?/i,
    severity: 'HIGH'
  },
  {
    name: 'Generic Token',
    // No leading `\b`, and `api` in the alternation: an underscore is a word character,
    // so `\bapi` cannot match the `API` in `CLOUDFLARE_API_TOKEN` — the most damaging
    // credential this project holds. It used to reach only the MEDIUM entropy
    // heuristic, which does not block a commit.
    pattern: /(access|auth|api|bearer|refresh|session)[_-]?token\s*[:=]\s*['"]?([a-zA-Z0-9_\-\.]{20,})['"]?/i,
    severity: 'HIGH'
  },

  // AWS Credentials
  {
    name: 'AWS Access Key ID',
    pattern: /\b(AKIA[0-9A-Z]{16})\b/,
    severity: 'CRITICAL'
  },
  {
    name: 'AWS Secret Access Key',
    pattern: /\baws[_-]?secret[_-]?access[_-]?key\s*[:=]\s*['"]?([a-zA-Z0-9/+=]{40})['"]?/i,
    severity: 'CRITICAL'
  },
  {
    name: 'AWS Session Token',
    pattern: /\baws[_-]?session[_-]?token\s*[:=]\s*['"]?([a-zA-Z0-9/+=]{100,})['"]?/i,
    severity: 'HIGH'
  },

  // GitHub Tokens
  {
    name: 'GitHub Personal Access Token',
    pattern: /\bghp_[a-zA-Z0-9]{36,}\b/,
    severity: 'CRITICAL'
  },
  {
    name: 'GitHub OAuth Token',
    pattern: /\bgho_[a-zA-Z0-9]{36,}\b/,
    severity: 'CRITICAL'
  },
  {
    name: 'GitHub App Token',
    pattern: /\bghs_[a-zA-Z0-9]{36,}\b/,
    severity: 'CRITICAL'
  },
  {
    name: 'GitHub Refresh Token',
    pattern: /\bghr_[a-zA-Z0-9]{36,}\b/,
    severity: 'CRITICAL'
  },

  // GitLab Tokens
  {
    name: 'GitLab Personal Access Token',
    pattern: /\bglpat-[a-zA-Z0-9_\-]{20,}\b/,
    severity: 'CRITICAL'
  },

  // Slack Tokens
  {
    name: 'Slack Token',
    pattern: /\bxox[baprs]-[a-zA-Z0-9\-]{10,}\b/,
    severity: 'HIGH'
  },
  {
    name: 'Slack Webhook',
    pattern: /https:\/\/hooks\.slack\.com\/services\/T[a-zA-Z0-9_]+\/B[a-zA-Z0-9_]+\/[a-zA-Z0-9_]+/,
    severity: 'HIGH'
  },

  // SSH & Private Keys
  {
    name: 'Private SSH Key',
    pattern: /-----BEGIN (RSA|DSA|EC|OPENSSH) PRIVATE KEY-----/,
    severity: 'CRITICAL'
  },
  {
    name: 'PGP Private Key',
    pattern: /-----BEGIN PGP PRIVATE KEY BLOCK-----/,
    severity: 'CRITICAL'
  },

  // Google Cloud
  {
    name: 'Google API Key',
    pattern: /\bAIza[a-zA-Z0-9_\-]{35}\b/,
    severity: 'HIGH'
  },
  {
    name: 'Google OAuth Token',
    pattern: /\b[0-9]+-[a-zA-Z0-9_]{32}\.apps\.googleusercontent\.com\b/,
    severity: 'HIGH'
  },
  {
    name: 'Google Cloud Service Account',
    pattern: /"type":\s*"service_account"/,
    severity: 'CRITICAL'
  },

  // Stripe
  {
    name: 'Stripe API Key',
    pattern: /\b(sk|pk)_(test|live)_[a-zA-Z0-9]{24,}\b/,
    severity: 'CRITICAL'
  },

  // Twilio
  {
    name: 'Twilio API Key',
    pattern: /\bSK[a-z0-9]{32}\b/,
    severity: 'HIGH'
  },

  // Database Connection Strings
  {
    name: 'Database Connection String with Password',
    pattern: /(mysql|postgres|mongodb|redis):\/\/[^:]+:([^@\s]+)@/i,
    severity: 'CRITICAL'
  },
  {
    name: 'JDBC Connection String',
    pattern: /jdbc:[a-z]+:\/\/[^:]+:([^@\s]+)@/i,
    severity: 'CRITICAL'
  },

  // JWT Tokens
  {
    name: 'JWT Token',
    pattern: /\beyJ[a-zA-Z0-9_\-]*\.eyJ[a-zA-Z0-9_\-]*\.[a-zA-Z0-9_\-]+\b/,
    severity: 'HIGH'
  },

  // Generic Passwords
  {
    name: 'Password Assignment',
    pattern: /\b(password|passwd|pwd)\s*[:=]\s*['"]([^'"]{8,})['"](?!\s*\$)/i,
    severity: 'HIGH'
  },

  // NPM Tokens
  {
    name: 'NPM Access Token',
    pattern: /\bnpm_[a-zA-Z0-9]{36,}\b/,
    severity: 'HIGH'
  },

  // PyPI Tokens
  {
    name: 'PyPI Token',
    pattern: /\bpypi-AgEIcHlwaS5vcmc[a-zA-Z0-9_\-]+\b/,
    severity: 'HIGH'
  },

  // Docker Hub
  {
    name: 'Docker Hub Token',
    pattern: /\bdckr_pat_[a-zA-Z0-9_\-]{28,}\b/,
    severity: 'HIGH'
  },

  // Heroku
  // Requires the key name next to it on purpose: the previous version was a bare UUID
  // regex, so every uuid() in the codebase tripped it and blocked the commit.
  {
    name: 'Heroku API Key',
    pattern:
      /\bheroku[_-]?(api[_-]?)?key\s*[:=]\s*['"]?([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})/i,
    severity: 'HIGH'
  },

  // SendGrid
  {
    name: 'SendGrid API Key',
    pattern: /\bSG\.[a-zA-Z0-9_\-]{22}\.[a-zA-Z0-9_\-]{43}\b/,
    severity: 'HIGH'
  },

  // Mailgun
  {
    name: 'Mailgun API Key',
    pattern: /\bkey-[a-zA-Z0-9]{32}\b/,
    severity: 'HIGH'
  },

  // Firebase
  {
    name: 'Firebase API Key',
    pattern: /\bAIza[a-zA-Z0-9_\-]{35}\b/,
    severity: 'HIGH'
  },

  // Azure
  {
    name: 'Azure Storage Key',
    pattern: /\bDefaultEndpointsProtocol=https;AccountName=[^;]+;AccountKey=([a-zA-Z0-9+/=]{88})/,
    severity: 'CRITICAL'
  },

  // Generic Bearer Tokens
  {
    name: 'Bearer Token',
    pattern: /\bBearer\s+[a-zA-Z0-9_\-\.]{20,}\b/,
    severity: 'HIGH'
  },

  // OAuth Client Secrets
  {
    name: 'OAuth Client Secret',
    pattern: /\bclient[_-]?secret\s*[:=]\s*['"]?([a-zA-Z0-9_\-]{20,})['"]?/i,
    severity: 'CRITICAL'
  },

  // Generic high entropy strings (potential secrets)
  {
    name: 'High Entropy String',
    pattern: /['"][a-zA-Z0-9_\-]{40,}['"]/,
    severity: 'MEDIUM',
    validate: (match) => {
      // Calculate entropy to reduce false positives
      const entropy = calculateEntropy(match);
      return entropy > 4.5; // High entropy threshold
    }
  }
];

/**
 * Calculate Shannon entropy of a string
 * Higher entropy = more random/complex = likely a secret
 */
function calculateEntropy(str) {
  const len = str.length;
  const frequencies = {};

  for (const char of str) {
    frequencies[char] = (frequencies[char] || 0) + 1;
  }

  return Object.values(frequencies).reduce((entropy, freq) => {
    const p = freq / len;
    return entropy - p * Math.log2(p);
  }, 0);
}

/**
 * Check if file should be skipped
 */
function shouldSkipFile(filePath) {
  return SKIP_PATTERNS.some((pattern) => pattern.test(filePath));
}

/**
 * Get list of staged files
 */
function getStagedFiles() {
  try {
    const output = execFileSync('git', ['diff', '--cached', '--name-only', '--diff-filter=ACM'], {
      encoding: 'utf-8'
    });
    return output
      .trim()
      .split('\n')
      .filter((f) => f.length > 0);
  } catch (error) {
    console.error(`${colors.red}Error getting staged files:${colors.reset}`, error.message);
    return [];
  }
}

/**
 * Every file git tracks — the input for `--all`.
 *
 * `-z` because a filename may legitimately contain a newline, which would otherwise
 * split one path into two unscannable ones.
 */
function getTrackedFiles() {
  try {
    const output = execFileSync('git', ['ls-files', '-z'], { encoding: 'utf-8' });
    return output.split('\0').filter((f) => f.length > 0);
  } catch (error) {
    console.error(`${colors.red}Error listing tracked files:${colors.reset}`, error.message);
    return [];
  }
}

/**
 * Get diff content for a file
 */
function getFileDiff(filePath) {
  try {
    return execFileSync('git', ['diff', '--cached', '--', filePath], {
      encoding: 'utf-8'
    });
  } catch (error) {
    return '';
  }
}

/**
 * A whole file, read as-is.
 *
 * It used to be reshaped into a diff of pure additions — one `+` per line — so that
 * `scanFile` had a single input format. That silently dropped every source line starting
 * with `++`: prefixed, `++counter;` becomes `+++counter;`, which the added-lines filter
 * discards as a diff header. `scanFile` takes the mode instead.
 */
function getFileContent(filePath) {
  try {
    return readFileSync(filePath, 'utf-8');
  } catch {
    return '';
  }
}

/**
 * Add the global flag while preserving the ones the pattern already declares.
 *
 * `new RegExp(pattern, 'g')` REPLACES the flag set instead of extending it, so it
 * silently stripped `/i` from the ten case-insensitive patterns above. The effect was
 * that `API_KEY=`, `PASSWORD=`, `CLIENT_SECRET=` and friends in upper case — the single
 * most common shape of a real leak — went undetected.
 */
function withGlobalFlag(pattern) {
  const flags = pattern.flags.includes('g') ? pattern.flags : `${pattern.flags}g`;
  return new RegExp(pattern.source, flags);
}

/**
 * @param filePath path reported in the findings
 * @param source   a `git diff` in staged mode, the raw file in `--all` mode
 * @param isDiff   whether `source` is a diff — only then is there anything to filter
 */
function scanFile(filePath, source, { isDiff } = { isDiff: true }) {
  const findings = [];

  // In diff mode, only added lines are interesting: `+++ b/path` is the header, not a
  // change. Whole files carry no such markers, so filtering them would drop real code.
  // The inline escape hatch applies in both modes.
  const scannedLines = source
    .split('\n')
    .filter((line) => !isDiff || (line.startsWith('+') && !line.startsWith('+++ ')))
    .filter((line) => !line.includes(INLINE_IGNORE));

  if (scannedLines.length === 0) return findings;

  const content = scannedLines.join('\n');

  for (const { name, pattern, severity, validate } of SECRET_PATTERNS) {
    const matches = content.matchAll(withGlobalFlag(pattern));

    for (const match of matches) {
      if (validate && !validate(match[0])) {
        continue;
      }

      findings.push({
        file: filePath,
        pattern: name,
        severity,
        match: match[0],
        line: match.input
      });
    }
  }

  return findings;
}

/**
 * Main function
 */
function main() {
  /**
   * Two modes, because the default one is useless in CI.
   *
   * Staged mode reads `git diff --cached`. After `actions/checkout` the index equals
   * HEAD, so that list is empty and the job printed "no staged files" and exited 0 —
   * a named gate, a dependency of every deploy, that had never inspected a byte. It is
   * still the right mode for the pre-commit hook, where reviewing only what you are
   * about to add is the point.
   *
   * `--all` scans every tracked file instead. Use it in CI. Deliberately not
   * `--range base..HEAD`: that is empty on push events, which would reintroduce exactly
   * the silent pass being fixed here, and it needs a non-shallow clone.
   */
  const scanAll = process.argv.includes('--all');
  console.info(
    `${colors.cyan}🔐 Checking for secrets/tokens in ${scanAll ? 'all tracked files' : 'staged files'}...${colors.reset}\n`
  );

  const files = scanAll ? getTrackedFiles() : getStagedFiles();

  if (files.length === 0) {
    if (scanAll) {
      // Nothing tracked means `git ls-files` failed, not that the repository is clean.
      // Passing here would be the same silent-success bug in a new costume.
      console.error(`${colors.red}❌ --all found no tracked files — is this a git repository?${colors.reset}`);
      process.exit(1);
    }
    console.info(`${colors.green}✅ No staged files to check${colors.reset}`);
    process.exit(0);
  }

  let allFindings = [];

  for (const file of files) {
    if (shouldSkipFile(file)) {
      continue;
    }

    if (!existsSync(file)) {
      continue;
    }

    const source = scanAll ? getFileContent(file) : getFileDiff(file);
    if (!source) continue;

    const findings = scanFile(file, source, { isDiff: !scanAll });
    allFindings = allFindings.concat(findings);
  }

  // Group findings by severity
  const critical = allFindings.filter((f) => f.severity === 'CRITICAL');
  const high = allFindings.filter((f) => f.severity === 'HIGH');
  const medium = allFindings.filter((f) => f.severity === 'MEDIUM');

  if (allFindings.length > 0) {
    console.info(`${colors.red}${colors.bold}❌ Potential secrets detected!${colors.reset}\n`);

    if (critical.length > 0) {
      console.info(`${colors.red}${colors.bold}🚨 CRITICAL (${critical.length}):${colors.reset}`);
      critical.forEach((f) => {
        console.info(`  ${colors.yellow}${f.file}${colors.reset}`);
        console.info(`    Type: ${f.pattern}`);
        console.info(`    Match: ${colors.red}${f.match.substring(0, 100)}${colors.reset}`);
        console.info();
      });
    }

    if (high.length > 0) {
      console.info(`${colors.yellow}${colors.bold}⚠️  HIGH (${high.length}):${colors.reset}`);
      high.forEach((f) => {
        console.info(`  ${colors.yellow}${f.file}${colors.reset}`);
        console.info(`    Type: ${f.pattern}`);
        console.info(`    Match: ${colors.yellow}${f.match.substring(0, 100)}${colors.reset}`);
        console.info();
      });
    }

    if (medium.length > 0) {
      console.info(`${colors.cyan}ℹ️  MEDIUM (${medium.length}):${colors.reset}`);
      medium.forEach((f) => {
        console.info(`  ${colors.cyan}${f.file}${colors.reset}`);
        console.info(`    Type: ${f.pattern}`);
        console.info();
      });
    }

    const blocking = allFindings.filter((f) => BLOCKING_SEVERITIES.has(f.severity));

    if (blocking.length === 0) {
      console.info(
        `${colors.cyan}Only MEDIUM heuristics matched — not blocking the commit.${colors.reset}\n` +
          `${colors.cyan}Review them anyway; append \`${INLINE_IGNORE}\` to a line to silence it.${colors.reset}\n`
      );
      process.exit(0);
    }

    console.info(
      `${colors.red}${colors.bold}Please review and remove sensitive data before committing.${colors.reset}`
    );
    console.info(
      `${colors.yellow}False positive? Append \`${INLINE_IGNORE}\` to the line, or add the file to${colors.reset}\n` +
        `${colors.yellow}SKIP_PATTERNS in scripts/check-secrets.mjs.${colors.reset}\n`
    );

    process.exit(1);
  }

  console.info(`${colors.green}✅ No secrets detected (scanned ${files.length} files)${colors.reset}\n`);
  process.exit(0);
}

main();
