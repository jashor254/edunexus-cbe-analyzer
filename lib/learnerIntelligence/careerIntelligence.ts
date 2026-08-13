// lib/learnerIntelligence/careerIntelligence.ts
// Career Intelligence — an interactive exploration experience, not a PDF.
//
// Junior (Grade 7–9): explore broad career FAMILIES with evidence — never a
// predicted career. Senior (Grade 10–12): specific career alignment, still
// evidence + confidence per recommendation. Both modes reuse the same
// deterministic, AI-free capabilityMatchEngine — no duplicate matching logic.

import { getStudentBasicInfo } from '@/lib/learnerModel'
import { extractCapabilityProfile } from '@/lib/career/capabilityExtractor'
import { computeCapabilityMatches, alignmentToPercent } from '@/lib/career/capabilityMatchEngine'
import { getAllCareersWithCOS, getCareerBySlugWithCOS } from '@/lib/career/careerEngine'
import { COS_DISCLAIMER } from '@/lib/career/types'
import { assessCareerKnowledge } from '@/lib/career/knowledgeLifecycle'
import type { CareerKnowledgeState } from '@/lib/career/knowledgeLifecycle'
import type { CapabilityCareerMatch, CareerCategory, CareerDoor, DoorType, CareerMatchWithDetail, CareerSummary } from '@/lib/career/types'
import { recomputeLearnerProjection } from '@/lib/projection/recompute'
import { projectionToScoreHistory } from './projectionAdapters'
import { insufficientEvidenceInsight } from './insight'
import type { Insight, ConfidenceLevel } from './insight'

// Exported (Sprint 12M) so `getCareerBlueprintSummary` below — and any other
// consumer needing the same cluster-level label a specific career maps to —
// reuses this one label map instead of inventing a second one.
export const CATEGORY_LABEL: Record<CareerCategory, string> = {
  technology:  'Engineering & Technology',
  health:      'Health Sciences',
  agriculture: 'Agriculture & Environmental Sciences',
  creative:    'Creative Industries',
  business:    'Business',
  trades:      'Trades & Technical Careers',
  education:   'Education',
  environment: 'Environmental Sciences',
  media:       'Media & Communication',
  finance:     'Finance',
}

export type CareerFamilyInsight = {
  category:            CareerCategory
  categoryLabel:        string
  insight:              Insight
  exampleCareerTitles:  string[]
}

export type CareerMatchInsight = {
  careerSlug:    string
  careerTitle:   string
  /** Propagated from `CapabilityCareerMatch.career_category` — already computed by `computeCapabilityMatches`, never re-derived here. Added Sprint 12M so cluster-level consumers (Blueprint) don't need a second read to learn a match's category. */
  careerCategory: CareerCategory
  tier:          CapabilityCareerMatch['tier']
  alignmentPct:  number
  insight:       Insight
}

// ── Career Principle grade gate ─────────────────────────────────────────────
//
// The ONE place the Junior/Senior boundary is decided. Junior (Grade 7-9)
// always explores broad families, never a ranked/percentage career
// prediction; Senior (Grade 10-12) sees specific alignment. Every consumer
// that needs this decision (Career Explorer, Parent Career Intelligence,
// the Career Intelligence Report, and this module itself) must call this
// instead of re-deriving the boundary — see Sprint "Career Intelligence
// Canonicalization" Phase 1, which replaced 4 independent
// `grade >= 7 && grade <= 9` checks with this single export.
export type CareerMode = 'exploration' | 'planning'

export function careerModeForGrade(grade: number): CareerMode {
  return grade >= 7 && grade <= 9 ? 'exploration' : 'planning'
}

export type CareerIntelligence = {
  studentId:   string
  studentName: string
  grade:       number
  mode:        'exploration' | 'planning'   // exploration = Junior, planning = Senior
  disclaimer:  string
  generatedAt: string
  /** Days since the most recent supporting evidence (Projection Engine coverage) — null when there's none yet. */
  evidenceFreshnessDays: number | null

  // Set when there isn't enough assessment data yet for any matching/grouping.
  notice?: Insight

  // Junior only
  families?: CareerFamilyInsight[]

  // Senior only
  matches?: CareerMatchInsight[]
}

