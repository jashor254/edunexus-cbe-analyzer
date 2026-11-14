import { makeFinding } from '../../../core/finding.mjs'

const CHECK = 'accepted-risks'
const REPRO = 'node cli.mjs run --config <targets.json> --target <id> --check accepted-risks'
const DAY = 86_400_000
const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/

/** Strict calendar-date parse: "2026-02-31" is rejected, not rolled over. Returns epoch-day number or null. */
function dayNumber(s) {
  if (typeof s !== 'string' || !ISO_DATE.test(s)) return null
  const t = Date.parse(`${s}T00:00:00Z`)
  if (Number.isNaN(t) || new Date(t).toISOString().slice(0, 10) !== s) return null
  return Math.floor(t / DAY)
}

const sevOf = (e) => (['low', 'medium', 'high', 'critical'].includes(e.severity) ? e.severity : 'medium')
const label = (e) => e.id ?? e.lint ?? '(unnamed entry)'

/**
 * Reads the accepted-risk register and reports on it. STRICTLY read-only and additive:
 *  - it only ever emits findings about the register itself (it has no hook into other checks' findings),
 *  - it never rewrites, renews, removes or reorders an entry, and an expired acceptance is reported, not "fixed",
 *  - it does not judge whether the underlying risk is still real; that is the owner's call.
 * Expiry semantics mirror scripts/security/audit-rules.mjs: an acceptance is valid THROUGH its expires date.
 */
