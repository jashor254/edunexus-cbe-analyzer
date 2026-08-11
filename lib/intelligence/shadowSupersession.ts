// lib/intelligence/shadowSupersession.ts
//
// Phase E3 — READ-ONLY comparison of the two supersession rules.
//
//   LEGACY (authoritative today): the six-field claim key
//     learner : subject : subStrandId : assessmentType : year : term
//     — answers "is this newer evidence about the same curriculum area?"
//
//   NEW (measured, not executed): producer-declared artifact identity
//     learner : evidence_source : correction_key
//     — answers "is this a new representation of the same artifact?"
//
// This module NEVER writes. It performs SELECTs only: no evidence insert or
// update, no lifecycle transition, no correction-key write, no projection
// event, no audit entry. `claimKey()` and `findCurrentEvidenceForClaim()`
// remain untouched and remain authoritative — E4 is where that changes.
//
// The measurement exists because E1 found ~32 of 55 production supersession
// chains were accidental collisions between INDEPENDENT observations. Before
// switching authority we need observed proof that the new rule NARROWS
// supersession to genuine corrections and never widens it.

import { createServiceClient } from '@/utils/supabase/service'
import { correctionKeyNamespace } from './correctionKey'

export type ShadowDecision =
  | { kind: 'COEXIST'; reason: string }
  | { kind: 'SUPERSEDE'; priorId: string; reason: string }

/** Mandatory verdict vocabulary (E3 §3). */
export type ShadowVerdict =
  | 'BOTH_COEXIST'
  | 'BOTH_SUPERSEDE'
  | 'OLD_SUPERSEDES_NEW_COEXISTS'
  /** THE STOP CATEGORY — the new rule creating a supersession the old rule did not. */
  | 'OLD_COEXISTS_NEW_SUPERSEDES'

export type ShadowComparison = {
  evidenceId: string
  evidenceSource: string
  learnerId: string
  subject: string
  subStrandId: string | null
  assessmentType: string
  correctionKey: string | null
  legacy: ShadowDecision
  next: ShadowDecision
  verdict: ShadowVerdict
  /** True when both rules supersede but point at DIFFERENT prior rows — a subtler disagreement than the verdict alone shows. */
  differentPrior: boolean
}

/** Pure verdict from two decisions — the whole comparison, isolated for testing. */
export function verdictFor(legacy: ShadowDecision, next: ShadowDecision): ShadowVerdict {
  if (legacy.kind === 'SUPERSEDE' && next.kind === 'SUPERSEDE') return 'BOTH_SUPERSEDE'
  if (legacy.kind === 'COEXIST' && next.kind === 'COEXIST') return 'BOTH_COEXIST'
  if (legacy.kind === 'SUPERSEDE' && next.kind === 'COEXIST') return 'OLD_SUPERSEDES_NEW_COEXISTS'
  return 'OLD_COEXISTS_NEW_SUPERSEDES'
}

/**
 * States a row could have been in when a LATER row arrived.
 *
 * `findCurrentEvidenceForClaim()` looks at (auto_confirmed, pending_review,
 * reviewed_confirmed). This replay adds `superseded`, because a row being
 * superseded TODAY is proof it was standing when its successor arrived —
 * filtering it out would make historical replay under-report the legacy
 * rule's own decisions (the first run of this harness reported zero legacy
 * supersessions against 55 known chains for exactly that reason).
 *
 * `reviewed_rejected`, `retracted` and `erased` are excluded: unlike
 * supersession, none of them is caused by a later row, so their current
 * state is not evidence about the past.
 */
const STANDING = ['auto_confirmed', 'pending_review', 'reviewed_confirmed', 'superseded'] as const

type Row = {
  id: string; learner_id: string | null; subject: string; sub_strand_id: string | null
  assessment_type: string; academic_year: number; term: number | null
  evidence_source: string; correction_key: string | null; created_at: string
  lifecycle_state: string
}

/**
 * What the LEGACY rule would decide for `row`, considering only evidence
 * created strictly BEFORE it. Reproduces `claimKey()`'s exemptions and
 * `findCurrentEvidenceForClaim()`'s six-field match — deliberately a
 * re-implementation over a fixed candidate set rather than a call into the
 * live path, so measuring can never trigger a write.
 */
export function legacyDecision(row: Row, priorCandidates: Row[]): ShadowDecision {
  if (!row.learner_id) return { kind: 'COEXIST', reason: 'no learner id — unkeyed' }
  if (row.evidence_source === 'teacher_remark') return { kind: 'COEXIST', reason: 'teacher_remark is event evidence (Phase C)' }
  if (row.evidence_source === 'compass_session') return { kind: 'COEXIST', reason: 'compass_session is event evidence (Phase 1.5)' }

  const prior = priorCandidates
    .filter(p =>
      p.learner_id === row.learner_id &&
      p.subject === row.subject &&
      (p.sub_strand_id ?? null) === (row.sub_strand_id ?? null) &&
      p.assessment_type === row.assessment_type &&
      p.academic_year === row.academic_year &&
      (p.term ?? null) === (row.term ?? null) &&
      STANDING.includes(p.lifecycle_state as typeof STANDING[number]) &&
      p.created_at < row.created_at,
    )
    .sort((a, b) => b.created_at.localeCompare(a.created_at))[0]

  return prior
    ? { kind: 'SUPERSEDE', priorId: prior.id, reason: 'six-field claim key matched' }
    : { kind: 'COEXIST', reason: 'no prior row shares the claim key' }
}

