// lib/eils/kgIntelligence.ts
// Layer 4 — Knowledge Graph Intelligence
//
// Adds learner-aware intelligence on top of the existing KG traversal:
//   - Personalized learning path from current gaps to mastery
//   - Bottleneck detection (which concept is blocking the most downstream topics)
//   - Mastery cluster identification (what has the student firmly established)
//   - Alternative path suggestions when the primary path is blocked
//
// All KG traversal goes through lib/knowledgeGraph — this layer only adds
// learner-specific interpretation and planning on top of raw graph data.

import { analyseStudentRootCauses, buildStudentNodeData, getNodesForSubjectGrade } from '@/lib/knowledgeGraph'
import type { RootCauseResult, KnowledgeNode } from '@/lib/knowledgeGraph/types'
import type { LearnerProfile } from '@/lib/learnerModel/types'

// ── Personalised Learning Path ────────────────────────────────────────────────

export type LearningPathStep = {
  node_id:       string
  concept:       string
  subject:       string
  strand:        string
  reason:        'prerequisite_gap' | 'confirmed_gap' | 'next_concept'
  urgency:       'critical' | 'high' | 'medium' | 'low'
  estimated_sessions: number    // rough compass sessions to mastery
  blocks_concepts:    string[]  // downstream concepts this unlocks
}

export type PersonalisedLearningPath = {
  student_id:      string
  grade:           number
  generated_at:    string
  steps:           LearningPathStep[]
  bottleneck:      string | null    // single biggest blocker
  mastery_clusters: MasteryCluster[]
  future_readiness: FutureReadiness
}

export type MasteryCluster = {
  label:     string           // e.g. "Strong in Number & Operations"
  concepts:  string[]
  avg_level: number
  pathway_relevance: string   // which CBC pathway this cluster supports
}

export type FutureReadiness = {
  ready_for_grade_up:   boolean
  readiness_score:      number    // 0–100
  blocking_concepts:    string[]
  recommended_focus:    string    // plain English summary
}

export async function buildPersonalisedLearningPath(
  studentId: string,
  grade:     number,
  profile:   LearnerProfile,
): Promise<PersonalisedLearningPath> {
  const now = new Date().toISOString()

  const [rootCauses, studentNodeData] = await Promise.all([
    analyseStudentRootCausesGracefully(studentId, grade),
    buildStudentNodeData(studentId, grade),
  ])

  const steps: LearningPathStep[] = []
  const seenConcepts = new Set<string>()

  // Step 1: prerequisite gaps first (they block everything downstream)
  const prereqGaps = profile.risk_flags.filter(f => f.type === 'missing_prerequisite')
  for (const flag of prereqGaps) {
    if (!flag.substrand || seenConcepts.has(flag.substrand)) continue
    seenConcepts.add(flag.substrand)
    steps.push({
      node_id:   flag.substrand,
      concept:   flag.substrand,
      subject:   flag.subject ?? 'unknown',
      strand:    flag.substrand,
      reason:    'prerequisite_gap',
      urgency:   'critical',
      estimated_sessions: 3,
      blocks_concepts: findDownstreamConcepts(flag.substrand, rootCauses),
    })
  }

  // Step 2: root causes from KG (foundational gaps driving surface failures)
  for (const result of rootCauses) {
    const rootLevel = result.root_causes.filter(c => c.cause_type === 'root')
    for (const cause of rootLevel.slice(0, 3)) {
      if (seenConcepts.has(cause.name)) continue
      seenConcepts.add(cause.name)

      const rating   = studentNodeData[cause.node_id] ?? 1
      const urgency  = rating <= 1 ? 'critical' : rating <= 2 ? 'high' : 'medium'

      steps.push({
        node_id:   cause.node_id,
        concept:   cause.name,
        subject:   result.subject,
        strand:    cause.strand,
        reason:    'prerequisite_gap',
        urgency,
        estimated_sessions: Math.max(2, 4 - rating),
        blocks_concepts: findDownstreamConcepts(cause.name, rootCauses),
      })
    }
  }

  // Step 3: confirmed gaps (appeared across 2+ assessments)
  for (const gap of profile.confirmed_gaps.slice(0, 5)) {
    const [subject, substrand] = gap.split(':')
    if (!substrand || seenConcepts.has(substrand)) continue
    seenConcepts.add(substrand)

    steps.push({
      node_id:   substrand,
      concept:   substrand,
      subject:   subject ?? 'unknown',
      strand:    substrand,
      reason:    'confirmed_gap',
      urgency:   'high',
      estimated_sessions: 2,
      blocks_concepts: [],
    })
  }

  // Sort by urgency then by how many downstream concepts the step unlocks
  steps.sort((a, b) => {
    const urgencyOrder = { critical: 0, high: 1, medium: 2, low: 3 }
    const uDiff = urgencyOrder[a.urgency] - urgencyOrder[b.urgency]
    if (uDiff !== 0) return uDiff
    return b.blocks_concepts.length - a.blocks_concepts.length
  })

  const bottleneck = steps.find(s => s.blocks_concepts.length >= 2)?.concept ?? null
  const masteryClusters = buildMasteryClusters(studentNodeData, profile)
  const futureReadiness = buildFutureReadiness(profile, steps)

  return {
    student_id:  studentId,
    grade,
    generated_at: now,
    steps:        steps.slice(0, 10),
    bottleneck,
    mastery_clusters: masteryClusters,
    future_readiness: futureReadiness,
  }
}

// ── Mastery Clusters ──────────────────────────────────────────────────────────

