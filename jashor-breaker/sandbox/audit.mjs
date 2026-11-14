// Hash-chained audit log for sandboxed runs. Lives on the HOST, outside the sandbox: nothing running inside the
// sandbox can reach the path, and the worker never sees it.
//
// WHAT A HASH CHAIN GIVES YOU: tamper EVIDENCE. Each record contains the SHA-256 of its own canonical content
// (including the previous record's hash), so editing, reordering or removing a record in the middle breaks the
// chain at a detectable point.
//
// WHAT IT DOES NOT GIVE YOU: prevention. Anyone who can write the file can delete the whole log, truncate its tail,
// or rewrite every record and recompute every hash, and a chain alone cannot tell. Tamper evidence is only as
// strong as the protection of the log (owner-only permissions here, ideally append-only storage or a remote copy)
// and of a TRUSTED CHECKPOINT: record the head hash and record count somewhere an attacker cannot also edit
// (printed at the end of each run; pass them back with --expect-head / --expect-count to detect tail truncation
// and wholesale rewrites). See docs/AUDIT.md.
import { createHash, randomBytes } from 'node:crypto'
import { closeSync, constants, fsyncSync, lstatSync, mkdirSync, openSync, readFileSync, unlinkSync, writeSync } from 'node:fs'
import { dirname, isAbsolute, resolve } from 'node:path'

export const AUDIT_FORMAT = 'jb-audit-1'
export const GENESIS_HASH = '0'.repeat(64)
const MAX_RECORD_BYTES = 16 * 1024
const OUTCOMES = new Set(['completed', 'failed', 'refused'])
const HEX64 = /^[0-9a-f]{64}$/
const KEYS = ['format', 'seq', 'runId', 'time', 'targetFingerprint', 'securityPolicyVersion', 'sandboxConfigDigest', 'outcome', 'testResults', 'reportDigest', 'prevHash', 'hash']

export class AuditError extends Error {
  constructor(message) { super(message); this.name = 'AuditError' }
}

/** Deterministic JSON: sorted keys, no whitespace. Same value -> same bytes on every run and platform. */
export function canonical(value) {
  if (value === null || typeof value !== 'object') {
    if (typeof value === 'number' && !Number.isFinite(value)) throw new AuditError('non-finite number cannot be canonicalised')
    return JSON.stringify(value)
  }
  if (Array.isArray(value)) return `[${value.map(canonical).join(',')}]`
  return `{${Object.keys(value).sort().filter((k) => value[k] !== undefined).map((k) => `${JSON.stringify(k)}:${canonical(value[k])}`).join(',')}}`
}

const sha256 = (s) => createHash('sha256').update(s).digest('hex')
export const digestOf = (value) => sha256(canonical(value))
export const newRunId = () => `run-${new Date().toISOString().replace(/[-:.TZ]/g, '').slice(0, 14)}-${randomBytes(4).toString('hex')}`

/** Hash of a record's content (everything except its own `hash`). */
export const recordHash = (rec) => { const { hash: _omit, ...rest } = rec; return sha256(canonical(rest)) }

/** Compact test results only: ids, counts and digests. Never raw findings, paths or file content. */
export function summariseResults(report) {
  return {
    checksRun: [...(report.checksRun ?? [])].sort(),
    checkErrors: (report.checkErrors ?? []).length,
    findings: (report.findings ?? []).length,
    categories: report.summary?.categories ?? {},
    evidenceDigest: report.evidenceDigest ?? null,
    isolation: report.isolation ? { mechanism: report.isolation.mechanism, network: report.isolation.network, seccomp: report.isolation.seccomp ?? null } : null,
  }
}

function validateRecord(rec) {
  if (!rec || typeof rec !== 'object' || Array.isArray(rec)) return 'not an object'
  const keys = Object.keys(rec).sort()
  if (canonical(keys) !== canonical([...KEYS].sort())) return 'unexpected or missing fields'
  if (rec.format !== AUDIT_FORMAT) return 'unknown format'
  if (!Number.isSafeInteger(rec.seq) || rec.seq < 1) return 'bad seq'
  if (!/^run-[0-9]{14}-[0-9a-f]{8}$/.test(rec.runId)) return 'bad runId'
  if (typeof rec.time !== 'string' || Number.isNaN(Date.parse(rec.time))) return 'bad time'
  for (const k of ['targetFingerprint', 'sandboxConfigDigest', 'prevHash', 'hash']) if (!HEX64.test(rec[k] ?? '')) return `bad ${k}`
  if (rec.reportDigest !== null && !HEX64.test(rec.reportDigest)) return 'bad reportDigest'
  if (typeof rec.securityPolicyVersion !== 'string' || rec.securityPolicyVersion.length > 100) return 'bad securityPolicyVersion'
  if (!OUTCOMES.has(rec.outcome)) return 'bad outcome'
  if (!rec.testResults || typeof rec.testResults !== 'object') return 'bad testResults'
  return null
}

/**
 * Verify an audit log. Never throws on a damaged log; it reports every problem it can find.
 * @param {string} path
 * @param {{expectHead?:string, expectCount?:number}} [trusted] checkpoint kept somewhere the log's writer cannot edit
 */
