// lib/eils/continuousLearning.ts
// Layer 10 — Continuous Learning Loop
//
// The feedback loop closer. After every learner interaction:
//
//   1. Emit an EILS event to the unified stream
//   2. Trigger the appropriate learner model update
//   3. Recompute next best actions
//   4. Check if any active interventions have been resolved
//   5. Detect and record breakthrough milestones
//   6. Queue notifications for unnotified milestones
//
// This is the heartbeat of EILS. Every significant event flows through here.
// Without this, the intelligence is static. With it, it never stops improving.

import { createServiceClient } from '@/utils/supabase/service'
import {
  updateFromAssessment,
  updateFromCompass,
  updateFromFormativeSignal,
  updateFromParentObservation,
} from '@/lib/learnerModel/updater'
import { getOrCreateLearnerProfile } from '@/lib/learnerModel/queries'
import { computeNextBestActions } from './nextAction'
import { detectAndRecordCareerMilestones } from './careerIntelligence'
import type {
  EILSEventType,
  EILSEventSource,
  EILSIntervention,
  InterventionOutcome,
} from './types'

// ── Emit EILS Event ───────────────────────────────────────────────────────────

export async function emitEvent(
  studentId:  string,
  eventType:  EILSEventType,
  source:     EILSEventSource,
  payload:    Record<string, unknown>,
): Promise<void> {
  const db = createServiceClient()
  await db.from('eils_events').insert({
    student_id: studentId,
    event_type: eventType,
    source,
    payload,
    processed:  false,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  })
}

// ── After Assessment ──────────────────────────────────────────────────────────
// The most data-rich event. Triggers the full update pipeline.

export async function afterAssessment(params: {
  studentId:     string
  studentName:   string
  assessmentId:  string
  subjectScores: Record<string, number>   // subject → CBC level 1–4
  subjectMarks:  Record<string, number>   // subject → raw marks 0–100
  strand:        string
  subStrand:     string
  subject:       string
  term:          number
  year:          number
  assessedAt:    string
  rootCause?:    string
}): Promise<void> {
  const db = createServiceClient()

  // 1. Update learner model (this triggers risk recomputation, capability update, etc.)
  await updateFromAssessment({
    studentId:     params.studentId,
    studentName:   params.studentName,
    subjectScores: params.subjectScores,
    subjectMarks:  params.subjectMarks,
    strand:        params.strand,
    subStrand:     params.subStrand,
    subject:       params.subject,
    term:          params.term,
    year:          params.year,
    assessedAt:    params.assessedAt,
    rootCause:     params.rootCause,
  })

  // 2. Emit EILS event
  void emitEvent(params.studentId, 'assessment.completed', 'assessmentPipeline', {
    assessment_id:  params.assessmentId,
    subject:        params.subject,
    subject_scores: params.subjectScores,
    term:           params.term,
    year:           params.year,
  })

  // 3. Recompute next best actions
  void computeNextBestActions(params.studentId, 'assessment').catch(() => {})

  // 4. Check career milestones
  const profile = await getOrCreateLearnerProfile(params.studentId)
  void detectAndRecordCareerMilestones(params.studentId, profile, db).catch(() => {})

  // 5. Check if any active interventions are now resolved
  void checkInterventionOutcomes(params.studentId, db).catch(() => {})

  // 6. Detect term breakthrough milestone
  void detectTermBreakthrough(params.studentId, profile, db).catch(() => {})
}

// ── After Compass Session ─────────────────────────────────────────────────────

export async function afterCompassSession(params: {
  studentId:         string
  topic:             string
  subject:           string
  masteredConcepts:  string[]
  sessionMins:       number
  completedAt:       string
  mode?:             'school' | 'holiday'
  reason?:           'teacher_recommendation' | 'weakest_gap' | 'rotation' | 'holiday_plan'
  consecutiveRight?: number
  consecutiveWrong?: number
  sessionAbandoned?: boolean
}): Promise<void> {
  const db = createServiceClient()

  // 1. Update learner model
  await updateFromCompass({
    studentId:         params.studentId,
    topic:             params.topic,
    subject:           params.subject,
    masteredConcepts:  params.masteredConcepts,
    sessionMins:       params.sessionMins,
    completedAt:       params.completedAt,
    mode:              params.mode,
    reason:            params.reason,
    consecutiveRight:  params.consecutiveRight,
    consecutiveWrong:  params.consecutiveWrong,
    sessionAbandoned:  params.sessionAbandoned,
  })

  // 2. Emit event
  void emitEvent(params.studentId, 'compass.session_ended', 'compass', {
    topic:            params.topic,
    subject:          params.subject,
    mastered_count:   params.masteredConcepts.length,
    session_mins:     params.sessionMins,
    session_mode:     params.mode ?? 'school',
    abandoned:        params.sessionAbandoned ?? false,
  })

  // 3. Recompute next best actions (compass sessions may resolve gap recommendations)
  void computeNextBestActions(params.studentId, 'compass').catch(() => {})

  // 4. Check if compass session resolved a compass_assignment intervention
  if (params.masteredConcepts.length > 0) {
    void checkCompassInterventionResolution(params.studentId, params.masteredConcepts, db).catch(() => {})
  }
}

