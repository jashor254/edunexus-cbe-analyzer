#!/usr/bin/env node
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { parseArgs } from 'node:util'
import { run, safeMessage } from './core/runner.mjs'
import { toMarkdown } from './core/report.mjs'
import { GuardRefusal } from './core/guard.mjs'
import { SEVERITIES, verifyDigest } from './core/finding.mjs'
import { edunexus } from './adapters/edunexus/index.mjs'

const ADAPTERS = { edunexus }

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

if (positionals[0] !== 'run') {
  console.error('usage: jashor-breaker run --config <targets.json> --target <id> [--check <id>]... [--out <dir>] [--json] [--fail-on <severity>]\n       jashor-breaker verify <report.json>')
  process.exit(2)
}
if (values['fail-on'] && !SEVERITIES.includes(values['fail-on'])) {
  console.error(`ERROR: --fail-on must be one of ${SEVERITIES.join(', ')}`)
  process.exit(2)
}

try {
  const result = await run({
    adapters: ADAPTERS,
    configPath: values.config ? resolve(values.config) : '',
    targetId: values.target,
    only: values.check,
    mode: values.mode,
  })
  if (values.out) {
    const dir = resolve(values.out)
    mkdirSync(dir, { recursive: true })
    writeFileSync(resolve(dir, 'report.json'), `${JSON.stringify(result, null, 2)}\n`)
    writeFileSync(resolve(dir, 'report.md'), `${toMarkdown(result)}\n`)
  }
  console.log(values.json ? JSON.stringify(result, null, 2) : toMarkdown(result))
  if (result.checkErrors.length) process.exit(2)
  const floor = values['fail-on']
  if (floor && result.findings.some((f) => f.classification !== 'unverified' && SEVERITIES.indexOf(f.severity) >= SEVERITIES.indexOf(floor))) process.exit(1)
} catch (err) {
  if (err instanceof GuardRefusal) {
    console.error(`REFUSED: ${err.message}`)
    process.exit(3)
  }
  console.error(`ERROR: ${safeMessage(err)}`)
  process.exit(2)
}