export const acceptedRisks = {
  id: CHECK,
  title: 'Accepted-risk register: expiry, ownership and review hygiene',
  mode: 'passive',
  run(ctx) {
    const cfg = ctx.adapterConfig.acceptedRisks
    const text = ctx.read(cfg.registerPath)
    if (text === null) return []

    let register
    try { register = JSON.parse(text) } catch {
      // Parse errors can echo file content, so none is included.
      return [makeFinding({
        key: 'register-unreadable', checkId: CHECK, kind: 'control-failure', severity: 'medium', classification: 'confirmed',
        title: 'Accepted-risk register is not valid JSON',
        rationale: 'The CI gates that read this register cannot evaluate acceptances if it does not parse.',
        evidence: [{ kind: 'file', location: cfg.registerPath, detail: 'JSON parse failed (error text withheld)' }],
        reproduce: REPRO, remediationHint: 'Restore valid JSON from git history. Breaker never edits the register.',
      })]
    }

    const today = Math.floor(Date.UTC(ctx.now.getUTCFullYear(), ctx.now.getUTCMonth(), ctx.now.getUTCDate()) / DAY)
    const todayText = new Date(today * DAY).toISOString().slice(0, 10)
    const isEntry = (e) => e !== null && typeof e === 'object' && !Array.isArray(e)
    const section = (name) => (Array.isArray(register?.[name]) ? register[name].filter(isEntry).map((e) => ({ ...e, section: name })) : [])
    const entries = [...section('advisories'), ...section('database')]

    const findings = []
    const missingOwner = []
    const missingReview = []

    for (const e of entries) {
      const name = label(e)
      const where = `${cfg.registerPath} (${e.section}: ${name})`
      const exp = dayNumber(e.expires)
      const acc = dayNumber(e.accepted)

      if (!(typeof e.owner === 'string' && e.owner.trim()) && !(typeof e.acceptedBy === 'string' && e.acceptedBy.trim())) missingOwner.push(name)
      if (!dayNumber(e.reviewedAt) && !dayNumber(e.lastReviewed)) missingReview.push(name)

      if (exp === null) {
        findings.push(makeFinding({
          key: `no-expiry:${e.section}:${name}`, checkId: CHECK, kind: 'control-failure', severity: 'medium', classification: 'confirmed',
          title: 'Risk acceptance has no valid expiry date',
          rationale: 'An acceptance without a real YYYY-MM-DD expiry is a permanent mute; the register rules require a dated, re-reviewable decision.',
          evidence: [{ kind: 'config', location: where, detail: `expires is ${e.expires === undefined ? 'missing' : 'not a valid calendar date'}` }],
          reproduce: REPRO, remediationHint: 'Owner to set a dated expiry after re-checking the risk. Breaker never edits the register.',
        }))
        continue
      }
      if (acc !== null && exp <= acc) {
        findings.push(makeFinding({
          key: `expiry-before-accept:${e.section}:${name}`, checkId: CHECK, kind: 'control-failure', severity: 'low', classification: 'confirmed',
          title: 'Risk acceptance expires on or before the day it was accepted',
          rationale: 'The dates are inconsistent, so the acceptance period is meaningless.',
          evidence: [{ kind: 'config', location: where, detail: `accepted ${e.accepted}, expires ${e.expires}` }],
          reproduce: REPRO, remediationHint: 'Owner to correct the dates.',
        }))
      }

      const daysLeft = exp - today
      if (daysLeft < 0) {
        findings.push(makeFinding({
          key: `expired:${e.section}:${name}`, checkId: CHECK, kind: 'expired-acceptance', severity: sevOf(e), classification: 'confirmed',
          title: `Risk acceptance expired ${-daysLeft} day${daysLeft === -1 ? '' : 's'} ago`,
          rationale: 'The acceptance is no longer valid. The underlying issue is treated as unaccepted until the owner re-reviews and renews, or fixes it. Whether the issue is still present was not assessed here.',
          evidence: [{ kind: 'config', location: where, detail: `expired ${e.expires}; checked on ${todayText}` }],
          reproduce: REPRO, remediationHint: 'Owner to re-check reachability and renew with a new date, or remediate. Breaker does not renew or remove entries.',
        }))
      } else if (daysLeft <= cfg.warnWithinDays) {
        findings.push(makeFinding({
          key: `expiring:${e.section}:${name}`, checkId: CHECK, kind: 'accepted-risk', severity: 'low', classification: 'confirmed',
          title: `Accepted risk expires in ${daysLeft} day${daysLeft === 1 ? '' : 's'}`,
          rationale: `The acceptance is still valid but falls inside the ${cfg.warnWithinDays}-day warning window; CI will start blocking after ${e.expires}.`,
          evidence: [{ kind: 'config', location: where, detail: `expires ${e.expires}; checked on ${todayText}` }],
          reproduce: REPRO, remediationHint: 'Owner to schedule the re-review before expiry.',
        }))
      } else {
        findings.push(makeFinding({
          key: `accepted:${e.section}:${name}`, checkId: CHECK, kind: 'accepted-risk', severity: 'info', classification: 'confirmed',
          title: 'Accepted risk (valid)',
          rationale: 'A recorded, unexpired decision. Listed for visibility only; Breaker neither endorses nor suppresses anything because of it.',
          evidence: [{ kind: 'config', location: where, detail: `expires ${e.expires}, ${daysLeft} days remaining` }],
          reproduce: REPRO, remediationHint: 'None; re-review before expiry.',
        }))
      }
    }

    if (cfg.requireOwner && missingOwner.length) {
      findings.push(makeFinding({
        key: 'missing-owner', checkId: CHECK, kind: 'control-failure', severity: 'low', classification: 'confirmed',
        title: `${missingOwner.length} accepted-risk entr${missingOwner.length === 1 ? 'y has' : 'ies have'} no recorded owner`,
        rationale: 'Nobody is named as accountable for re-reviewing the decision. The register currently has no owner field at all, so this is a register-design gap as much as a data gap.',
        evidence: [{ kind: 'config', location: cfg.registerPath, detail: `entries without owner/acceptedBy: ${missingOwner.slice(0, 12).join(', ')}` }],
        reproduce: REPRO, remediationHint: 'Add an `owner` field to the register convention (a founder decision); Breaker will not edit it.',
      }))
    }
    if (cfg.requireReviewDate && missingReview.length) {
      findings.push(makeFinding({
        key: 'missing-review-date', checkId: CHECK, kind: 'control-failure', severity: 'low', classification: 'confirmed',
        title: `${missingReview.length} accepted-risk entr${missingReview.length === 1 ? 'y has' : 'ies have'} no structured review date`,
        rationale: 'Only the acceptance date and expiry are structured. A re-verification may be mentioned in free-text reasons, which cannot be checked mechanically.',
        evidence: [{ kind: 'config', location: cfg.registerPath, detail: `entries without reviewedAt/lastReviewed: ${missingReview.slice(0, 12).join(', ')}` }],
        reproduce: REPRO, remediationHint: 'Add a `reviewedAt` (YYYY-MM-DD) field to the register convention; Breaker will not edit it.',
      }))
    }
    return findings
  },
}