function matchToInsight(match: CapabilityCareerMatch): Insight {
  const evidence = [
    ...match.strengths.map(s => s.narrative),
    ...match.gaps.map(g => g.narrative),
  ]

  const topGap = match.gaps.find(g => g.gap_severity === 'significant') ?? match.gaps[0]
  const action = topGap
    ? `Focus on ${topGap.dimension.replace(/_/g, ' ')} — ${topGap.narrative}`
    : `You are well aligned here — start exploring ${match.career_title} directly (job shadowing, subject electives, early courses).`

  return {
    observation: match.narrative,
    evidence:    evidence.length > 0 ? evidence : ['Not enough capability data yet to break this down by dimension.'],
    // match.confidence reflects evidence quality (assessment count) — the
    // question this Insight's confidence field is meant to answer. How well
    // the profile aligns to the career (alignment_score) is a separate axis,
    // already carried by `tier`/`alignmentPct`.
    confidence:  match.confidence,
    action,
  }
}

async function buildSeniorMatches(studentId: string, profile: ReturnType<typeof extractCapabilityProfile>, careers: Awaited<ReturnType<typeof getAllCareersWithCOS>>): Promise<CareerMatchInsight[]> {
  const report = computeCapabilityMatches(studentId, profile, careers)
  const all = [...report.primary, ...report.stretch, ...report.alternative, ...report.entrepreneurial]

  return all.map(match => ({
    careerSlug:     match.career_slug,
    careerTitle:    match.career_title,
    careerCategory: match.career_category,
    tier:           match.tier,
    alignmentPct:   alignmentToPercent(match.alignment_score),
    insight:        matchToInsight(match),
  }))
}

// Groups already-computed matches into broad category "families" — the one
// Junior-safe view every consumer of computeCapabilityMatches() must use
// instead of surfacing individual ranked/percentage predictions. Pure
// function over CapabilityCareerMatch[] so any consumer (Career Explorer,
// Parent Intelligence, the Career Intelligence Report) can reuse the exact
// same grouping instead of inventing its own — same matcher, same data,
// just regrouped for the audience the Career Principle requires.
export function familiesFromMatches(all: CapabilityCareerMatch[]): CareerFamilyInsight[] {
  const byCategory = new Map<CareerCategory, CapabilityCareerMatch[]>()
  for (const match of all) {
    const bucket = byCategory.get(match.career_category) ?? []
    bucket.push(match)
    byCategory.set(match.career_category, bucket)
  }

  const families: CareerFamilyInsight[] = []
  for (const [category, matches] of byCategory) {
    matches.sort((a, b) => b.alignment_score - a.alignment_score)
    const top = matches[0]
    const exampleTitles = matches.slice(0, 3).map(m => m.career_title)

    const evidence = [
      ...top.strengths.map(s => s.narrative),
      ...top.gaps.slice(0, 1).map(g => g.narrative),
    ]

    families.push({
      category,
      categoryLabel: CATEGORY_LABEL[category] ?? category,
      insight: {
        observation: `Current evidence suggests an emerging capability alignment with ${CATEGORY_LABEL[category] ?? category}.`,
        evidence:    evidence.length > 0 ? evidence : ['Not enough capability data yet to break this down further.'],
        confidence:  top.confidence,
        action:      `Explore this field through subjects, clubs, or projects related to: ${exampleTitles.join(', ')}.`,
      },
      exampleCareerTitles: exampleTitles,
    })
  }

  return families.sort((a, b) => {
    const scoreA = Math.max(...(byCategory.get(a.category) ?? []).map(m => m.alignment_score))
    const scoreB = Math.max(...(byCategory.get(b.category) ?? []).map(m => m.alignment_score))
    return scoreB - scoreA
  })
}

// ── Canonical capability-profile resolution ─────────────────────────────────
//
// The one place that turns a studentId into a fresh, Projection-sourced
// CapabilityProfile. Every consumer that needs to run computeCapabilityMatches
// (Career Intelligence itself, the Capability Matches API, Parent Career
// Intelligence, and the per-career detail route) must call this instead of
// re-deriving recomputeLearnerProjection → projectionToScoreHistory →
// extractCapabilityProfile independently — three of those four call sites
// had drifted into copy-pasting this exact sequence (Sprint 31 §8 flagged
// two; the per-career detail route was a third, undiscovered one that used
// the separately-stored `career_capability_profiles` snapshot instead of
// live Projection data, meaning it could disagree with the other three).
// Returns null when there isn't yet enough evidence to build a profile at
// all — callers render their own "not enough data" state, never a fabricated
// default.
export type ResolvedCapabilityProfile = {
  profile: ReturnType<typeof extractCapabilityProfile>
  evidenceFreshnessDays: number | null
}

