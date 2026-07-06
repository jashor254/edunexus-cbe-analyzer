// lib/eir/misconceptions.ts
// Pillar 1 — Misconception Discovery
//
// Automatically identifies recurring misconceptions by analysing:
//   - Confirmed gaps in the learner model (which substrands consistently fail)
//   - Risk flags (prerequisite gaps, persistent weak areas)
//   - Assessment patterns (consecutive low scores on specific substrands)
//   - KG root causes (structural misunderstandings)
//
// Builds the Misconception Library — a cross-learner aggregated view of
// which misconceptions are most common, most persistent, and hardest to correct.

import { createServiceClient } from '@/utils/supabase/service'
import { getOrCreateLearnerProfile } from '@/lib/learnerModel/queries'
import { analyseStudentRootCauses } from '@/lib/knowledgeGraph'
import type {
  EIRMisconception,
  MisconceptionType,
  MisconceptionPattern,
  MisconceptionLibrary,
} from './types'

// ── Discover and Record Misconceptions ───────────────────────────────────────
// Called by the research engine after each assessment or Compass session.

export async function discoverMisconceptions(
  studentId: string,
  grade:     number,
): Promise<EIRMisconception[]> {
  const db = createServiceClient()

  const [profile, rootCauses] = await Promise.all([
    getOrCreateLearnerProfile(studentId),
    safeRootCauses(studentId, grade),
  ])

  // Get school_id for the student
  const { data: learnerRow } = await db
    .from('learners')
    .select('school_id')
    .eq('id', studentId)
    .single()
  const schoolId: string | null = learnerRow?.school_id ?? null

  const now        = new Date().toISOString()
  const discovered: EIRMisconception[] = []

  // ── Pattern 1: Missing prerequisite flags ─────────────────────────────────
  for (const flag of profile.risk_flags.filter(f => f.type === 'missing_prerequisite')) {
    const substrand = flag.substrand ?? flag.detail ?? 'unknown'
    const existing  = await findExistingMisconception(db, studentId, substrand, 'prerequisite_gap')

    if (existing) {
      // Increment frequency
      await db
        .from('eir_misconceptions')
        .update({
          frequency_count: existing.frequency_count + 1,
          last_seen_at:    now,
          updated_at:      now,
        })
        .eq('id', existing.id)

      discovered.push({ ...existing, frequency_count: existing.frequency_count + 1, last_seen_at: now })
    } else {
      const row = await insertMisconception(db, {
        student_id:          studentId,
        school_id:           schoolId,
        grade,
        subject:             flag.subject ?? 'Unknown',
        substrand,
        misconception_type:  'prerequisite_gap',
        description:         `Prerequisite concept "${substrand}" not mastered — blocking current-grade content.`,
        root_cause:          `Student skipped or failed to consolidate "${substrand}" in a prior grade.`,
        correction_strategy: `Start with a dedicated Compass session on "${substrand}" before returning to grade-level work.`,
        first_seen_at:       now,
        last_seen_at:        now,
        evidence:            { risk_flag: flag },
      })
      if (row) discovered.push(row)
    }
  }

  // ── Pattern 2: Persistent confirmed gaps (3+ weak assessments) ────────────
  for (const substrand of profile.persistent_gaps) {
    const subject   = subjectFromKnowledgeState(profile.knowledge_state, substrand) ?? 'Unknown'
    const existing  = await findExistingMisconception(db, studentId, substrand, 'incomplete_schema')

    if (existing) {
      await db
        .from('eir_misconceptions')
        .update({
          frequency_count: existing.frequency_count + 1,
          last_seen_at:    now,
          updated_at:      now,
        })
        .eq('id', existing.id)
      discovered.push({ ...existing, frequency_count: existing.frequency_count + 1 })
    } else {
      const row = await insertMisconception(db, {
        student_id:          studentId,
        school_id:           schoolId,
        grade,
        subject,
        substrand,
        misconception_type:  'incomplete_schema',
        description:         `Persistent gap in "${substrand}" — assessed multiple times without mastery.`,
        root_cause:          `Conceptual schema for "${substrand}" is incomplete; student has surface exposure but not deep understanding.`,
        correction_strategy: `Use worked examples and Socratic questioning to surface and correct the underlying misconception.`,
        first_seen_at:       now,
        last_seen_at:        now,
        evidence:            { persistent_gap: substrand },
      })
      if (row) discovered.push(row)
    }
  }

  // ── Pattern 3: KG root causes → conceptual confusion ──────────────────────
  for (const rootCauseResult of rootCauses) {
    for (const cause of rootCauseResult.root_causes.filter(c => c.cause_type === 'root')) {
      const existing = await findExistingMisconception(db, studentId, cause.name, 'conceptual_confusion')

      if (existing) {
        await db
          .from('eir_misconceptions')
          .update({
            frequency_count: existing.frequency_count + 1,
            last_seen_at:    now,
            updated_at:      now,
          })
          .eq('id', existing.id)
        discovered.push({ ...existing, frequency_count: existing.frequency_count + 1 })
      } else {
        const row = await insertMisconception(db, {
          student_id:          studentId,
          school_id:           schoolId,
          grade,
          subject:             rootCauseResult.subject,
          substrand:           cause.name,
          misconception_type:  'conceptual_confusion',
          description:         `Knowledge Graph identifies "${cause.name}" (depth ${cause.depth}) as a root cause of failures in ${rootCauseResult.failing_topic_name}.`,
          root_cause:          `The concept "${cause.name}" in ${cause.strand} was not fully understood, causing cascading failures in dependent concepts.`,
          correction_strategy: `Re-teach "${cause.name}" with concrete examples before progressing to ${rootCauseResult.failing_topic_name}.`,
          first_seen_at:       now,
          last_seen_at:        now,
          evidence:            { kg_cause: cause, affected_substrands: rootCauseResult.intervention_chains },
        })
        if (row) discovered.push(row)
      }
    }
  }

  return discovered
}