function buildMasteryClusters(
  nodeData: Record<string, number>,
  profile:  LearnerProfile,
): MasteryCluster[] {
  const clusters: MasteryCluster[] = []

  // Group high-mastery knowledge state entries by subject
  const bySubject = new Map<string, { concepts: string[]; scores: number[] }>()

  for (const [key, mastery] of Object.entries(profile.knowledge_state)) {
    if (mastery.level < 3) continue
    const [subject, substrand] = key.split(':')
    if (!subject || !substrand) continue

    if (!bySubject.has(subject)) bySubject.set(subject, { concepts: [], scores: [] })
    const entry = bySubject.get(subject)!
    entry.concepts.push(substrand)
    entry.scores.push(mastery.level)
  }

  // Also check node data from KG
  for (const [nodeId, rating] of Object.entries(nodeData)) {
    if (rating < 3) continue
    const subject = inferSubjectFromNodeId(nodeId)
    if (!bySubject.has(subject)) bySubject.set(subject, { concepts: [], scores: [] })
    const entry = bySubject.get(subject)!
    if (!entry.concepts.includes(nodeId)) {
      entry.concepts.push(nodeId)
      entry.scores.push(rating)
    }
  }

  for (const [subject, { concepts, scores }] of bySubject) {
    if (concepts.length < 2) continue
    const avgLevel = scores.reduce((a, b) => a + b, 0) / scores.length

    clusters.push({
      label:            `Strong in ${formatSubjectLabel(subject)}`,
      concepts:         concepts.slice(0, 5),
      avg_level:        Math.round(avgLevel * 10) / 10,
      pathway_relevance: inferPathwayRelevance(subject),
    })
  }

  return clusters.sort((a, b) => b.avg_level - a.avg_level).slice(0, 4)
}

// ── Future Readiness ──────────────────────────────────────────────────────────

function buildFutureReadiness(
  profile: LearnerProfile,
  steps:   LearningPathStep[],
): FutureReadiness {
  const criticalGaps  = steps.filter(s => s.urgency === 'critical').length
  const highGaps      = steps.filter(s => s.urgency === 'high').length
  const totalGaps     = criticalGaps + highGaps

  // Mastery score: what % of assessed substrands are at Level 3+?
  const allEntries   = Object.values(profile.knowledge_state)
  const masteredPct  = allEntries.length > 0
    ? allEntries.filter(m => m.level >= 3).length / allEntries.length
    : 0

  const readinessScore = Math.round(
    Math.max(0, (masteredPct * 100) - (criticalGaps * 15) - (highGaps * 7))
  )

  const blockingConcepts = steps
    .filter(s => s.urgency === 'critical' || s.blocks_concepts.length >= 2)
    .map(s => s.concept)

  return {
    ready_for_grade_up:  totalGaps === 0 && readinessScore >= 70,
    readiness_score:     readinessScore,
    blocking_concepts:   blockingConcepts.slice(0, 3),
    recommended_focus:   buildFocusSummary(steps, readinessScore),
  }
}

// ── Helpers ───────────────────────────────────────────────────────────────────

async function analyseStudentRootCausesGracefully(
  studentId: string,
  grade:     number,
): Promise<RootCauseResult[]> {
  try {
    return await analyseStudentRootCauses(studentId, grade)
  } catch (e: unknown) {
    console.error('[kgIntelligence:analyseStudentRootCausesGracefully]', e instanceof Error ? e.message : String(e))
    return []
  }
}

function findDownstreamConcepts(
  conceptName: string,
  rootCauses:  RootCauseResult[],
): string[] {
  // A concept X blocks Y if X appears as a root cause for Y's failure node
  const downstream: string[] = []
  for (const result of rootCauses) {
    const isRoot = result.root_causes.some(c => c.name === conceptName)
    if (isRoot) downstream.push(result.failing_topic_name)
  }
  return [...new Set(downstream)].slice(0, 5)
}

function inferSubjectFromNodeId(nodeId: string): string {
  const lower = nodeId.toLowerCase()
  if (lower.includes('math') || lower.includes('algebra') || lower.includes('geometry')) return 'mathematics'
  if (lower.includes('science') || lower.includes('biology') || lower.includes('physics')) return 'integrated_science'
  if (lower.includes('english') || lower.includes('grammar') || lower.includes('reading')) return 'english'
  if (lower.includes('kiswahili')) return 'kiswahili'
  if (lower.includes('social') || lower.includes('history') || lower.includes('geography')) return 'social_studies'
  if (lower.includes('art') || lower.includes('music') || lower.includes('creative')) return 'creative_arts'
  return 'general'
}

function formatSubjectLabel(subject: string): string {
  return subject.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase())
}

function inferPathwayRelevance(subject: string): string {
  const map: Record<string, string> = {
    mathematics:        'STEM',
    integrated_science: 'STEM',
    social_studies:     'Social Sciences',
    creative_arts:      'Arts & Sports',
    pre_technical:      'Technical / TVET',
    english:            'All pathways',
    kiswahili:          'All pathways',
  }
  return map[subject] ?? 'General'
}

function buildFocusSummary(steps: LearningPathStep[], readinessScore: number): string {
  if (steps.length === 0) return 'Learner is on track — maintain current engagement'
  const top = steps[0]
  if (readinessScore < 30) return `Priority: address foundational gap in ${top.concept} — this unlocks ${top.blocks_concepts.length} downstream topics`
  if (readinessScore < 60) return `Focus on resolving ${top.concept} and ${steps[1]?.concept ?? 'next topic'} to reach grade-level readiness`
  return `Minor gaps remain in ${top.concept} — learner is close to grade-level readiness`
}