export async function resolveFreshCapabilityProfile(studentId: string): Promise<ResolvedCapabilityProfile | null> {
  const projection   = await recomputeLearnerProjection(studentId)
  const scoreHistory = projectionToScoreHistory(projection)
  if (scoreHistory.length === 0) return null

  return {
    profile: extractCapabilityProfile(scoreHistory),
    evidenceFreshnessDays: projection.completeness?.coverage.freshnessDays ?? null,
  }
}

export async function buildCareerIntelligence(studentId: string): Promise<CareerIntelligence> {
  const [student, resolved, careers] = await Promise.all([
    getStudentBasicInfo(studentId),
    resolveFreshCapabilityProfile(studentId),
    getAllCareersWithCOS(),
  ])

  if (!student) throw new Error(`buildCareerIntelligence: student ${studentId} not found`)

  const mode     = careerModeForGrade(student.grade)
  const isJunior = mode === 'exploration'

  const base: CareerIntelligence = {
    studentId,
    studentName: student.name,
    grade:       student.grade,
    mode,
    disclaimer:  COS_DISCLAIMER,
    generatedAt: new Date().toISOString(),
    evidenceFreshnessDays: resolved?.evidenceFreshnessDays ?? null,
  }

  if (!resolved) {
    return { ...base, notice: insufficientEvidenceInsight('this learner’s career direction') }
  }

  const { profile } = resolved

  if (isJunior) {
    const report = computeCapabilityMatches(studentId, profile, careers)
    return { ...base, families: familiesFromMatches([...report.primary, ...report.stretch]) }
  }
  return { ...base, matches: await buildSeniorMatches(studentId, profile, careers) }
}

// ── Blueprint-safe summary (Sprint 12M) ────────────────────────────────────────
//
// The one canonical read Learner Blueprint (or any future orientation-level
// consumer) calls — never `buildCareerIntelligence` directly, never
// `computeCapabilityMatches` directly. Selects the single top result
// `buildCareerIntelligence` already computed and grade-gated; performs no
// calculation of its own. Deliberately narrower than `CareerIntelligence`:
// no specific career/job title, no full families/matches list, no
// evidence/gap detail — Blueprint answers "what direction," never "which
// job," per this sprint's Architectural Goal.
/** One door, reduced to a single generic-activity sentence — never the door's own `title` (job-title-flavored) and never salary/employer/startup-cost detail. */
export type CareerDoorPreview = {
  type: DoorType
  summary: string
}

export type CareerBlueprintSummary = {
  /** Broad cluster label (e.g. "Engineering & Technology") — never a specific career/job title. */
  careerCluster: string
  /** One sentence — the same narrative Career Intelligence's own Insight already produced. */
  strengthProfile: string
  /** One sentence — Career Intelligence's own Insight.action, unmodified. */
  futureDirection: string
  /**
   * No canonical cluster-level market-outlook function exists (Career's own
   * `kenya_market_outlook` is per-specific-career metadata, and Blueprint no
   * longer surfaces a specific career to attach it to) — always null,
   * documented gap, never fabricated. See sprint-12n doc §5.
   */
  aiOutlook: string | null
  confidence: ConfidenceLevel
  /**
   * No canonical algorithm-version export exists for the capability match
   * engine (unlike Blueprint's own BLUEPRINT_VERSION) — always null,
   * documented gap, never invented. See sprint-12n doc §5.
   */
  version: string | null
  /**
   * A four-door preview of the matched career's real, canonical door data
   * (`Career.doors`) — Senior/planning mode only. `null` for Junior/
   * exploration mode (families never resolve to one specific career, by
   * design — the Career Principle grade gate), when the underlying career
   * lookup fails (fails soft, never makes the whole section unavailable),
   * or when no door has a usable description to summarize.
   */
  doorsPreview: CareerDoorPreview[] | null
  /** `Career.ai_impact.honest_summary`, verbatim — already a single, non-fear-based sentence per career. Senior-only, same null rules as `doorsPreview`. */
  aiChangeSummary: string | null
  /** Templated from `Career.ai_impact.human_advantage` (first 2-3 items) into one sentence — never the raw array. Senior-only, same null rules. */
  humanAdvantageSummary: string | null
  /** From `Career.required_subjects` — real, canonical, per-career field. Never derived from gap/weakness narrative text. Senior-only, same null rules. */
  explorationSuggestions: string[] | null
  /**
   * How current the underlying career knowledge is, from
   * `assessCareerKnowledge()`. Senior-only, same null rules as the other
   * per-career fields — Junior/exploration mode resolves to a cluster, not to a
   * career row, so there is no single verification date to report.
   *
   * A renderer that shows anything sourced from that career must show this too.
   * The corpus is hand-written and ages; presenting a salary band or a demand
   * claim in the present tense without saying when it was confirmed is the
   * defect this field exists to prevent.
   */
  knowledge: CareerKnowledgeState | null
}

