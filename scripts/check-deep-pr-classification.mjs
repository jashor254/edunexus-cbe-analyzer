#!/usr/bin/env node
// scripts/check-deep-pr-classification.mjs
//
// Manifest safety guard for DEEP_PR/HTTP_PR (H1E-A). These 11 files were
// individually proven safe for CI enforcement — this script re-verifies
// that proof holds on every run, so a later edit to one of these files
// can't silently widen what CI trusts without being caught.
//
// Checks, per file:
//   - no .env.local / .env.production reference
//   - no direct createServiceClient import from utils/supabase/service
//     (the production-named factory — DEEP_PR/HTTP_PR files must go
//     through createTestServiceClient via utils/supabase/test-service)
//   - no known external-call imports (Paystack, WhatsApp/Twilio, DeepSeek/
//     AI provider clients) — these files prove DB/Auth/HTTP invariants,
//     not third-party integrations
//   - HTTP_PR files only: base URL resolves through the canonical
//     TEST_BASE_URL pattern (see check-http-base-url-consistency.mjs),
//     no bespoke hardcoded port
//
// Any violation is a hard CI failure requiring explicit reclassification
// (edit the manifest deliberately), never a silent pass-through.

import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'

const __dirname = dirname(fileURLToPath(import.meta.url))
const repoRoot = join(__dirname, '..')

const FORBIDDEN_PATTERNS = [
  { pattern: /\.env\.local/, reason: '.env.local reference' },
  { pattern: /\.env\.production/, reason: '.env.production reference' },
  { pattern: /from ['"]@\/utils\/supabase\/service['"]/, reason: "direct import of the production-named createServiceClient factory (must use createTestServiceClient)" },
  { pattern: /from ['"]@\/lib\/payments\/paystack/, reason: 'direct Paystack integration import' },
  { pattern: /from ['"]@\/lib\/whatsapp/, reason: 'direct WhatsApp integration import' },
  { pattern: /from ['"]@\/lib\/ai\//, reason: 'direct AI provider integration import' },
]

const CANONICAL_BASE_URL = /process\.env\.TEST_BASE_URL(\s*\?\?\s*process\.env\.LMS_TEST_BASE_URL)?\s*\?\?\s*'http:\/\/localhost:3100'/

function stripComments(content) {
  // Whole-line `//` comments only (line starts with `//` after leading
  // whitespace) — deliberately NOT a trailing-comment stripper, since a
  // naive `//.*$` also eats the `//` inside `'http://localhost:3100'`
  // literals in real code. Every .env.local mention this guard needs to
  // ignore (the "Run: ... --env-file=..." doc comments) is a full-line
  // comment, so this is sufficient without a real parser.
  return content
    .split('\n')
    .map(line => (/^\s*\/\//.test(line) ? '' : line))
    .join('\n')
}

function checkFile(file, isHttp) {
  const raw = readFileSync(join(repoRoot, file), 'utf8')
  const content = stripComments(raw)
  const violations = []

  for (const { pattern, reason } of FORBIDDEN_PATTERNS) {
    if (pattern.test(content)) violations.push(reason)
  }

  if (isHttp) {
    const match = content.match(/const BASE(?:_URL)?\s*=\s*(.+)/)
    if (!match || !CANONICAL_BASE_URL.test(match[0])) {
      violations.push(`non-canonical base URL resolution: ${match ? match[0].trim() : '(none found)'}`)
    }
  }

  return violations
}

function loadManifest(name) {
  return JSON.parse(readFileSync(join(__dirname, name), 'utf8'))
}

let failed = false

for (const [manifestFile, isHttp] of [['deep-pr-tests.json', false], ['http-pr-tests.json', true]]) {
  const manifest = loadManifest(manifestFile)
  for (const file of manifest.files) {
    const violations = checkFile(file, isHttp)
    if (violations.length > 0) {
      failed = true
      console.error(`CLASSIFICATION DRIFT: ${file}`)
      for (const v of violations) console.error(`  - ${v}`)
    }
  }
}

if (failed) {
  console.error('')
  console.error('One or more DEEP_PR/HTTP_PR files no longer match the safety profile they were')
  console.error('enforced under. Reclassify explicitly (edit the manifest + this check\'s')
  console.error('expectations) rather than letting CI silently trust a widened dependency.')
  process.exit(1)
}

console.log('DEEP_PR/HTTP_PR classification guard: all files still match their proven safety profile')