// ── Mark Misconception Resolved ───────────────────────────────────────────────
// Called when a substrand reaches mastery level 3+.

export async function markMisconceptionResolved(
  studentId:  string,
  substrand:  string,
  strategy:   string,
  wasEffective: boolean,
): Promise<void> {
  const db  = createServiceClient()
  const now = new Date().toISOString()

  await db
    .from('eir_misconceptions')
    .update({
      resolved_at:              now,
      correction_effectiveness: wasEffective ? 'effective' : 'partial',
      correction_strategy:      strategy,
      updated_at:               now,
    })
    .eq('student_id', studentId)
    .eq('substrand', substrand)
    .is('resolved_at', null)
}

// ── Build Misconception Library (school or system-wide) ───────────────────────
// Aggregates patterns across all students to produce the research library.

export async function buildMisconceptionLibrary(
  schoolId?: string,
): Promise<MisconceptionLibrary> {
  const db = createServiceClient()

  let query = db
    .from('eir_misconceptions')
    .select(
      'subject, substrand, misconception_type, description, ' +
      'frequency_count, resolved_at, correction_strategy, correction_effectiveness, ' +
      'first_seen_at, last_seen_at'
    )

  if (schoolId) {
    query = query.eq('school_id', schoolId)
  }

  const { data: rawData } = await query
  const data = rawData as unknown as Array<{
    subject: string; substrand: string; misconception_type: string
    description: string; frequency_count: number; resolved_at: string | null
    correction_strategy: string | null; correction_effectiveness: string | null
    first_seen_at: string; last_seen_at: string
  }> | null

  if (!data?.length) {
    return emptyLibrary()
  }

  // Aggregate by subject + substrand + type
  const patternMap = new Map<string, {
    subject: string; substrand: string; type: MisconceptionType
    description: string; total: number; resolved: number; daysList: number[]
    strategies: string[]
  }>()

  for (const row of data) {
    const key = `${row.subject}|${row.substrand}|${row.misconception_type}`
    const existing = patternMap.get(key)

    const days = row.resolved_at
      ? Math.ceil((new Date(row.resolved_at).getTime() - new Date(row.first_seen_at).getTime()) / 86400000)
      : null

    if (existing) {
      existing.total    += row.frequency_count as number
      existing.resolved += row.resolved_at ? 1 : 0
      if (days !== null) existing.daysList.push(days)
      if (row.correction_strategy) existing.strategies.push(row.correction_strategy as string)
    } else {
      patternMap.set(key, {
        subject:     row.subject as string,
        substrand:   row.substrand as string,
        type:        row.misconception_type as MisconceptionType,
        description: row.description as string,
        total:       row.frequency_count as number,
        resolved:    row.resolved_at ? 1 : 0,
        daysList:    days !== null ? [days] : [],
        strategies:  row.correction_strategy ? [row.correction_strategy as string] : [],
      })
    }
  }

  const patterns: MisconceptionPattern[] = Array.from(patternMap.values()).map(p => ({
    subject:               p.subject,
    substrand:             p.substrand,
    misconception_type:    p.type,
    description:           p.description,
    student_count:         1,   // simplified — full impl would count distinct student_id
    frequency:             p.total,
    resolution_rate:       p.total > 0 ? p.resolved / p.total : 0,
    avg_days_to_resolve:   p.daysList.length ? avg(p.daysList) : null,
    most_effective_correction: p.strategies[0] ?? null,
  }))

  const bySubject: Record<string, MisconceptionPattern[]> = {}
  for (const p of patterns) {
    if (!bySubject[p.subject]) bySubject[p.subject] = []
    bySubject[p.subject].push(p)
  }

  return {
    total_patterns:    patterns.length,
    by_subject:        bySubject,
    most_persistent:   [...patterns].sort((a, b) => a.resolution_rate - b.resolution_rate).slice(0, 5),
    highest_frequency: [...patterns].sort((a, b) => b.frequency - a.frequency).slice(0, 5),
    hardest_to_correct: [...patterns]
      .filter(p => p.avg_days_to_resolve !== null)
      .sort((a, b) => (b.avg_days_to_resolve ?? 0) - (a.avg_days_to_resolve ?? 0))
      .slice(0, 5),
    recently_resolved: [...patterns].filter(p => p.resolution_rate > 0.8).slice(0, 5),
    generated_at:      new Date().toISOString(),
  }
}

