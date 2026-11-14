import { readFileSync } from 'node:fs'
import { authorise } from './guard.mjs'
import { createContext } from './context.mjs'
import { evidenceDigest } from './finding.mjs'
import { countByCategory } from './categories.mjs'
import { redactLine } from './redactor.mjs'
import { validate } from './schema.mjs'

/**
 * Adapter contract (application-specific; the core knows nothing about EduNexus):
 *  { id, configSchemaPath, loadConfig(rootDir) -> object, checks: Check[] }
 * Check contract:
 *  { id, title, mode: 'passive', run(ctx) -> Finding[] }   // Finding built via makeFinding()
 */

/** Error text from a check may echo file content (e.g. JSON.parse). Redact and bound it. */
export function safeMessage(err) {
  const raw = err instanceof Error ? err.message : String(err)
  return redactLine(raw.replace(/\s+/g, ' ')).redacted.slice(0, 160)
}

/** Deep-freeze so a check cannot flip its own mode (or another check's) between validation and execution. */
function freeze(o) {
  if (o && typeof o === 'object' && !Object.isFrozen(o)) {
    Object.freeze(o)
    for (const v of Object.values(o)) freeze(v)
  }
  return o
}

/**
 * Resolve and validate an adapter and its selected checks BEFORE anything runs.
 * Shared by the in-process runner, the sandbox host and the sandbox worker so all three apply identical rules.
 */
export function prepareAdapter({ adapters, adapterId, rootDir, only }) {
  // hasOwn: an adapter name like "constructor" must not resolve to Object.prototype members.
  if (!Object.hasOwn(adapters, adapterId)) throw new Error(`No adapter registered for "${adapterId}"`)
  const adapter = adapters[adapterId]

  // Validate EVERY check the adapter declares (not just the selected ones), before anything runs.
  for (const c of adapter.checks) {
    if (c?.mode !== 'passive') throw new Error(`Check ${c?.id} declares mode ${JSON.stringify(c?.mode)}; only passive checks can run in v0`)
    if (typeof c.run !== 'function' || typeof c.id !== 'string') throw new Error('Malformed check definition')
  }
  const ids = adapter.checks.map((c) => c.id)
  for (const want of only ?? []) {
    if (!ids.includes(want)) throw new Error(`Unknown check "${want}". Available: ${ids.join(', ')}`)
  }
  freeze(adapter.checks)

  const adapterConfig = adapter.loadConfig(rootDir)
  const cfgErrors = validate(adapterConfig, JSON.parse(readFileSync(adapter.configSchemaPath, 'utf8')))
  if (cfgErrors.length) throw new Error(`Adapter config invalid: ${cfgErrors.join('; ')}`)
  const checks = adapter.checks.filter((c) => !only?.length || only.includes(c.id))
  return { adapter, adapterConfig, checks }
}

/** Run checks against a context. Shared by the in-process runner and the sandbox worker. */
export async function executeChecks(ctx, checks) {
  const findings = []
  const checkErrors = []
  const checksRun = []
  for (const c of checks) {
    try {
      findings.push(...(await c.run(ctx)))
      checksRun.push(c.id)
    } catch (err) {
      // Never swallowed: surfaced in the report and in the exit code, with content redacted.
      checkErrors.push({ checkId: c.id, message: safeMessage(err) })
    }
  }
  return { findings, checkErrors, checksRun }
}

/** @param {{adapters:Record<string, any>, configPath:string, targetId?:string, only?:string[], mode?:string, now?:Date}} opts */
export async function run({ adapters, configPath, targetId, only, mode = 'passive', now, allowPathOnlyContainment = false }) {
  const { target, rootDir } = authorise({ configPath, targetId, mode, now })
  const { adapterConfig, checks } = prepareAdapter({ adapters, adapterId: target.adapter, rootDir, only })

  const clock = now ?? new Date()
  const ctx = createContext(rootDir, freeze(structuredClone(adapterConfig)), { now: clock, allowPathOnlyContainment })
  const { findings, checkErrors, checksRun } = await executeChecks(ctx, checks)

  const head = (ctx.git(['rev-parse', 'HEAD']) ?? '').trim() || null
  const status = ctx.git(['status', '--porcelain'])
  const dirty = status === null ? null : status.trim().length > 0 // null = unknown (never silently "clean")
  return {
    tool: { name: 'jashor-breaker', version: '0.1.0', node: process.version },
    target: { id: target.id, adapter: target.adapter, environment: target.environment, mode },
    subject: { gitHead: head, workingTreeDirty: dirty, containment: ctx.containment },
    generatedAt: clock.toISOString(),
    checksRun,
    checkErrors,
    summary: { categories: countByCategory(findings) },
    findings: findings.sort((a, b) => a.id.localeCompare(b.id)),
    evidenceDigest: evidenceDigest(findings),
  }
}
