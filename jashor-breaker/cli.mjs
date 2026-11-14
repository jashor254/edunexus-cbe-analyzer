#!/usr/bin/env node
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { resolve, join } from 'node:path'
import { homedir } from 'node:os'
import { parseArgs } from 'node:util'
import { run, safeMessage } from './core/runner.mjs'
import { toMarkdown } from './core/report.mjs'
import { GuardRefusal } from './core/guard.mjs'
import { SEVERITIES, verifyDigest } from './core/finding.mjs'
import { ADAPTERS } from './adapters/registry.mjs'
import { runSandboxed } from './sandbox/run.mjs'
import { probeSandbox, SandboxUnavailable } from './sandbox/sandbox.mjs'
import { verifyAudit, AuditError } from './sandbox/audit.mjs'
import { SnapshotRefused } from './sandbox/snapshot.mjs'

const { positionals, values } = parseArgs({
  allowPositionals: true,
  options: {
    config: { type: 'string' },
    target: { type: 'string' },
    check: { type: 'string', multiple: true },
    mode: { type: 'string', default: 'passive' },
    out: { type: 'string' },
    'fail-on': { type: 'string' },
    json: { type: 'boolean', default: false },
    sandbox: { type: 'boolean', default: false },
    'audit-log': { type: 'string' },
    'expect-head': { type: 'string' },
    'expect-count': { type: 'string' },
  },
})

if (positionals[0] === 'verify' && positionals[1]) {
  // Offline integrity check of a previously written report.json.
  try {
    const ok = verifyDigest(JSON.parse(readFileSync(resolve(positionals[1]), 'utf8')))
    console.log(ok ? 'OK: evidence digest matches findings' : 'MISMATCH: report was altered or is not a Jashor Breaker report')
    process.exit(ok ? 0 : 1)
  } catch {
    console.error('ERROR: could not read report')
    process.exit(2)
  }
}

if (positionals[0] === 'sandbox-probe') {
  // Dynamic proof that isolation works on this host. Exit 3 (refusal) if it does not: fail closed.
  try {
    console.log(JSON.stringify(await probeSandbox(), null, 2))
    process.exit(0)
  } catch (err) {
    console.error(`REFUSED: ${err.message}`)
    process.exit(err instanceof SandboxUnavailable ? 3 : 2)
  }
}

if (positionals[0] === 'audit-verify' && positionals[1]) {
  // Offline tamper-evidence check of an audit log. Pass a trusted checkpoint to also detect truncation/rewrites.
  const count = values['expect-count'] === undefined ? undefined : Number(values['expect-count'])
  const r = verifyAudit(resolve(positionals[1]), { expectHead: values['expect-head'], expectCount: Number.isInteger(count) ? count : undefined })
  console.log(JSON.stringify(r, null, 2))
  if (!r.checkpointed) console.error('NOTE: no trusted checkpoint supplied; a hash chain cannot detect deletion, tail truncation or a full rewrite without one.')
  process.exit(r.ok ? 0 : 1)
}

if (positionals[0] !== 'run') {
  console.error('usage: jashor-breaker run --config <targets.json> --target <id> [--check <id>]... [--out <dir>] [--json] [--fail-on <severity>] [--sandbox]\n       jashor-breaker sandbox-probe\n       jashor-breaker verify <report.json>\n       jashor-breaker audit-verify <audit.jsonl> [--expect-head <hash>] [--expect-count <n>]')
  process.exit(2)
}
if (values['fail-on'] && !SEVERITIES.includes(values['fail-on'])) {
  console.error(`ERROR: --fail-on must be one of ${SEVERITIES.join(', ')}`)
  process.exit(2)
}

try {
  const result = await (values.sandbox ? runSandboxed : run)({
    adapters: ADAPTERS,
    configPath: values.config ? resolve(values.config) : '',
    targetId: values.target,
    only: values.check,
    mode: values.mode,
    ...(values.sandbox ? { auditLog: resolve(values['audit-log'] ?? join(homedir(), '.local', 'state', 'jashor-breaker', 'audit.jsonl')) } : {}),
  })
  if (values.out) {
    const dir = resolve(values.out)
    mkdirSync(dir, { recursive: true })
    writeFileSync(resolve(dir, 'report.json'), `${JSON.stringify(result, null, 2)}\n`)
    writeFileSync(resolve(dir, 'report.md'), `${toMarkdown(result)}\n`)
  }
  console.log(values.json ? JSON.stringify(result, null, 2) : toMarkdown(result))
  if (result.audit) console.error(`audit: record ${result.audit.seq}, hash ${result.audit.recordHash} (keep this checkpoint OUTSIDE the log; see docs/AUDIT.md)`)
  if (result.checkErrors.length) process.exit(2)
  const floor = values['fail-on']
  if (floor && result.findings.some((f) => f.classification !== 'unverified' && SEVERITIES.indexOf(f.severity) >= SEVERITIES.indexOf(floor))) process.exit(1)
} catch (err) {
  if (err instanceof GuardRefusal || err instanceof SandboxUnavailable || err instanceof SnapshotRefused || err instanceof AuditError) {
    console.error(`REFUSED: ${err.message}`)
    process.exit(3)
  }
  console.error(`ERROR: ${safeMessage(err)}`)
  process.exit(2)
}
