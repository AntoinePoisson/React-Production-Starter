#!/usr/bin/env node

/**
 * Scans for secrets, API keys, tokens and other credential shapes.
 *
 * Staged diff by default (the pre-commit hook), every tracked file with --all (CI, where the
 * index equals HEAD after checkout so the default mode would inspect nothing).
 *
 * CRITICAL and HIGH block the commit, MEDIUM is reported only. Append `secrets-check:ignore` to
 * a line to exempt it.
 */

import { execFileSync } from 'child_process';
import { existsSync, readFileSync } from 'fs';

/** Lines carrying this marker are never reported. */
const INLINE_IGNORE = 'secrets-check:ignore';

/** Severities that fail the run. */
const BLOCKING_SEVERITIES = new Set(['CRITICAL', 'HIGH']);

const colors = {
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  cyan: '\x1b[36m',
  reset: '\x1b[0m',
  bold: '\x1b[1m'
};

// Files to skip. Note that .github/workflows is NOT in here: those files are the only tracked
// place that names a CI token, so skipping them would make the Generic Token pattern useless.
// ${{ secrets.X }} doesn't false-positive, $ and { are outside the character class the value
// patterns use.
const SKIP_PATTERNS = [
  /pnpm-lock\.yaml$/,
  /package-lock\.json$/,
  /yarn\.lock$/,
  /\.lock$/,
  /scripts\/check-secrets\.mjs$/, // this file holds the patterns themselves
  /node_modules/,
  /\.git\//,
  // Vendored minified code. The Draco decoder alone trips the entropy heuristic 16 times per
  // run, and a wall of false positives is how a non-blocking scanner ends up ignored.
  /(^|\/)public\/assets\/models\/draco\//,
  // Anchored to a path segment. Unanchored, /out\// also matched src/checkout/ and /build\//
  // matched src/rebuild/, so a secret in one of those was skipped silently.
  /(^|\/)dist\//,
  /(^|\/)build\//,
  /(^|\/)out\//,
  /(^|\/)coverage\//
];

