#!/usr/bin/env node
// scripts/check-dependency-audit.mjs
// Dependency vulnerability gate. Runs `npm audit --omit=dev --json` and blocks
// on any high/critical production advisory that isn't a reviewed, unexpired
// entry in docs/security/accepted-risks.json. Run by CI on every push/PR and
// nightly by .github/workflows/security-nightly.yml — the nightly run is what
// catches a NEW advisory against code that hasn't changed.
// Policy: scripts/security/audit-rules.mjs.
//
// Usage: node scripts/check-dependency-audit.mjs

import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { spawnSync } from 'node:child_process'
import { evaluateAudit } from './security/audit-rules.mjs'

const ROOT = join(fileURLToPath(new URL('.', import.meta.url)), '..')
const REGISTER_PATH = join(ROOT, 'docs', 'security', 'accepted-risks.json')

// --package-lock-only: audits the committed lockfile, so CI needs no `npm ci`.
// npm audit exits non-zero whenever ANY vulnerability exists, so the exit code
// is not the signal — the parsed JSON is. An unparseable result fails loudly.
const run = spawnSync('npm', ['audit', '--package-lock-only', '--omit=dev', '--json'], { cwd: ROOT, encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 })
let audit
try {
  audit = JSON.parse(run.stdout)
} catch {
  console.error('❌ Could not parse `npm audit --json` output:\n' + (run.stderr || run.stdout).slice(0, 2000))
  process.exit(1)
}

const accepted = JSON.parse(readFileSync(REGISTER_PATH, 'utf8')).advisories
const today = new Date().toISOString().slice(0, 10)
const { blocking, warnings } = evaluateAudit({ audit, accepted, today })

console.log('\nEduNexus Dependency Audit (production dependencies)\n' + '─'.repeat(70))
const counts = audit.metadata?.vulnerabilities ?? {}
console.log(`npm audit: critical ${counts.critical ?? 0}, high ${counts.high ?? 0}, moderate ${counts.moderate ?? 0}, low ${counts.low ?? 0} · ${accepted.length} accepted`)

for (const w of warnings) console.log(`⚪  ${w.rule}  ${w.id}  ${w.message}`)

if (blocking.length > 0) {
  for (const b of blocking) console.log(`❌  ${b.rule}  ${b.message}`)
  console.log('─'.repeat(70))
  console.log(`❌ Dependency audit FAILED — ${blocking.length} blocking item(s).`)
  console.log('   Fix: upgrade (npm audit fix, then `npm run build`), or — only after proving it is')
  console.log('   unreachable — add a dated entry to docs/security/accepted-risks.json.\n')
  process.exit(1)
}

console.log('─'.repeat(70))
console.log('✅ Dependency audit passed\n')