const DOOR_ORDER: DoorType[] = ['employment', 'self_employment', 'entrepreneurship', 'ai_era']

function titleCaseSlug(slug: string): string {
  return slug
    .split('_')
    .map((word) => (word.length > 0 ? word[0].toUpperCase() + word.slice(1) : word))
    .join(' ')
}

function lowercaseFirst(value: string): string {
  return value.length > 0 ? value[0].toLowerCase() + value.slice(1) : value
}

function joinNatural(items: string[]): string {
  if (items.length === 0) return ''
  if (items.length === 1) return items[0]
  if (items.length === 2) return `${items[0]} and ${items[1]}`
  return `${items.slice(0, -1).join(', ')} and ${items[items.length - 1]}`
}

/** First sentence of a door's `description` only — real per-career content, generic activity level, never the door's `title`. */
function summarizeDoor(door: CareerDoor): CareerDoorPreview | null {
  if (!door.description) return null
  const firstSentence = door.description.split(/(?<=[.!?])\s/)[0]?.trim()
  if (!firstSentence) return null
  return { type: door.type, summary: firstSentence }
}

function buildDoorsPreview(doors: CareerDoor[]): CareerDoorPreview[] | null {
  const byType = new Map(doors.map((d) => [d.type, d]))
  const previews = DOOR_ORDER
    .map((type) => byType.get(type))
    .filter((d): d is CareerDoor => !!d)
    .map(summarizeDoor)
    .filter((p): p is CareerDoorPreview => !!p)
  return previews.length > 0 ? previews : null
}

/**
 * Null means "insufficient evidence" (Career Intelligence's own
 * `notice` branch) — the caller renders Blueprint's explicit Unavailable
 * state, never a fabricated default.
 */
export async function getCareerBlueprintSummary(studentId: string): Promise<CareerBlueprintSummary | null> {
  const intelligence = await buildCareerIntelligence(studentId)
  if (intelligence.notice) return null

  const top = intelligence.families?.[0] ?? intelligence.matches?.[0]
  if (!top) return null

  const careerCluster = 'categoryLabel' in top
    ? top.categoryLabel
    : (CATEGORY_LABEL[top.careerCategory] ?? top.careerCategory)

  // Senior/planning mode only — `top` is a CareerMatchInsight (has
  // `careerSlug`) exactly when it resolved to one specific matched career.
  // Junior/exploration mode's `top` is a CareerFamilyInsight (category-level,
  // no slug) — that's the Career Principle grade gate working as designed,
  // not a gap: Junior never resolves to one specific career, so a door
  // preview genuinely cannot exist for it.
  let doorsPreview: CareerDoorPreview[] | null = null
  let aiChangeSummary: string | null = null
  // Always null — its content is folded into `aiChangeSummary` as one
  // consolidated paragraph (see below). Field kept for type stability.
  const humanAdvantageSummary: string | null = null
  let explorationSuggestions: string[] | null = null
  // How current the career row's facts are. Stays null unless a specific career
  // was actually resolved, so a Junior cluster never carries a freshness claim
  // about a career it did not resolve to.
  let knowledge: CareerKnowledgeState | null = null

  if ('careerSlug' in top) {
    try {
      const career = await getCareerBySlugWithCOS(top.careerSlug)
      if (career) {
        knowledge = assessCareerKnowledge(career.knowledge_verified_at)
        doorsPreview = buildDoorsPreview(career.doors ?? [])
        // One consolidated paragraph, built only from the structured
        // `replacing`/`human_advantage` arrays — deliberately never
        // `ai_impact.honest_summary` verbatim, since that per-career
        // free-text field's exact wording ("low-skill," "cannot replace,"
        // etc.) is authored independently for every career and can't be
        // relied on to stay within this consumer's editorial register.
        // `humanAdvantageSummary` is folded into this one paragraph rather
        // than kept as a second field, so the reader never sees the same
        // "what stays human" claim twice.
        if (career.ai_impact) {
          const routine = career.ai_impact.replacing.slice(0, 2).map(lowercaseFirst)
          const advantage = career.ai_impact.human_advantage.slice(0, 3).map(lowercaseFirst)
          if (routine.length > 0 && advantage.length > 0) {
            aiChangeSummary = `AI and similar tools are automating ${joinNatural(routine)}. The field is not disappearing, but the bar is rising: ${joinNatural(advantage)} continue to depend heavily on human judgement.`
          } else if (advantage.length > 0) {
            aiChangeSummary = `The bar in this field is rising: ${joinNatural(advantage)} continue to depend heavily on human judgement.`
          }
        }
        if (career.required_subjects && career.required_subjects.length > 0) {
          explorationSuggestions = career.required_subjects.map(titleCaseSlug)
        }
      }
    } catch {
      // Fail soft — the four preview fields stay null, the rest of the
      // summary (already fully computed above) is returned unaffected.
      // The career section must never become unavailable over this lookup.
    }
  }

  return {
    careerCluster,
    strengthProfile: top.insight.observation,
    futureDirection: top.insight.action,
    aiOutlook: null,
    confidence: top.insight.confidence,
    version: null,
    doorsPreview,
    aiChangeSummary,
    humanAdvantageSummary,
    explorationSuggestions,
    knowledge,
  }
}