// ── After Formative Signal ────────────────────────────────────────────────────

export async function afterFormativeSignal(params: {
  studentId:  string
  classId:    string
  subject:    string
  substrand?: string
  outcome:    'got_it' | 'confused' | 'lost'
  recordedAt: string
}): Promise<void> {
  await updateFromFormativeSignal(params.studentId, {
    class_id:    params.classId,
    subject:     params.subject,
    substrand:   params.substrand,
    outcome:     params.outcome,
    recorded_at: params.recordedAt,
  })

  void emitEvent(params.studentId, 'formative.recorded', 'formativeSignal', {
    subject:    params.subject,
    substrand:  params.substrand,
    outcome:    params.outcome,
    class_id:   params.classId,
  })

  if (params.outcome === 'lost') {
    void computeNextBestActions(params.studentId, 'formative').catch(() => {})
  }
}

// ── After Parent Observation ──────────────────────────────────────────────────

export async function afterParentObservation(params: {
  studentId:  string
  substrand:  string
  outcome:    'demonstrated' | 'struggled' | 'not_attempted'
  weekOf:     string
  recordedAt: string
}): Promise<void> {
  await updateFromParentObservation({
    studentId:   params.studentId,
    substrand:   params.substrand,
    outcome:     params.outcome,
    weekOf:      params.weekOf,
    recordedAt:  params.recordedAt,
  })

  void emitEvent(params.studentId, 'parent.observation', 'parentPulse', {
    substrand: params.substrand,
    outcome:   params.outcome,
    week_of:   params.weekOf,
  })

  if (params.outcome === 'struggled') {
    void computeNextBestActions(params.studentId, 'parent').catch(() => {})
  }
}

// ── After Remedial Plan Started ───────────────────────────────────────────────

export async function afterRemedialPlanStarted(params: {
  studentId:             string
  teacherId:             string
  riskFlagType:          string
  subject:               string
  substrand:             string
  interventionRef:       string
  consecutiveWeeksBefore: number
}): Promise<void> {
  const db = createServiceClient()

  // Record the intervention in EILS tracking
  await db.from('eils_interventions').insert({
    student_id:               params.studentId,
    risk_flag_type:           params.riskFlagType,
    subject:                  params.subject,
    substrand:                params.substrand,
    intervention_type:        'remedial_plan',
    intervention_ref:         params.interventionRef,
    teacher_id:               params.teacherId,
    started_at:               new Date().toISOString(),
    outcome:                  'pending',
    consecutive_weeks_before: params.consecutiveWeeksBefore,
    created_at:               new Date().toISOString(),
    updated_at:               new Date().toISOString(),
  })

  void emitEvent(params.studentId, 'remedial.started', 'remedialPlanner', {
    subject:    params.subject,
    substrand:  params.substrand,
    teacher_id: params.teacherId,
  })
}

// ── After Remedial Plan Completed ─────────────────────────────────────────────

export async function afterRemedialPlanCompleted(params: {
  studentId:      string
  interventionId: string
  outcome:        InterventionOutcome
  outcomeNote?:   string
}): Promise<void> {
  const db  = createServiceClient()
  const now = new Date().toISOString()

  await db
    .from('eils_interventions')
    .update({
      resolved_at:      now,
      outcome:          params.outcome,
      outcome_evidence: params.outcomeNote ? { note: params.outcomeNote } : null,
      was_effective:    params.outcome === 'resolved' || params.outcome === 'partial',
      updated_at:       now,
    })
    .eq('id', params.interventionId)
    .eq('student_id', params.studentId)

  void emitEvent(params.studentId, 'remedial.completed', 'remedialPlanner', {
    intervention_id: params.interventionId,
    outcome:         params.outcome,
  })

  // Recompute next actions after remediation
  void computeNextBestActions(params.studentId, 'periodic').catch(() => {})
}

// ── Intervention Outcome Checking ─────────────────────────────────────────────
// After each assessment: check if active interventions targeting the assessed
// substrands have now been resolved (i.e., the student passed).

async function checkInterventionOutcomes(
  studentId: string,
  db:        ReturnType<typeof createServiceClient>,
): Promise<void> {
  const profile = await getOrCreateLearnerProfile(studentId)

  const { data: activeInterventions } = await db
    .from('eils_interventions')
    .select('id, substrand, risk_flag_type')
    .eq('student_id', studentId)
    .is('resolved_at', null)

  if (!activeInterventions?.length) return

  const now = new Date().toISOString()

  for (const intervention of activeInterventions) {
    const substrand = intervention.substrand as string | null
    if (!substrand) continue

    // Check if the substrand is now at Level 3+ in knowledge state
    const masteryEntries = Object.entries(profile.knowledge_state)
      .filter(([k]) => k.endsWith(':' + substrand))

    const resolved = masteryEntries.some(([, m]) => m.level >= 3)

    if (resolved) {
      await db
        .from('eils_interventions')
        .update({
          resolved_at:   now,
          outcome:       'resolved',
          was_effective: true,
          updated_at:    now,
        })
        .eq('id', intervention.id)
    }
  }
}