// ── Helpers ───────────────────────────────────────────────────────────────────

async function findExistingMisconception(
  db:               ReturnType<typeof createServiceClient>,
  studentId:        string,
  substrand:        string,
  misconceptionType: MisconceptionType,
): Promise<EIRMisconception | null> {
  const { data } = await db
    .from('eir_misconceptions')
    .select('id, frequency_count, last_seen_at, correction_effectiveness, subject')
    .eq('student_id', studentId)
    .eq('substrand', substrand)
    .eq('misconception_type', misconceptionType)
    .is('resolved_at', null)
    .limit(1)
    .single()

  return data as EIRMisconception | null
}

async function insertMisconception(
  db:     ReturnType<typeof createServiceClient>,
  params: {
    student_id: string; school_id: string | null; grade: number
    subject: string; substrand: string; misconception_type: MisconceptionType
    description: string; root_cause: string; correction_strategy: string
    first_seen_at: string; last_seen_at: string; evidence: Record<string, unknown>
  },
): Promise<EIRMisconception | null> {
  const { data } = await db
    .from('eir_misconceptions')
    .insert({
      ...params,
      frequency_count: 1,
      created_at:      new Date().toISOString(),
      updated_at:      new Date().toISOString(),
    })
    .select()
    .single()

  return data as EIRMisconception | null
}

function subjectFromKnowledgeState(
  state:     Record<string, { level: number; assessment_count: number }>,
  substrand: string,
): string | null {
  const key = Object.keys(state).find(k => k.endsWith(':' + substrand))
  return key ? key.split(':')[0] : null
}

async function safeRootCauses(
  studentId: string,
  grade:     number,
): Promise<Awaited<ReturnType<typeof analyseStudentRootCauses>>> {
  try {
    return await analyseStudentRootCauses(studentId, grade)
  } catch {
    return []
  }
}

function avg(nums: number[]): number {
  return nums.length ? nums.reduce((s, n) => s + n, 0) / nums.length : 0
}

function emptyLibrary(): MisconceptionLibrary {
  return {
    total_patterns:    0,
    by_subject:        {},
    most_persistent:   [],
    highest_frequency: [],
    hardest_to_correct: [],
    recently_resolved: [],
    generated_at:      new Date().toISOString(),
  }
}