export function verifyAudit(path, trusted = {}) {
  const problems = []
  let text
  try { text = readFileSync(resolve(path), 'utf8') } catch { return { ok: false, records: 0, head: null, problems: ['log unreadable or missing'] } }
  const lines = text.split('\n')
  if (lines.at(-1) === '') lines.pop()
  else problems.push('last line is not newline-terminated (possible truncated write)')
  let prev = GENESIS_HASH
  let seq = 0
  let lastTime = 0
  let head = null
  lines.forEach((line, i) => {
    const n = i + 1
    let rec
    try { rec = JSON.parse(line) } catch { problems.push(`line ${n}: not valid JSON`); return }
    const bad = validateRecord(rec)
    if (bad) { problems.push(`line ${n}: ${bad}`); return }
    if (line !== canonical(rec)) problems.push(`line ${n}: not in canonical form (re-serialised?)`)
    if (rec.seq !== seq + 1) problems.push(`line ${n}: sequence ${rec.seq}, expected ${seq + 1} (record removed, duplicated or reordered)`)
    if (rec.prevHash !== prev) problems.push(`line ${n}: prevHash does not match the previous record (chain broken)`)
    if (rec.hash !== recordHash(rec)) problems.push(`line ${n}: hash does not match content (record altered)`)
    const t = Date.parse(rec.time)
    if (t < lastTime) problems.push(`line ${n}: time goes backwards (clock change or reordering)`)
    lastTime = Math.max(lastTime, t)
    seq = rec.seq
    prev = rec.hash
    head = rec.hash
  })
  if (trusted.expectHead !== undefined && trusted.expectHead !== head) problems.push('head hash differs from the trusted checkpoint (truncated, extended or rewritten since)')
  if (trusted.expectCount !== undefined && trusted.expectCount !== lines.length) problems.push(`record count ${lines.length} differs from the trusted checkpoint ${trusted.expectCount}`)
  return { ok: problems.length === 0, records: lines.length, head, problems, checkpointed: trusted.expectHead !== undefined || trusted.expectCount !== undefined }
}

/** The log must be a private regular file we own, in a private directory: refuse anything else (symlinks, shared files). */
function checkLocation(path) {
  if (typeof path !== 'string' || !isAbsolute(path) || path.includes('\0')) throw new AuditError('audit log path must be an absolute path')
  const dir = dirname(path)
  mkdirSync(dir, { recursive: true, mode: 0o700 })
  const uid = process.getuid()
  const d = lstatSync(dir)
  if (!d.isDirectory() || d.isSymbolicLink()) throw new AuditError('audit log directory is not a plain directory')
  if (d.uid !== uid || (d.mode & 0o022) !== 0) throw new AuditError('audit log directory must be owned by the current user and not group/world writable')
  try {
    const s = lstatSync(path)
    if (!s.isFile() || s.isSymbolicLink()) throw new AuditError('audit log is not a regular file')
    if (s.uid !== uid || (s.mode & 0o077) !== 0) throw new AuditError('audit log must be owned by the current user with mode 0600')
  } catch (err) { if (err instanceof AuditError) throw err }
}

/**
 * Append one record. Refuses to extend a log that does not verify (a broken chain must be looked at, not buried).
 * A lock file serialises concurrent writers; a stale lock fails closed with a clear message.
 * @returns {{seq:number, hash:string, runId:string}}
 */
export function appendAudit(path, fields) {
  checkLocation(path)
  const lock = `${path}.lock`
  let lockFd
  try { lockFd = openSync(lock, constants.O_CREAT | constants.O_EXCL | constants.O_WRONLY, 0o600) } catch { throw new AuditError(`audit log is locked (${lock}); if no run is active, remove the stale lock after checking the log`) }
  try {
    let exists = true
    try { lstatSync(path) } catch (err) { if (err?.code === 'ENOENT') exists = false; else throw new AuditError('audit log cannot be inspected') }
    const before = exists ? verifyAudit(path) : { ok: true, records: 0, head: null, problems: [] }
    if (exists && !before.ok) throw new AuditError(`refusing to append: existing audit log does not verify (${before.problems[0]})`)
    const prevHash = exists ? before.head ?? GENESIS_HASH : GENESIS_HASH
    const rec = {
      format: AUDIT_FORMAT, seq: (exists ? before.records : 0) + 1, runId: fields.runId, time: (fields.time ?? new Date()).toISOString(),
      targetFingerprint: fields.targetFingerprint, securityPolicyVersion: fields.securityPolicyVersion, sandboxConfigDigest: fields.sandboxConfigDigest,
      outcome: fields.outcome, testResults: fields.testResults, reportDigest: fields.reportDigest ?? null, prevHash,
    }
    const full = { ...rec, hash: recordHash(rec) }
    const bad = validateRecord(full)
    if (bad) throw new AuditError(`audit record invalid: ${bad}`)
    const line = `${canonical(full)}\n`
    if (Buffer.byteLength(line) > MAX_RECORD_BYTES) throw new AuditError('audit record too large')
    const fd = openSync(path, constants.O_CREAT | constants.O_APPEND | constants.O_WRONLY | constants.O_NOFOLLOW, 0o600)
    try { writeSync(fd, line); fsyncSync(fd) } finally { closeSync(fd) }
    return { seq: full.seq, hash: full.hash, runId: full.runId }
  } finally {
    closeSync(lockFd)
    try { unlinkSync(lock) } catch { /* already gone */ }
  }
}