const SECRET_PATTERNS = [
  // Generic API Keys & Secrets
  {
    name: 'Generic API Key',
    pattern: /\b(api[_-]?key|apikey)\s*[:=]\s*['"]?([a-zA-Z0-9_-]{20,})['"]?/i,
    severity: 'HIGH'
  },
  {
    name: 'Generic Secret Key',
    pattern: /\b(secret[_-]?key|secretkey)\s*[:=]\s*['"]?([a-zA-Z0-9_-]{20,})['"]?/i,
    severity: 'HIGH'
  },
  {
    name: 'Generic Token',
    // No leading \b, and `api` in the alternation. An underscore is a word character, so \bapi
    // can't match the API in CLOUDFLARE_API_TOKEN, which only ever reached the MEDIUM entropy
    // heuristic and therefore never blocked a commit.
    pattern: /(access|auth|api|bearer|refresh|session)[_-]?token\s*[:=]\s*['"]?([a-zA-Z0-9_.-]{20,})['"]?/i,
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
    pattern: /\bglpat-[a-zA-Z0-9_-]{20,}\b/,
    severity: 'CRITICAL'
  },

  // Slack Tokens
  {
    name: 'Slack Token',
    pattern: /\bxox[baprs]-[a-zA-Z0-9-]{10,}\b/,
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
    pattern: /\bAIza[a-zA-Z0-9_-]{35}\b/,
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
    pattern: /\beyJ[a-zA-Z0-9_-]*\.eyJ[a-zA-Z0-9_-]*\.[a-zA-Z0-9_-]+\b/,
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
    pattern: /\bpypi-AgEIcHlwaS5vcmc[a-zA-Z0-9_-]+\b/,
    severity: 'HIGH'
  },

  // Docker Hub
  {
    name: 'Docker Hub Token',
    pattern: /\bdckr_pat_[a-zA-Z0-9_-]{28,}\b/,
    severity: 'HIGH'
  },

  // Heroku. Needs the key name next to it: a bare UUID regex tripped on every uuid() in the
  // codebase and blocked the commit.
  {
    name: 'Heroku API Key',
    // safe-regex counts the nested `?` in `(api[_-]?)?` as a risk. Every quantifier here is
    // bounded and none of them overlap, so there is no input that backtracks.
    pattern:
      // eslint-disable-next-line security/detect-unsafe-regex
      /\bheroku[_-]?(api[_-]?)?key\s*[:=]\s*['"]?([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})/i,
    severity: 'HIGH'
  },

  // SendGrid
  {
    name: 'SendGrid API Key',
    pattern: /\bSG\.[a-zA-Z0-9_-]{22}\.[a-zA-Z0-9_-]{43}\b/,
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
    pattern: /\bAIza[a-zA-Z0-9_-]{35}\b/,
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
    pattern: /\bBearer\s+[a-zA-Z0-9_.-]{20,}\b/,
    severity: 'HIGH'
  },

  // OAuth Client Secrets
  {
    name: 'OAuth Client Secret',
    pattern: /\bclient[_-]?secret\s*[:=]\s*['"]?([a-zA-Z0-9_-]{20,})['"]?/i,
    severity: 'CRITICAL'
  },

  // Generic high entropy strings (potential secrets)
  {
    name: 'High Entropy String',
    pattern: /['"][a-zA-Z0-9_-]{40,}['"]/,
    severity: 'MEDIUM',
    validate: (match) => calculateEntropy(match) > 4.5
  }
];

/** Shannon entropy. Higher = more random = more likely a real secret. */
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

function shouldSkipFile(filePath) {
  return SKIP_PATTERNS.some((pattern) => pattern.test(filePath));
}

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

/** Input for --all. -z because a filename can legitimately contain a newline. */
function getTrackedFiles() {
  try {
    const output = execFileSync('git', ['ls-files', '-z'], { encoding: 'utf-8' });
    return output.split('\0').filter((f) => f.length > 0);
  } catch (error) {
    console.error(`${colors.red}Error listing tracked files:${colors.reset}`, error.message);
    return [];
  }
}

function getFileDiff(filePath) {
  try {
    return execFileSync('git', ['diff', '--cached', '--', filePath], {
      encoding: 'utf-8'
    });
  } catch {
    return '';
  }
}

/**
 * As-is, no diff prefixes. Reshaping it into a fake diff of pure additions dropped every source
 * line starting with ++ (prefixed, `++counter;` becomes `+++counter;`, which the added-lines
 * filter throws away as a header). scanFile takes the mode instead.
 */
function getFileContent(filePath) {
  try {
    return readFileSync(filePath, 'utf-8');
  } catch {
    return '';
  }
}

/**
 * Adds /g while keeping the flags the pattern already declares. new RegExp(pattern, 'g')
 * REPLACES the flag set instead of extending it, which silently stripped /i from the ten
 * case-insensitive patterns above, so `API_KEY=` in upper case went undetected.
 */
function withGlobalFlag(pattern) {
  const flags = pattern.flags.includes('g') ? pattern.flags : `${pattern.flags}g`;
  // Not user input: `pattern` is always one of the SECRET_PATTERNS literals above, and only its
  // flags change. The rule is about a string from outside reaching the regex engine.
  // eslint-disable-next-line security/detect-non-literal-regexp
  return new RegExp(pattern.source, flags);
}

/**
 * @param filePath path reported in the findings
 * @param source   a `git diff` in staged mode, the raw file in `--all` mode
 * @param isDiff   whether `source` is a diff. Only then is there anything to filter
 */
function scanFile(filePath, source, { isDiff } = { isDiff: true }) {
  const findings = [];

  // In diff mode only added lines matter, and `+++ b/path` is a header rather than a change.
  // Whole files carry no such markers, so filtering them there would drop real code.
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

function main() {
  // Staged mode reads `git diff --cached`, which is right for the pre-commit hook and useless in
  // CI: after actions/checkout that list is empty, so the job printed "no staged files" and
  // exited 0 while being a needs: of all three deploys. Use --all there.
  //
  // Not --range base..HEAD, which is empty on push events and needs a non-shallow clone.
  const scanAll = process.argv.includes('--all');
  console.info(
    `${colors.cyan}🔐 Checking for secrets/tokens in ${scanAll ? 'all tracked files' : 'staged files'}...${colors.reset}\n`
  );

  const files = scanAll ? getTrackedFiles() : getStagedFiles();

  if (files.length === 0) {
    if (scanAll) {
      // Nothing tracked means git ls-files failed, not that the repo is clean.
      console.error(`${colors.red}❌ --all found no tracked files - is this a git repository?${colors.reset}`);
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
        `${colors.cyan}Only MEDIUM heuristics matched, not blocking the commit.${colors.reset}\n` +
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
