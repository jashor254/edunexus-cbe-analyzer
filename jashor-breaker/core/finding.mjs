import { createHash } from 'node:crypto'
import { readFileSync } from 'node:fs'
import { validate } from './schema.mjs'
import { containsSecret } from './redactor.mjs'

export const CLASSIFICATIONS = ['confirmed', 'suspected', 'unverified']
export const SEVERITIES = ['info', 'low', 'medium', 'high', 'critical']

const schema = JSON.parse(readFileSync(new URL('../schemas/finding.schema.json', import.meta.url), 'utf8'))

/**
 * Classification contract:
 *  confirmed  - a deterministic observation that directly demonstrates the fact
 *               (e.g. a workflow line that is not SHA-pinned). Reproducible by re-running.
 *  suspected  - a deterministic signal that strongly indicates a problem but whose
 *               real-world impact was not demonstrated (e.g. secret-shaped string; liveness unchecked).
 *  unverified - cannot be established from what this check can see; needs an external
 *               look or a future active test (e.g. Vercel runtime setting).
 *
 * @typedef {{checkId:string,title:string,severity:string,classification:string,
 *   rationale:string,evidence:{kind:string,location:string,detail:string}[],
 *   reproduce:string,remediationHint:string,cwe?:string,triage?:{verdict:string,reasons:string[]},key:string}} FindingInput
 */

/** Stable id: same check + same key => same id across runs. */
export function findingId(checkId, key) {
  return `JB-${createHash('sha256').update(`${checkId}\n${key}`).digest('hex').slice(0, 10)}`
}

/** @param {FindingInput} f */
export function makeFinding(f) {
  const { key, ...rest } = f
  const finding = { id: findingId(f.checkId, key), ...rest }
  const errors = validate(finding, schema)
  if (errors.length) throw new Error(`Invalid finding from ${f.checkId}: ${errors.join('; ')}`)
  // Evidence must never carry a recognisable secret. Fail closed.
  if (containsSecret(JSON.stringify(finding))) {
    throw new Error(`Finding from ${f.checkId} contains unredacted secret material; refusing to emit`)
  }
  return finding
}

/** Recompute the digest from a report's own findings; true only if untampered. */
export function verifyDigest(report) {
  return typeof report?.evidenceDigest === 'string' && Array.isArray(report.findings) && evidenceDigest(report.findings) === report.evidenceDigest
}

/** Canonical digest over findings only (no timestamps) so identical inputs give identical digests. */
export function evidenceDigest(findings) {
  const sorted = [...findings].sort((a, b) => a.id.localeCompare(b.id))
  return createHash('sha256').update(JSON.stringify(sorted)).digest('hex')
}
