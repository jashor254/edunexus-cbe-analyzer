// lib/career/knowledgeLifecycle.ts
//
// How old a career's knowledge is, and what a reader may therefore be told.
//
// The problem this exists to solve
// --------------------------------
// A career profile asserts salary bands, market demand and AI impact. Every one
// of those is a claim about a moment in time. The corpus rendered them to
// families in the present tense with no date attached, while the underlying
// rows had not been confirmed since 2026-06-16. A Grade 9 learner reading
// "KES 80,000–150,000 entry level" had no way to know whether that was checked
// last week or last year.
//
// The rule this module enforces
// -----------------------------
// **A figure is never presented as present tense unless we know when it was
// confirmed.** Not "we assume it's current"; not "it's probably still right."
// Either we have a verification date and state it, or we say plainly that we
// don't know. This is the evidence-first mandate applied to the platform's own
// knowledge rather than to a learner's marks — the same discipline
// `lib/config/kjseaRules.ts` already applies to placement rules.
//
// Why freshness is computed here and not in a component
// -----------------------------------------------------
// The Blueprint, the Career Explorer, the parent report and any PDF export must
// agree about whether a given career is stale. If each renderer decides for
// itself, two views of the same career disagree — which is exactly the class of
// bug Sprints 22–24 found across the intelligence layer. One function, one
// answer, carried on the composed data.

import { CAREER_KNOWLEDGE_THRESHOLDS } from '@/lib/config/careerKnowledge'
import type { VerificationSource } from './types'

export type CareerKnowledgeFreshness = 'fresh' | 'aging' | 'stale' | 'unknown'

/**
 * WHO confirmed a career's facts, as carried on the composed state (FIX 6).
 * `unrecorded` = the row has no provenance on record (careers.verification_source
 * IS NULL) — never assumed to be human.
 */
export type CareerKnowledgeProvenance = VerificationSource | 'unrecorded'

export type CareerKnowledgeState = {
  /**
   * Provenance of the facts. `null` only when the CALLER supplied no
   * provenance at all (time-only assessment); every production caller passes
   * the row's `verification_source`, so a real render always carries one.
   */
  provenance: CareerKnowledgeProvenance | null
  freshness: CareerKnowledgeFreshness
  /** Whole days since verification. Null when never verified. */
  ageDays: number | null
  /** ISO timestamp the facts were last confirmed. Null when never verified. */
  verifiedAt: string | null
  /**
   * The one sentence a reader sees next to any figure from this career.
   * Always safe to render verbatim — it never asserts currency we cannot back.
   */
  asOfLabel: string
  /**
   * True when a figure from this career must NOT be stated in the present
   * tense. Renderers use this to switch from "earns" to "earned, as of ...".
   */
  requiresHistoricalFraming: boolean
}

const MS_PER_DAY = 24 * 60 * 60 * 1000

function formatVerifiedDate(iso: string): string {
  return new Date(iso).toLocaleDateString('en-KE', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  })
}

const STARTING_POINT = 'treat them as a starting point for a conversation, not as current market data.'

/**
 * Classify how current AND how trustworthy a career's knowledge is.
 *
 * `now` is injectable so tests pin a date rather than racing the clock, and so
 * a Blueprint snapshot can be re-read later against the date it was taken.
 *
 * `verificationSource` (FIX 6) is the row's `careers.verification_source`.
 * Pass `row.verification_source ?? null` — a missing value must arrive as
 * `null` (unrecorded), never be left out:
 *   human        — time-based freshness, original labels.
 *   source_cited — time-based freshness, label says a person reviewed an AI
 *                  draft, so it can never be mistaken for hand-curated data.
 *   ai_drafted   — never fresh: `unknown`, historical framing, its own label.
 *   null         — provenance unrecorded: never fresh, same framing, own label.
 * Omitting the argument entirely gives the time-only assessment
 * (`provenance: null`); production callers never omit it (guarded by
 * reviewPublishGuards.architecture.test.ts).
 */