// ── Canonical Career Match List (Contradiction Closure Sprint) ─────────────
//
// The one canonical result contract every legacy Career-matching consumer
// (formerly `getMatchesForStudent()`, an AI-generated, persisted-table read
// that could disagree with this evidence-first pipeline) migrates onto.
// Calls `buildCareerIntelligence()` — never re-derives Junior/Senior gating,
// never calls `computeCapabilityMatches` directly — so this function cannot
// drift from the same grade-mode boundary Blueprint/Career Explorer/Parent
// Career Intelligence/Holiday Planner already obey.
//
// Junior (`exploration` mode) always returns an empty `matches` list — never
// a fabricated specific-career match — per the Career Principle
// (`careerModeForGrade`'s own doc comment, ADR-0006 §4). This is a
// deliberate behavior change from the deprecated `getMatchesForStudent()`
// path, which had no grade awareness at all and could return specific AI
// matches to a Junior learner's parent; that was never correct, and this
// migration is what actually closes it, not a regression.
//
// Shaped as `CareerMatchWithDetail[]` (the pre-existing legacy shape) so
// migrated callers can keep their current response contracts/UI field names
// without a second parallel type — per this sprint's Part 2 instruction to
// prefer adapting callers to canonical output over inventing a new shape.
// Fields the canonical engine has no equivalent for (`subject_gaps`,
// `skill_gaps` — dimension-based capability gaps, not CBC-subject gaps) are
// left `null` rather than fabricated; UI call sites already treat both as
// optional.
export type CanonicalCareerMatches = {
  matches: CareerMatchWithDetail[]
  mode: CareerMode
  insufficientEvidence: boolean
  generatedAt: string | null
}

export async function resolveCanonicalCareerMatches(studentId: string): Promise<CanonicalCareerMatches> {
  const intelligence = await buildCareerIntelligence(studentId)

  if (intelligence.notice || intelligence.mode === 'exploration' || !intelligence.matches?.length) {
    return {
      matches: [],
      mode: intelligence.mode,
      insufficientEvidence: !!intelligence.notice,
      generatedAt: intelligence.generatedAt,
    }
  }

  const allCareers = await getAllCareersWithCOS()
  const careerBySlug = new Map(allCareers.map((c) => [c.slug, c]))

  const matches: CareerMatchWithDetail[] = intelligence.matches.map((m) => {
    const career = careerBySlug.get(m.careerSlug)
    const careerSummary: CareerSummary = career
      ? {
          id: career.id,
          slug: career.slug,
          title: career.title,
          category: career.category,
          kenya_market_outlook: career.kenya_market_outlook,
          salary_range_kes: career.salary_range_kes,
          required_subjects: career.required_subjects,
          pathway: career.pathway,
          description: career.description,
          ai_impact: { level: career.ai_impact.level },
        }
      // Defensive only — every `careerSlug` here was scored against `allCareers`
      // by computeCapabilityMatches, so this branch should be unreachable.
      : {
          id: m.careerSlug,
          slug: m.careerSlug,
          title: m.careerTitle,
          category: m.careerCategory,
          kenya_market_outlook: '',
          salary_range_kes: null,
          required_subjects: [],
          pathway: 'STEM',
          description: '',
          ai_impact: { level: 'medium' },
        }

    return {
      id: m.careerSlug,
      student_id: studentId,
      career_id: career?.id ?? m.careerSlug,
      match_score: Math.round(m.alignmentPct),
      match_reasoning: m.insight.observation,
      subject_gaps: null,
      skill_gaps: null,
      generated_at: intelligence.generatedAt,
      career: careerSummary,
    }
  })

  return { matches, mode: intelligence.mode, insufficientEvidence: false, generatedAt: intelligence.generatedAt }
}
