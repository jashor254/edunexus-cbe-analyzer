import { authorise } from '../core/guard.mjs'
import { prepareAdapter, safeMessage } from '../core/runner.mjs'
import { evidenceDigest } from '../core/finding.mjs'
import { countByCategory } from '../core/categories.mjs'
import { containsSecret, redactLine } from '../core/redactor.mjs'
import { validate } from '../core/schema.mjs'
import { readFileSync } from 'node:fs'
import { createSnapshot, normaliseLimits, probeSandbox, runConfined, confinementDigest, SECURITY_POLICY_VERSION, DEFAULT_TOOLS } from './sandbox.mjs'
import { AuditError, appendAudit, digestOf, newRunId, summariseResults } from './audit.mjs'
import { programDigest, buildSeccompProgram, SECCOMP_POLICY_VERSION } from './seccomp.mjs'

const findingSchema = JSON.parse(readFileSync(new URL('../schemas/finding.schema.json', import.meta.url), 'utf8'))
const MAX_FINDINGS = 5000

/**
 * The worker lives in the sandbox and its output is DATA, not trust: schema-check every finding, refuse any
 * that still carries secret-shaped text, re-redact error strings, and only accept check ids the adapter declared.
 */
export function acceptWorkerOutput(raw, declaredIds) {
  let out
  try { out = JSON.parse(raw) } catch { throw new Error('Sandbox worker returned unparseable output') }
  if (!out || typeof out !== 'object' || !Array.isArray(out.findings) || !Array.isArray(out.checkErrors) || !Array.isArray(out.checksRun)) throw new Error('Sandbox worker output has the wrong shape')
  if (out.findings.length > MAX_FINDINGS) throw new Error('Sandbox worker returned too many findings')
  for (const f of out.findings) {
    const errs = validate(f, findingSchema)
    if (errs.length) throw new Error(`Sandbox worker finding failed validation: ${errs[0]}`)
    if (!declaredIds.includes(f.checkId)) throw new Error('Sandbox worker finding names an undeclared check')
    if (containsSecret(JSON.stringify(f))) throw new Error('Sandbox worker finding contains secret material; discarded')
  }
  for (const id of out.checksRun) if (!declaredIds.includes(id)) throw new Error('Sandbox worker reported an undeclared check')
  const checkErrors = out.checkErrors.slice(0, 100).map((e) => ({ checkId: String(e?.checkId ?? '').slice(0, 64), message: redactLine(String(e?.message ?? '').replace(/\s+/g, ' ')).redacted.slice(0, 160) }))
  return { findings: out.findings, checkErrors, checksRun: out.checksRun }
}

/**
 * Passive run inside Sandbox S1. Same inputs and rules as run(); the checks execute against a read-only
 * snapshot of the target's COMMITTED tree with no network, no credentials, no home directory and no Docker socket.
 * Throws (fail closed) if isolation cannot be established; there is no unconfined fallback.
 */
export async function runSandboxed({ adapters, configPath, targetId, only, mode = 'passive', now, limits, tools = DEFAULT_TOOLS, auditLog }) {
  const authorised = authorise({ configPath, targetId, mode, now })
  const { target, rootDir } = authorised
  const { checks } = prepareAdapter({ adapters, adapterId: target.adapter, rootDir, only })
  const declaredIds = adapters[target.adapter].checks.map((c) => c.id)
  const clock = now ?? new Date()
  const normalised = normaliseLimits(limits)

  const runId = newRunId()
  const targetFingerprint = digestOf({ id: target.id, adapter: target.adapter, environment: target.environment, mode, root: rootDir })
  const record = (outcome, testResults, reportDigest, cfgDigest) => {
    if (!auditLog) return null
    return appendAudit(auditLog, {
      runId, time: clock, targetFingerprint, securityPolicyVersion: SECURITY_POLICY_VERSION,
      sandboxConfigDigest: cfgDigest ?? digestOf({ unavailable: true, policy: SECURITY_POLICY_VERSION }), outcome, testResults, reportDigest,
    })
  }
  let cfgDigest
  try {
    await probeSandbox({ tools })
  } catch (err) {
    record('refused', { reason: 'isolation unavailable', detail: String(err.message).slice(0, 200) }, null)
    throw err
  }
  const snapshot = (() => { try { return createSnapshot(authorised) } catch (err) { record('refused', { reason: 'snapshot refused', detail: String(err.message).slice(0, 200) }, null); throw err } })()
  try {
    const args = ['--adapter', target.adapter, '--now', clock.toISOString(), ...checks.flatMap((c) => ['--check', c.id])]
    cfgDigest = confinementDigest({ script: 'sandbox/worker.mjs', args, snapshot, limits, permission: true, tools })
    const r = await runConfined({ script: 'sandbox/worker.mjs', args, snapshot, limits, permission: true, tools })
    if (r.timedOut) throw new Error(`Sandboxed run exceeded the ${normalised.wallClockSec}s wall-clock limit and was killed`)
    if (r.outputTruncated) throw new Error('Sandboxed run exceeded the output limit and was killed')
    if (r.code !== 0) throw new Error(`Sandboxed run failed (exit ${r.code}${r.signal ? `, ${r.signal}` : ''}): ${safeMessage(r.stderr.split('\n').find(Boolean) ?? 'no diagnostic')}`)
    const { findings, checkErrors, checksRun } = acceptWorkerOutput(r.stdout, declaredIds)
    const report = {
      tool: { name: 'jashor-breaker', version: '0.1.0', node: process.version },
      target: { id: target.id, adapter: target.adapter, environment: target.environment, mode },
      subject: { gitHead: snapshot.gitHead, workingTreeDirty: snapshot.dirty, snapshotOf: 'HEAD (committed files only)', snapshot: snapshot.stats, containment: 'immutable-snapshot' },
      isolation: {
        mechanism: 'bubblewrap + systemd user scope + seccomp',
        namespaces: ['user', 'pid', 'net', 'ipc', 'uts', 'cgroup'],
        network: 'none', environment: 'empty', home: 'not mounted', dockerSocket: 'not mounted', targetMount: 'read-only',
        seccomp: { policyVersion: SECCOMP_POLICY_VERSION, digest: programDigest(buildSeccompProgram()), kind: 'denylist' },
        policy: SECURITY_POLICY_VERSION, configDigest: cfgDigest,
        limits: normalised,
      },
      runId,
      generatedAt: clock.toISOString(),
      checksRun,
      checkErrors,
      summary: { categories: countByCategory(findings) },
      findings: findings.sort((a, b) => a.id.localeCompare(b.id)),
      evidenceDigest: evidenceDigest(findings),
    }
    const rec = record(checkErrors.length ? 'failed' : 'completed', summariseResults(report), digestOf(report), cfgDigest)
    return rec ? { ...report, audit: { seq: rec.seq, recordHash: rec.hash, reportDigestCoversEverythingExceptThisBlock: true } } : report
  } catch (err) {
    if (auditLog && !(err instanceof AuditError)) { try { record('failed', { reason: 'run failed', detail: String(err.message).slice(0, 200) }, null, cfgDigest) } catch { /* the original error is the one to surface */ } }
    throw err
  } finally {
    snapshot.cleanup()
  }
}