export function assessCareerKnowledge(
  verifiedAt: string | null | undefined,
  now: Date = new Date(),
  verificationSource?: VerificationSource | null,
): CareerKnowledgeState {
  const temporal = assessTemporalFreshness(verifiedAt, now)

  if (verificationSource === undefined) return { provenance: null, ...temporal }
  if (verificationSource === 'human') return { provenance: 'human', ...temporal }
  if (verificationSource === 'source_cited') {
    return {
      provenance: 'source_cited',
      ...temporal,
      asOfLabel: `Drafted with AI and reviewed by a person. ${temporal.asOfLabel}`,
    }
  }

  // ai_drafted or unrecorded: no person has confirmed these facts (or we
  // cannot show that one has), so the date — if any — is a draft or row-write
  // date, not a confirmation. Never fresh, never present tense.
  const dated = temporal.verifiedAt ? formatVerifiedDate(temporal.verifiedAt) : null
  if (verificationSource === 'ai_drafted') {
    return {
      provenance: 'ai_drafted',
      freshness: 'unknown',
      ageDays: null,
      verifiedAt: null,
      asOfLabel: dated
        ? `AI-drafted, not yet confirmed by a person (as of ${dated}) — ${STARTING_POINT}`
        : `AI-drafted, not yet confirmed by a person — ${STARTING_POINT}`,
      requiresHistoricalFraming: true,
    }
  }
  return {
    provenance: 'unrecorded',
    freshness: 'unknown',
    ageDays: null,
    verifiedAt: null,
    asOfLabel: dated
      ? `We have no record of who confirmed these figures (last updated ${dated}) — ${STARTING_POINT}`
      : `We have no record of who confirmed these figures, or when — ${STARTING_POINT}`,
    requiresHistoricalFraming: true,
  }
}

type TemporalKnowledgeState = Omit<CareerKnowledgeState, 'provenance'>

/** Time-only freshness from the verification date (unchanged behaviour). */
function assessTemporalFreshness(
  verifiedAt: string | null | undefined,
  now: Date,
): TemporalKnowledgeState {
  if (!verifiedAt) {
    return {
      freshness: 'unknown',
      ageDays: null,
      verifiedAt: null,
      asOfLabel: 'We have not recorded when these figures were last confirmed — treat them as a starting point for a conversation, not as current market data.',
      requiresHistoricalFraming: true,
    }
  }

  const verifiedTime = new Date(verifiedAt).getTime()
  if (Number.isNaN(verifiedTime)) {
    return {
      freshness: 'unknown',
      ageDays: null,
      verifiedAt: null,
      asOfLabel: 'We have not recorded when these figures were last confirmed — treat them as a starting point for a conversation, not as current market data.',
      requiresHistoricalFraming: true,
    }
  }

  // A verification date in the future is a data error, not fresher knowledge.
  // Clamping to 0 keeps it out of `stale` without inventing confidence.
  const ageDays = Math.max(0, Math.floor((now.getTime() - verifiedTime) / MS_PER_DAY))
  const asOf = formatVerifiedDate(verifiedAt)
  const { freshMaxDays, agingMaxDays } = CAREER_KNOWLEDGE_THRESHOLDS

  if (ageDays <= freshMaxDays) {
    return {
      freshness: 'fresh',
      ageDays,
      verifiedAt,
      asOfLabel: `Figures confirmed ${asOf}.`,
      requiresHistoricalFraming: false,
    }
  }

  if (ageDays <= agingMaxDays) {
    return {
      freshness: 'aging',
      ageDays,
      verifiedAt,
      asOfLabel: `Figures confirmed ${asOf}. Salaries and demand move — check current figures before making a decision on them.`,
      requiresHistoricalFraming: false,
    }
  }

  return {
    freshness: 'stale',
    ageDays,
    verifiedAt,
    asOfLabel: `These figures were last confirmed ${asOf} and are now out of date. They describe the market as it was then, not as it is today.`,
    requiresHistoricalFraming: true,
  }
}

/**
 * Whether a career is due for re-verification.
 *
 * Anything not `fresh` is due — including `unknown`, which is the most overdue
 * state there is, not the least.
 */
export function needsReverification(
  verifiedAt: string | null | undefined,
  now: Date = new Date(),
  verificationSource?: VerificationSource | null,
): boolean {
  // ai_drafted and unrecorded provenance resolve to `unknown`, so they are
  // always due — a person has to look at them before anything else.
  return assessCareerKnowledge(verifiedAt, now, verificationSource).freshness !== 'fresh'
}

/**
 * Sort key for a refresh sweep: oldest knowledge first, never-verified first of
 * all. Returns a comparator over anything carrying a verification date.
 */
export function byStalestFirst<T extends { knowledge_verified_at?: string | null }>(
  a: T,
  b: T,
): number {
  const aTime = a.knowledge_verified_at ? new Date(a.knowledge_verified_at).getTime() : Number.NEGATIVE_INFINITY
  const bTime = b.knowledge_verified_at ? new Date(b.knowledge_verified_at).getTime() : Number.NEGATIVE_INFINITY
  return aTime - bTime
}