/**
 * What the NEW rule would decide. Scope is exactly what E4 would use —
 * `(learner_id, evidence_source, correction_key)`.
 *
 * `evidence_source` is in the scope on purpose (E1 §13): it makes
 * cross-producer supersession structurally impossible, so a low-trust
 * producer cannot reach a teacher's artifact even if it somehow emitted that
 * artifact's key. Subject and sub-strand are deliberately NOT in scope — a
 * correction may legitimately fix a mis-entered subject, and requiring a
 * match would block the very correction the mechanism exists for.
 */
export function nextDecision(row: Row, priorCandidates: Row[]): ShadowDecision {
  if (!row.learner_id) return { kind: 'COEXIST', reason: 'no learner id' }
  if (!row.correction_key) return { kind: 'COEXIST', reason: 'no correction_key — an independent observation' }
  if (!correctionKeyNamespace(row.correction_key)) {
    return { kind: 'COEXIST', reason: `unrecognised namespace in "${row.correction_key}" — never trusted` }
  }

  const prior = priorCandidates
    .filter(p =>
      p.learner_id === row.learner_id &&
      p.evidence_source === row.evidence_source &&
      p.correction_key === row.correction_key &&
      STANDING.includes(p.lifecycle_state as typeof STANDING[number]) &&
      p.created_at < row.created_at,
    )
    .sort((a, b) => b.created_at.localeCompare(a.created_at))[0]

  return prior
    ? { kind: 'SUPERSEDE', priorId: prior.id, reason: 'same learner, source and artifact' }
    : { kind: 'COEXIST', reason: 'no prior evidence for this artifact' }
}

export function compareRow(row: Row, priorCandidates: Row[]): ShadowComparison {
  const legacy = legacyDecision(row, priorCandidates)
  const next = nextDecision(row, priorCandidates)
  return {
    evidenceId: row.id,
    evidenceSource: row.evidence_source,
    learnerId: row.learner_id ?? '(unresolved)',
    subject: row.subject,
    subStrandId: row.sub_strand_id,
    assessmentType: row.assessment_type,
    correctionKey: row.correction_key,
    legacy,
    next,
    verdict: verdictFor(legacy, next),
    differentPrior:
      legacy.kind === 'SUPERSEDE' && next.kind === 'SUPERSEDE' && legacy.priorId !== next.priorId,
  }
}

export type ShadowReport = {
  evaluated: number
  keyed: number
  unkeyed: number
  byVerdict: Record<ShadowVerdict, number>
  byProducer: Record<string, Record<ShadowVerdict, number>>
  differentPrior: number
  malformedKeys: number
  /** Every STOP-category row, in full — never summarised away. */
  stopCases: ShadowComparison[]
  /** Rows a pending correction would target while a confirmed row stands (Gate D observation only). */
  gateDCases: Array<{ evidenceId: string; candidateState: string; priorId: string; priorState: string }>
}

const EMPTY_VERDICTS = (): Record<ShadowVerdict, number> => ({
  BOTH_COEXIST: 0, BOTH_SUPERSEDE: 0, OLD_SUPERSEDES_NEW_COEXISTS: 0, OLD_COEXISTS_NEW_SUPERSEDES: 0,
})

/**
 * Runs the comparison over the live evidence population. SELECT only.
 *
 * Evaluates every row against the rows that existed before it, so the
 * measurement reflects what each rule WOULD have decided at insert time.
 */
export async function runShadowComparison(options?: { keyedOnly?: boolean }): Promise<ShadowReport> {
  const db = createServiceClient()

  // Paginated: PostgREST caps an unbounded select at 1000 rows, which
  // silently truncated the first run of this harness (1,000 of 1,016) and
  // would quietly under-measure as the table grows.
  const PAGE = 1000
  const rows: Row[] = []
  for (let from = 0; ; from += PAGE) {
    const { data, error } = await db
      .from('learner_evidence')
      .select('id, learner_id, subject, sub_strand_id, assessment_type, academic_year, term, evidence_source, correction_key, created_at, lifecycle_state')
      .order('created_at', { ascending: true })
      .order('id', { ascending: true })
      .range(from, from + PAGE - 1)
    if (error) throw new Error(`runShadowComparison: ${error.message}`)
    const page = (data ?? []) as Row[]
    rows.push(...page)
    if (page.length < PAGE) break
  }
  const byId = new Map(rows.map(r => [r.id, r]))
  const report: ShadowReport = {
    evaluated: 0, keyed: 0, unkeyed: 0,
    byVerdict: EMPTY_VERDICTS(), byProducer: {},
    differentPrior: 0, malformedKeys: 0, stopCases: [], gateDCases: [],
  }

  for (let i = 0; i < rows.length; i++) {
    const row = rows[i]
    if (options?.keyedOnly && !row.correction_key) continue

    const comparison = compareRow(row, rows.slice(0, i))
    report.evaluated++
    if (row.correction_key) {
      report.keyed++
      if (!correctionKeyNamespace(row.correction_key)) report.malformedKeys++
    } else {
      report.unkeyed++
    }

    report.byVerdict[comparison.verdict]++
    report.byProducer[row.evidence_source] ??= EMPTY_VERDICTS()
    report.byProducer[row.evidence_source][comparison.verdict]++
    if (comparison.differentPrior) report.differentPrior++
    if (comparison.verdict === 'OLD_COEXISTS_NEW_SUPERSEDES') report.stopCases.push(comparison)

    // Gate D observation only — never a decision, never a change.
    if (comparison.next.kind === 'SUPERSEDE' && row.lifecycle_state === 'pending_review') {
      const prior = byId.get(comparison.next.priorId)
      if (prior && (prior.lifecycle_state === 'auto_confirmed' || prior.lifecycle_state === 'reviewed_confirmed')) {
        report.gateDCases.push({
          evidenceId: row.id, candidateState: row.lifecycle_state,
          priorId: prior.id, priorState: prior.lifecycle_state,
        })
      }
    }
  }

  return report
}
