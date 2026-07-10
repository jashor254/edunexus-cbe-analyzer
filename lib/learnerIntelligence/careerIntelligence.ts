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
import { confidenceFromScore, insufficientEvidenceInsight } from './insight'
import type { Insight } from './insight'

const CATEGORY_LABEL: Record<CareerCategory, string> = {
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
    confidence:  confidenceFromScore(match.alignment_score),
    action,
  }
}

async function buildSeniorMatches(studentId: string, profile: ReturnType<typeof extractCapabilityProfile>, careers: Awaited<ReturnType<typeof getAllCareersWithCOS>>): Promise<CareerMatchInsight[]> {
  const report = computeCapabilityMatches(studentId, profile, careers)
  const all = [...report.primary, ...report.stretch, ...report.alternative, ...report.entrepreneurial]

  return all.map(match => ({
    careerSlug:   match.career_slug,
    careerTitle:  match.career_title,
    tier:         match.tier,
    alignmentPct: alignmentToPercent(match.alignment_score),
    insight:      matchToInsight(match),
  }))
}

async function buildJuniorFamilies(studentId: string, profile: ReturnType<typeof extractCapabilityProfile>, careers: Awaited<ReturnType<typeof getAllCareersWithCOS>>): Promise<CareerFamilyInsight[]> {
  const report = computeCapabilityMatches(studentId, profile, careers)
  // Junior view groups by broad category and never surfaces a ranked
  // "you should become X" claim — specific careers only appear as
  // exploration examples inside the action text.
  const all = [...report.primary, ...report.stretch]

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
        confidence:  confidenceFromScore(top.alignment_score),
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
  }

  if (scoreHistory.length === 0) {
    return { ...base, notice: insufficientEvidenceInsight('this learner’s career direction') }
  }

  const profile = extractCapabilityProfile(scoreHistory)

  if (isJunior) {
    return { ...base, families: await buildJuniorFamilies(studentId, profile, careers) }
  }
  return { ...base, matches: await buildSeniorMatches(studentId, profile, careers) }
}
