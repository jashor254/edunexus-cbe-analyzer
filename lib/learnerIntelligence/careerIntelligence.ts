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
import { getAllCareersWithCOS } from '@/lib/career/careerEngine'
import { COS_DISCLAIMER } from '@/lib/career/types'
import type { CapabilityCareerMatch, CareerCategory } from '@/lib/career/types'
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

export async function buildCareerIntelligence(studentId: string): Promise<CareerIntelligence> {
  const [student, projection, careers] = await Promise.all([
    getStudentBasicInfo(studentId),
    recomputeLearnerProjection(studentId),
    getAllCareersWithCOS(),
  ])

  if (!student) throw new Error(`buildCareerIntelligence: student ${studentId} not found`)

  const scoreHistory = projectionToScoreHistory(projection)
  const isJunior     = student.grade >= 7 && student.grade <= 9
  const mode: CareerIntelligence['mode'] = isJunior ? 'exploration' : 'planning'

  const base: CareerIntelligence = {
    studentId,
    studentName: student.name,
    grade:       student.grade,
    mode,
    disclaimer:  COS_DISCLAIMER,
    generatedAt: new Date().toISOString(),
    evidenceFreshnessDays: projection.completeness?.coverage.freshnessDays ?? null,
  }

  if (scoreHistory.length === 0) {
    return { ...base, notice: insufficientEvidenceInsight('this learner’s career direction') }
  }

  const profile = extractCapabilityProfile(scoreHistory)

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

  return {
    careerCluster,
    strengthProfile: top.insight.observation,
    futureDirection: top.insight.action,
    aiOutlook: null,
    confidence: top.insight.confidence,
    version: null,
  }
}