// ── Compass Intervention Resolution ──────────────────────────────────────────

async function checkCompassInterventionResolution(
  studentId:       string,
  masteredConcepts: string[],
  db:              ReturnType<typeof createServiceClient>,
): Promise<void> {
  if (!masteredConcepts.length) return

  const { data: active } = await db
    .from('eils_interventions')
    .select('id, substrand')
    .eq('student_id', studentId)
    .eq('intervention_type', 'compass_assignment')
    .is('resolved_at', null)

  if (!active?.length) return

  const now = new Date().toISOString()

  for (const intervention of active) {
    const substrand = intervention.substrand as string
    if (masteredConcepts.some(c => c === substrand || c.includes(substrand))) {
      await db
        .from('eils_interventions')
        .update({
          resolved_at:   now,
          outcome:       'resolved',
          was_effective: true,
          updated_at:    now,
        })
        .eq('id', intervention.id)
    }
  }
}

// ── Term Breakthrough Detection ───────────────────────────────────────────────
// If 3+ growth milestones have occurred in the current term, record a
// 'term_breakthrough' EILS milestone — a celebration moment.

async function detectTermBreakthrough(
  studentId: string,
  profile:   Awaited<ReturnType<typeof getOrCreateLearnerProfile>>,
  db:        ReturnType<typeof createServiceClient>,
): Promise<void> {
  const currentYear  = new Date().getFullYear()
  const termStart    = getTermStart()

  const termMilestones = profile.growth_milestones.filter(m =>
    m.achieved_at >= termStart && m.achieved_at.startsWith(String(currentYear))
  )

  if (termMilestones.length < 3) return

  // Check if we already recorded a term_breakthrough for this term
  const { data: existing } = await db
    .from('eils_milestones')
    .select('id')
    .eq('student_id', studentId)
    .eq('milestone_type', 'term_breakthrough')
    .gte('achieved_at', termStart)
    .limit(1)

  if (existing?.length) return  // already recorded

  const description = termMilestones
    .slice(0, 3)
    .map(m => {
      if (m.type === 'capability_threshold') return `${m.dimension?.replace(/_/g, ' ')} grew from ${m.from_level} to ${m.to_level}`
      if (m.type === 'first_mastery') return `first mastered ${m.substrand}`
      if (m.type === 'pathway_readiness_cross') return `${m.pathway} readiness crossed ${m.to_level}`
      return m.type.replace(/_/g, ' ')
    })
    .join(', ')

  await db.from('eils_milestones').insert({
    student_id:       studentId,
    milestone_type:   'term_breakthrough',
    title:            `Outstanding term — ${termMilestones.length} milestones achieved`,
    description:      `This learner has had a breakthrough term: ${description}. This deserves celebration.`,
    evidence:         { milestone_count: termMilestones.length, term_start: termStart },
    celebrated:       false,
    notified_teacher: false,
    notified_parent:  false,
    achieved_at:      new Date().toISOString(),
    created_at:       new Date().toISOString(),
    updated_at:       new Date().toISOString(),
  })
}

// ── Record Intervention ───────────────────────────────────────────────────────
// Generic intervention recorder — use when a teacher explicitly starts an intervention.

export async function recordIntervention(params: {
  studentId:             string
  riskFlagType:          string
  subject?:              string
  substrand?:            string
  interventionType:      EILSIntervention['intervention_type']
  interventionRef?:      string
  teacherId?:            string
  consecutiveWeeksBefore?: number
}): Promise<string> {
  const db  = createServiceClient()
  const now = new Date().toISOString()

  const { data } = await db
    .from('eils_interventions')
    .insert({
      student_id:               params.studentId,
      risk_flag_type:           params.riskFlagType,
      subject:                  params.subject ?? null,
      substrand:                params.substrand ?? null,
      intervention_type:        params.interventionType,
      intervention_ref:         params.interventionRef ?? null,
      teacher_id:               params.teacherId ?? null,
      started_at:               now,
      outcome:                  'pending',
      consecutive_weeks_before: params.consecutiveWeeksBefore ?? 0,
      created_at:               now,
      updated_at:               now,
    })
    .select('id')
    .single()

  return data?.id ?? ''
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function getTermStart(): string {
  const now   = new Date()
  const month = now.getMonth()
  let start: Date

  if (month < 4)      start = new Date(now.getFullYear(), 0, 6)   // Jan
  else if (month < 8) start = new Date(now.getFullYear(), 4, 5)   // May
  else                start = new Date(now.getFullYear(), 8, 1)   // Sep

  return start.toISOString()
}

