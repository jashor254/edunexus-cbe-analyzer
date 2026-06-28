// lib/learnerModel/updater.ts
// The Intelligence Bridge — connects every data event to the Learner Model.
//
// Called after: assessment processed, compass session ended, formative signal
//               recorded, parent observation received, academy mission completed.
//
// EIOS Principle: every interaction must either update the model, read from it,
// validate it, or improve confidence in it. This file is where it updates.

import { createServiceClient } from '@/utils/supabase/service'
import { extractCapabilityProfile } from '@/lib/career/capabilityExtractor'
import {
  getOrCreateLearnerProfile,
  patchKnowledgeState,
  patchCapabilityDimensions,
  patchCareerSignals,
  patchEngagementPatterns,
  patchLearningBehaviour,
  patchPathwayReadiness,
  addFormativeSignal,
  addParentObservation,
  addGrowthMilestone,
  updateRiskProfile,
  updateConfirmedGaps,
  markAssessmentDate,
} from './queries'
import type {
  RiskFlag, RiskHistoryRecord, RiskLevel, RiskFlagType,
  SubstrandMastery, FormativeSignalSnapshot,
  GrowthMilestone, MilestoneType, BehaviourMetric,
  LearningBehaviour, ParentObservation, ParentObservationOutcome,
  CapabilityLevel, PathwayReadiness,
} from './types'

// ── Assessment → Learner Model ────────────────────────────────────────────────

type AssessmentSignal = {
  studentId:     string
  studentName:   string
  subjectScores: Record<string, number>   // subject → CBC level 1–4
  subjectMarks:  Record<string, number>   // subject → raw marks 0–100
  strand:        string
  subStrand:     string
  subject:       string
  term:          number
  year:          number
  assessedAt:    string
  rootCause?:    string
}

export async function updateFromAssessment(signal: AssessmentSignal): Promise<void> {
  const db = createServiceClient()

  // 1. Update knowledge state for this substrand
  const key   = `${signal.subject}:${signal.subStrand}`
  const level = computeCBCLevel(signal.subjectMarks[signal.subject] ?? 0)
  const now   = new Date().toISOString()

  const profile = await getOrCreateLearnerProfile(signal.studentId)
  const existing = profile.knowledge_state[key]

  const substrandMastery: SubstrandMastery = {
    level,
    confidence:       level >= 3 ? 'high' : level === 2 ? 'medium' : 'low',
    source:           'assessment',
    assessment_count: existing ? existing.assessment_count + 1 : 1,
    root_cause:       level <= 2 ? (signal.rootCause ?? undefined) : undefined,
    last_updated:     signal.assessedAt,
    last_validated:   signal.assessedAt,
    validation_count: existing ? existing.validation_count + 1 : 1,
  }

  await patchKnowledgeState(signal.studentId, { [key]: substrandMastery })

  // 2. Update confirmed/persistent gaps
  await recomputeConfirmedGaps(signal.studentId)

  // 3. Compute capability profile from full assessment history
  const { data: allHistory } = await db
    .from('strand_assessments')
    .select('subject_scores')
    .eq('student_id', signal.studentId)
    .order('created_at', { ascending: true })

  const scoreHistory = (allHistory ?? [])
    .filter(r => r.subject_scores && typeof r.subject_scores === 'object')
    .map(r => r.subject_scores as Record<string, number>)

  const currentScores = { ...signal.subjectScores }
  if (!scoreHistory.length || JSON.stringify(scoreHistory[scoreHistory.length - 1]) !== JSON.stringify(currentScores)) {
    scoreHistory.push(currentScores)
  }

  if (scoreHistory.length > 0) {
    try {
      const prevDimensions = profile.capability_dimensions as Record<string, { level?: string; raw_score?: number }>
      const capabilityProfile = extractCapabilityProfile(scoreHistory)

      const newDimensions = {
        analytical_reasoning: { ...capabilityProfile.analytical_reasoning, last_computed: now, previous_level: prevDimensions.analytical_reasoning?.level },
        communication:        { ...capabilityProfile.communication,        last_computed: now, previous_level: prevDimensions.communication?.level },
        creative_thinking:    { ...capabilityProfile.creative_thinking,    last_computed: now, previous_level: prevDimensions.creative_thinking?.level },
        technical_aptitude:   { ...capabilityProfile.technical_aptitude,   last_computed: now, previous_level: prevDimensions.technical_aptitude?.level },
        social_intelligence:  { ...capabilityProfile.social_intelligence,  last_computed: now, previous_level: prevDimensions.social_intelligence?.level },
        resilience:           { ...capabilityProfile.resilience,           last_computed: now, previous_level: prevDimensions.resilience?.level },
      }

      await patchCapabilityDimensions(signal.studentId, newDimensions)

      // Snapshot to capability_history for trend analysis
      await db.from('capability_history').insert({
        student_id:         signal.studentId,
        capability_profile: capabilityProfile,
        assessment_count:   scoreHistory.length,
        computed_at:        now,
      })

      // Detect capability threshold crossings → growth milestones
      await detectCapabilityMilestones(
        signal.studentId,
        prevDimensions,
        newDimensions,
      )
    } catch {
      // Non-fatal — capability computation failed; knowledge state still updated
    }
  }

  // 4. Refresh career signals and pathway readiness
  await refreshCareerSignals(signal.studentId)
  await refreshPathwayReadiness(signal.studentId, signal.subjectScores)

  // 5. Mark assessment date
  await markAssessmentDate(signal.studentId, signal.assessedAt, signal.term, signal.year)

  // 6. Re-compute risk flags (includes prerequisite gap check)
  await recomputeRiskFlags(signal.studentId)
}

// ── Compass Session → Learner Model ──────────────────────────────────────────

type CompassSignal = {
  studentId:          string
  topic:              string
  subject:            string
  masteredConcepts:   string[]
  sessionMins:        number
  completedAt:        string
  mode:               'school' | 'holiday'
  reason:             'teacher_recommendation' | 'weakest_gap' | 'rotation' | 'holiday_plan'
  consecutiveRight:   number   // from session_state — persistence signal
  consecutiveWrong:   number   // from session_state — confidence signal
  sessionAbandoned:   boolean
}

export async function updateFromCompass(signal: CompassSignal): Promise<void> {
  const profile = await getOrCreateLearnerProfile(signal.studentId)
  const existing = profile.engagement_patterns as Record<string, unknown>

  const explored = (existing.compass_topics_explored as string[] ?? [])
  if (!explored.includes(signal.topic)) explored.unshift(signal.topic)

  await patchEngagementPatterns(signal.studentId, {
    compass_topics_explored: explored.slice(0, 50),
    sessions_last_30_days:   ((existing.sessions_last_30_days as number) ?? 0) + 1,
    avg_session_mins:        signal.sessionMins,
    last_active:             signal.completedAt,
  })

  // Update knowledge state for mastered concepts
  for (const concept of signal.masteredConcepts) {
    const key = `${signal.subject}:${concept}`
    const existingEntry = profile.knowledge_state[key]
    await patchKnowledgeState(signal.studentId, {
      [key]: {
        level:            3,
        confidence:       'medium',
        source:           'compass',
        assessment_count: existingEntry ? existingEntry.assessment_count : 1,
        last_updated:     signal.completedAt,
        last_validated:   signal.completedAt,
        validation_count: existingEntry ? existingEntry.validation_count + 1 : 1,
      },
    })

    // First mastery milestone — if this substrand was never at Level 3+ before
    if (!existingEntry || existingEntry.level < 3) {
      await addGrowthMilestone(signal.studentId, {
        type:         'first_mastery',
        substrand:    concept,
        from_level:   String(existingEntry?.level ?? 1),
        to_level:     '3',
        achieved_at:  signal.completedAt,
        notified:     false,
      })
    }
  }

  // Update learning behaviour from session data
  await updateBehaviourFromCompass(signal.studentId, signal, profile.learning_behaviour)

  // Disengagement risk may resolve
  await recomputeRiskFlags(signal.studentId)
}

async function updateBehaviourFromCompass(
  studentId:  string,
  signal:     CompassSignal,
  current:    LearningBehaviour,
): Promise<void> {
  const now = new Date().toISOString()

  // Persistence: high consecutiveWrong before completion = persistence
  const persistenceSignal = signal.sessionAbandoned
    ? 0.0   // abandoned = low persistence
    : signal.consecutiveWrong >= 3
      ? 0.8  // pushed through difficulty = high persistence
      : 0.5  // normal

  // Confidence: correct after wrong = recovering confidence
  const confidenceSignal = signal.consecutiveRight > signal.consecutiveWrong
    ? 0.7
    : signal.consecutiveRight < signal.consecutiveWrong
      ? 0.3
      : 0.5

  // Velocity: concepts mastered per hour
  const velocitySignal = signal.sessionMins > 0
    ? Math.min(1.0, (signal.masteredConcepts.length / signal.sessionMins) * 10)
    : 0.5

  // Help-seeking: self-initiated (weakest_gap) vs. assigned (teacher_recommendation)
  const helpSeekingSignal = signal.reason === 'weakest_gap' ? 0.8 : 0.5

  const newBehaviour: Partial<LearningBehaviour> = {
    persistence:  updateMetric(current.persistence,  persistenceSignal,  now),
    confidence:   updateMetric(current.confidence,   confidenceSignal,   now),
    velocity:     updateMetric(current.velocity,     velocitySignal,     now),
    help_seeking: updateMetric(current.help_seeking, helpSeekingSignal,  now),
  }

  await patchLearningBehaviour(studentId, newBehaviour)
}

// ── Formative Signal → Learner Model ─────────────────────────────────────────

export async function updateFromFormativeSignal(
  studentId: string,
  signal:    FormativeSignalSnapshot,
): Promise<void> {
  await addFormativeSignal(studentId, signal)

  // got_it validates the substrand's knowledge state from a different source
  if (signal.outcome === 'got_it' && signal.substrand) {
    const profile = await getOrCreateLearnerProfile(studentId)
    const key     = `${signal.subject}:${signal.substrand}`
    const existing = profile.knowledge_state[key]
    if (existing) {
      // Formative confirmation increases validation_count and may improve confidence
      await patchKnowledgeState(studentId, {
        [key]: {
          ...existing,
          source:           existing.source === 'assessment' ? 'assessment' : 'formative',
          confidence:       existing.level >= 3 ? 'high' : 'medium',
          last_validated:   signal.recorded_at,
          validation_count: existing.validation_count + 1,
        },
      })
    }
  }

  // 'lost' triggers risk recomputation; also updates behaviour confidence signal
  if (signal.outcome === 'lost') {
    const profile = await getOrCreateLearnerProfile(studentId)
    await patchLearningBehaviour(studentId, {
      confidence: updateMetric(profile.learning_behaviour.confidence, 0.3, signal.recorded_at),
    })
    await recomputeRiskFlags(studentId)
  }
}

// ── Parent Observation → Learner Model ───────────────────────────────────────

type ParentObservationInput = {
  studentId:   string
  substrand:   string
  outcome:     ParentObservationOutcome
  weekOf:      string
  recordedAt:  string
}

export async function updateFromParentObservation(input: ParentObservationInput): Promise<void> {
  const observation: ParentObservation = {
    substrand:   input.substrand,
    outcome:     input.outcome,
    week_of:     input.weekOf,
    source:      'whatsapp_reply',
    confidence:  0.6,   // lower than assessment (1.0) but higher than inferred (0.3)
    recorded_at: input.recordedAt,
  }

  await addParentObservation(input.studentId, observation)

  const profile = await getOrCreateLearnerProfile(input.studentId)

  // 'demonstrated': parent confirms understanding — update knowledge state
  if (input.outcome === 'demonstrated') {
    const subjects = ['mathematics', 'english', 'kiswahili', 'integrated_science',
                      'social_studies', 'creative_arts', 'pre_technical']
    for (const subject of subjects) {
      const key = `${subject}:${input.substrand}`
      if (profile.knowledge_state[key]) {
        const existing = profile.knowledge_state[key]
        await patchKnowledgeState(input.studentId, {
          [key]: {
            ...existing,
            source:           'parent' as const,
            last_validated:   input.recordedAt,
            validation_count: existing.validation_count + 1,
            confidence:       existing.level >= 3 ? 'high' : 'medium',
          },
        })
        break
      }
    }
  }

  // 'struggled': check for double-confirmed gap (teacher 'lost' + parent 'struggled')
  if (input.outcome === 'struggled') {
    const recentTeacherLost = profile.formative_signals
      .filter(fs =>
        fs.outcome === 'lost' &&
        fs.substrand === input.substrand &&
        daysBetween(fs.recorded_at, input.recordedAt) <= 7
      )

    if (recentTeacherLost.length > 0) {
      // Double-confirmed gap — elevate severity in risk flags
      const existingFlag = profile.risk_flags.find(
        f => f.substrand === input.substrand && f.type === 'multiple_weak_substrands'
      )
      if (!existingFlag) {
        // Add a high-severity flag for this specific substrand
        const updatedFlags: RiskFlag[] = [
          ...profile.risk_flags,
          {
            type:      'multiple_weak_substrands',
            substrand: input.substrand,
            detail:    `Double-confirmed gap: teacher marked as "lost" and parent confirmed "struggled" in ${input.substrand} this week`,
            severity:  'high',
            flagged_at: input.recordedAt,
          },
        ]
        const riskLevel = computeOverallRisk(updatedFlags)
        const updatedHistory = updateRiskHistory(profile.risk_history, updatedFlags)
        await updateRiskProfile(input.studentId, updatedFlags, riskLevel, updatedHistory)
      }
    }
  }
}

// ── Risk Flag Computation ─────────────────────────────────────────────────────

export async function recomputeRiskFlags(studentId: string): Promise<void> {
  const profile = await getOrCreateLearnerProfile(studentId)
  const flags: RiskFlag[] = []
  const now = new Date().toISOString()

  // Flag 1: No assessment data
  if (!profile.last_assessment_date) {
    flags.push({
      type:      'no_assessment_data',
      detail:    'No assessments recorded yet — learner profile is incomplete',
      severity:  'low',
      flagged_at: now,
    })
  }

  // Flag 2: Multiple weak substrands (Level 1 = BE)
  const weakSubstrands = Object.entries(profile.knowledge_state)
    .filter(([, m]) => m.level === 1)

  if (weakSubstrands.length >= 3) {
    flags.push({
      type:     'multiple_weak_substrands',
      detail:   `${weakSubstrands.length} substrands at BE level — intervention needed`,
      severity: weakSubstrands.length >= 5 ? 'high' : 'medium',
      flagged_at: now,
    })
  }

  // Flag 3: Declining capability dimensions
  const dims = profile.capability_dimensions as Record<string, { trend?: string; raw_score?: number }>
  const decliningDims = Object.entries(dims)
    .filter(([, d]) => d?.trend === 'declining' && (d?.raw_score ?? 1) < 0.5)

  if (decliningDims.length >= 2) {
    flags.push({
      type:     'declining_performance',
      detail:   `${decliningDims.map(([k]) => k.replace(/_/g, ' ')).join(', ')} declining`,
      severity: 'medium',
      flagged_at: now,
    })
  }

  // Flag 4: Disengaged — no activity in 21+ days
  const lastActive = (profile.engagement_patterns as Record<string, unknown>)?.last_active as string
  if (lastActive) {
    const daysSince = daysBetween(lastActive, now)
    if (daysSince > 21) {
      flags.push({
        type:     'disengaged',
        detail:   `No learning activity in ${Math.round(daysSince)} days`,
        severity: daysSince > 42 ? 'high' : 'low',
        flagged_at: now,
      })
    }
  }

  // Flag 5: Missing prerequisites (knowledge graph)
  const prerequisiteFlags = await checkPrerequisiteGaps(studentId, profile.knowledge_state)
  flags.push(...prerequisiteFlags)

  // Compute overall risk level
  const riskLevel = computeOverallRisk(flags)

  // Update risk history with persistence tracking
  const updatedHistory = updateRiskHistory(profile.risk_history, flags)

  // Detect risk escalation milestone (new at_risk/critical status)
  if (profile.overall_risk_level === 'normal' && (riskLevel === 'at_risk' || riskLevel === 'critical')) {
    // Risk escalated — no milestone needed, but risk_history will capture it
  }

  // Detect risk resolution milestone
  if ((profile.overall_risk_level === 'at_risk' || profile.overall_risk_level === 'critical')
    && riskLevel === 'normal') {
    await addGrowthMilestone(studentId, {
      type:       'risk_resolved',
      from_level: profile.overall_risk_level,
      to_level:   'normal',
      achieved_at: now,
      notified:   false,
    })
  }

  await updateRiskProfile(studentId, flags, riskLevel, updatedHistory)
}

// ── Confirmed Gaps Computation ────────────────────────────────────────────────

async function recomputeConfirmedGaps(studentId: string): Promise<void> {
  const db      = createServiceClient()
  const profile = await getOrCreateLearnerProfile(studentId)

  // A gap is confirmed when the same substrand is below Level 3 in 2+ assessments
  const confirmedGaps: string[] = []
  const persistentGaps: string[] = []

  for (const [key, mastery] of Object.entries(profile.knowledge_state)) {
    if (mastery.level <= 2 && mastery.assessment_count >= 2) {
      confirmedGaps.push(key)
    }
  }

  // Persistent gaps: confirmed in 2+ different terms
  // Check term snapshots for the same substrand being weak historically
  if (profile.term_snapshots.length >= 2) {
    const prevTerm = profile.term_snapshots[0]
    for (const gap of confirmedGaps) {
      const prevLevel = prevTerm.knowledge_summary[gap]
      if (prevLevel && prevLevel <= 2) {
        persistentGaps.push(gap)
      }
    }
  }

  await updateConfirmedGaps(studentId, confirmedGaps, persistentGaps)

  // Populate substrand_health in DB for Remedial Planner
  // Find the student's active class to link the SOW
  const { data: classEnrollment } = await db
    .from('class_students')
    .select('class_id, teacher_classes(id, teacher_id, subject, grade)')
    .eq('student_id', studentId)
    .limit(1)
    .maybeSingle()

  if (classEnrollment) {
    const cls = classEnrollment.teacher_classes as Record<string, unknown> | null
    if (!cls) return

    // Find active SOW for this class
    const { data: sow } = await db
      .from('schemes_of_work')
      .select('id')
      .eq('teacher_id', cls.teacher_id as string)
      .eq('grade', cls.grade as number)
      .eq('subject', cls.subject as string)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle()

    if (sow) {
      // Trigger substrand_health computation for each confirmed gap
      for (const gapKey of confirmedGaps.slice(0, 5)) {
        const [subject, subStrand] = gapKey.split(':')
        if (!subject || !subStrand) continue
        await db.rpc('compute_substrand_health', {
          p_sow_id:     sow.id,
          p_teacher_id: cls.teacher_id,
          p_class_id:   classEnrollment.class_id,
          p_subject:    subject,
          p_strand:     subStrand,    // approximation — strand = substrand for initial population
          p_sub_strand: subStrand,
        }).catch(() => {})  // non-fatal
      }
    }
  }
}

// ── Career Signals Refresh ────────────────────────────────────────────────────

async function refreshCareerSignals(studentId: string): Promise<void> {
  const db = createServiceClient()

  const [{ data: interests }, { data: strand }] = await Promise.all([
    db.from('student_career_interests')
      .select('career_slug, interest_level')
      .eq('student_id', studentId)
      .order('explored_at', { ascending: false })
      .limit(10),
    db.from('strand_assessments')
      .select('subject_scores')
      .eq('student_id', studentId)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle(),
  ])

  const topCareers = (interests ?? [])
    .filter(i => (i.interest_level as number) >= 3)
    .map(i => i.career_slug as string)

  const scores = (strand?.subject_scores as Record<string, number>) ?? {}
  const sorted  = Object.entries(scores).sort(([, a], [, b]) => b - a)
  const strongest = sorted.slice(0, 3).map(([s]) => s)
  const weakest   = sorted.slice(-3).map(([s]) => s)

  await patchCareerSignals(studentId, {
    top_career_slugs:   topCareers,
    strongest_subjects: strongest,
    weakest_subjects:   weakest,
    last_updated:       new Date().toISOString(),
  })
}

// ── Pathway Readiness Refresh ─────────────────────────────────────────────────
// Converts subject performance into live pathway readiness scores (0-100).
// Runs after every assessment — pathway readiness is always current.

async function refreshPathwayReadiness(
  studentId:     string,
  subjectScores: Record<string, number>,
): Promise<void> {
  const profile = await getOrCreateLearnerProfile(studentId)
  const now     = new Date().toISOString()

  // Normalise CBC levels 1-4 to 0-100
  const norm = (level: number) => Math.round(((level - 1) / 3) * 100)

  const math   = norm(subjectScores['mathematics']       ?? subjectScores['core_mathematics'] ?? 0)
  const sci    = norm(subjectScores['integrated_science'] ?? subjectScores['physics']         ?? 0)
  const eng    = norm(subjectScores['english']           ?? 0)
  const kiswah = norm(subjectScores['kiswahili']         ?? 0)
  const arts   = norm(subjectScores['creative_arts']     ?? subjectScores['art_design']       ?? 0)
  const tech   = norm(subjectScores['pre_technical']     ?? subjectScores['pre_technical_studies'] ?? 0)
  const social = norm(subjectScores['social_studies']    ?? subjectScores['history']           ?? 0)

  // Weight subject scores into pathway readiness
  const stemScore    = Math.round((math * 0.4) + (sci * 0.35) + (eng * 0.25))
  const socialScore  = Math.round((social * 0.4) + (eng * 0.3) + (kiswah * 0.3))
  const artsScore    = Math.round((arts * 0.5)  + (eng * 0.3) + (kiswah * 0.2))
  const techScore    = Math.round((tech * 0.5)  + (math * 0.3) + (sci * 0.2))

  const prev = profile.pathway_readiness

  const makeTrend = (prev: number, next: number) =>
    next > prev + 3 ? 'improving' : next < prev - 3 ? 'declining' : 'stable'

  const newReadiness: PathwayReadiness = {
    stem:            { score: stemScore,   trend: makeTrend(prev.stem.score,            stemScore),   last_updated: now },
    social_sciences: { score: socialScore, trend: makeTrend(prev.social_sciences.score, socialScore), last_updated: now },
    arts_sports:     { score: artsScore,   trend: makeTrend(prev.arts_sports.score,     artsScore),   last_updated: now },
    technical_tvet:  { score: techScore,   trend: makeTrend(prev.technical_tvet.score,  techScore),   last_updated: now },
  }

  await patchPathwayReadiness(studentId, newReadiness)

  // Check for pathway readiness milestone crossings (50% and 70% thresholds)
  const thresholds = [50, 70]
  const pathways: Array<{ key: keyof PathwayReadiness; label: string }> = [
    { key: 'stem',            label: 'STEM' },
    { key: 'social_sciences', label: 'Social Sciences' },
    { key: 'arts_sports',     label: 'Arts & Sports' },
    { key: 'technical_tvet',  label: 'Technical / TVET' },
  ]

  for (const { key, label } of pathways) {
    const prevScore = prev[key].score
    const nextScore = newReadiness[key].score
    for (const threshold of thresholds) {
      if (prevScore < threshold && nextScore >= threshold) {
        await addGrowthMilestone(studentId, {
          type:       'pathway_readiness_cross',
          pathway:    label,
          from_level: `${prevScore}%`,
          to_level:   `${nextScore}%`,
          achieved_at: now,
          notified:   false,
        })
      }
    }
  }
}

// ── Capability Milestone Detection ────────────────────────────────────────────

const CAPABILITY_LEVEL_ORDER: CapabilityLevel[] = [
  'emerging', 'developing', 'capable', 'strong', 'exceptional',
]

async function detectCapabilityMilestones(
  studentId:       string,
  prevDimensions:  Record<string, { level?: string; raw_score?: number }>,
  newDimensions:   Record<string, { level?: string; raw_score?: number }>,
): Promise<void> {
  const now = new Date().toISOString()

  for (const dim of Object.keys(newDimensions)) {
    const prevLevel = prevDimensions[dim]?.level as CapabilityLevel | undefined
    const nextLevel = newDimensions[dim]?.level as CapabilityLevel | undefined

    if (!prevLevel || !nextLevel || prevLevel === nextLevel) continue

    const prevIdx = CAPABILITY_LEVEL_ORDER.indexOf(prevLevel)
    const nextIdx = CAPABILITY_LEVEL_ORDER.indexOf(nextLevel)

    if (nextIdx > prevIdx) {
      // Upward threshold crossing — this is worth celebrating
      await addGrowthMilestone(studentId, {
        type:       'capability_threshold',
        dimension:  dim,
        from_level: prevLevel,
        to_level:   nextLevel,
        achieved_at: now,
        notified:   false,
      })
    }
  }
}

// ── Risk History Management ───────────────────────────────────────────────────

function updateRiskHistory(
  existing: RiskHistoryRecord[],
  currentFlags: RiskFlag[],
): RiskHistoryRecord[] {
  const now       = new Date().toISOString()
  const updated   = [...existing]
  const activeKeys = new Set(currentFlags.map(f => `${f.type}:${f.substrand ?? ''}`))

  // Update existing records
  for (const record of updated) {
    const key = `${record.flag_type}:${record.substrand ?? ''}`
    if (activeKeys.has(key)) {
      // Still active — update last_seen and increment consecutive_weeks
      record.last_seen = now
      record.consecutive_weeks = Math.floor(
        daysBetween(record.first_flagged, now) / 7
      ) + 1
      // Escalate peak severity if needed
      const currentFlag = currentFlags.find(f => `${f.type}:${f.substrand ?? ''}` === key)
      if (currentFlag && severityOrder(currentFlag.severity) > severityOrder(record.peak_severity)) {
        record.peak_severity = currentFlag.severity
      }
    } else if (!record.resolved_at) {
      // Was active, now resolved
      record.resolved_at = now
      record.resolution_type = inferResolutionType(record)
    }
  }

  // Add new flags not in history
  for (const flag of currentFlags) {
    const key = `${flag.type}:${flag.substrand ?? ''}`
    const alreadyTracked = existing.some(r =>
      `${r.flag_type}:${r.substrand ?? ''}` === key && !r.resolved_at
    )
    if (!alreadyTracked) {
      updated.push({
        flag_type:         flag.type as RiskFlagType,
        severity:          flag.severity,
        subject:           flag.subject,
        substrand:         flag.substrand,
        first_flagged:     now,
        last_seen:         now,
        consecutive_weeks: 0,
        peak_severity:     flag.severity,
      })
    }
  }

  return updated.slice(0, 50)  // keep last 50 records — permanent but bounded
}

// ── Prerequisite Gap Check ────────────────────────────────────────────────────

async function checkPrerequisiteGaps(
  studentId:    string,
  knowledgeState: Record<string, { level: number }>,
): Promise<RiskFlag[]> {
  const db    = createServiceClient()
  const flags: RiskFlag[] = []

  const weakKeys = Object.entries(knowledgeState)
    .filter(([, m]) => m.level <= 2)
    .map(([key]) => key.split(':')[1])
    .filter(Boolean)

  if (!weakKeys.length) return []

  const { data: weakNodes } = await db
    .from('knowledge_nodes')
    .select('id, concept')
    .in('concept', weakKeys.slice(0, 10))

  if (!weakNodes?.length) return []

  const nodeIds = weakNodes.map(n => n.id as string)
  const { data: edges } = await db
    .from('knowledge_edges')
    .select('prerequisite_node_id, dependent_node_id')
    .in('dependent_node_id', nodeIds)

  if (!edges?.length) return []

  const prereqIds = [...new Set(edges.map(e => e.prerequisite_node_id as string))]
  const { data: prereqNodes } = await db
    .from('knowledge_nodes')
    .select('id, concept')
    .in('id', prereqIds)
    .limit(3)

  for (const node of prereqNodes ?? []) {
    const concept  = node.concept as string
    const inState  = Object.keys(knowledgeState).some(k => k.endsWith(`:${concept}`))
    if (!inState) {
      flags.push({
        type:       'missing_prerequisite',
        substrand:  concept,
        detail:     `Missing prerequisite: "${concept}" — needed before current topics`,
        severity:   'high',
        flagged_at: new Date().toISOString(),
      })
    }
  }

  return flags.slice(0, 2)
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function computeCBCLevel(rawMark: number): 1 | 2 | 3 | 4 {
  if (rawMark >= 75) return 4   // EE — Exceeding Expectations
  if (rawMark >= 50) return 3   // ME — Meeting Expectations
  if (rawMark >= 25) return 2   // AE — Approaching Expectations
  return 1                       // BE — Below Expectations
}

function computeOverallRisk(flags: RiskFlag[]): RiskLevel {
  if (!flags.length) return 'normal'
  const highCount   = flags.filter(f => f.severity === 'high').length
  const mediumCount = flags.filter(f => f.severity === 'medium').length
  if (highCount >= 2)   return 'critical'
  if (highCount >= 1)   return 'at_risk'
  if (mediumCount >= 2) return 'at_risk'
  if (mediumCount >= 1) return 'watch'
  return 'watch'
}

function updateMetric(
  current:  BehaviourMetric,
  newSignal: number,
  now:      string,
): BehaviourMetric {
  // Exponential moving average — weight recent signals more heavily
  const alpha = 0.3
  const newScore  = alpha * newSignal + (1 - alpha) * current.score
  const prevScore = current.score
  return {
    score:       Math.round(newScore * 100) / 100,
    trend:       newScore > prevScore + 0.05 ? 'improving' : newScore < prevScore - 0.05 ? 'declining' : 'stable',
    data_points: current.data_points + 1,
    last_updated: now,
  }
}

function daysBetween(a: string, b: string): number {
  return Math.abs(new Date(b).getTime() - new Date(a).getTime()) / (1000 * 60 * 60 * 24)
}

function severityOrder(s: 'low' | 'medium' | 'high'): number {
  return { low: 0, medium: 1, high: 2 }[s]
}

function inferResolutionType(record: RiskHistoryRecord): RiskHistoryRecord['resolution_type'] {
  // Without explicit teacher intervention data here, infer from flag type
  if (record.flag_type === 'disengaged') return 'compass_completed'
  if (record.flag_type === 'declining_performance') return 'assessment_improved'
  if (record.flag_type === 'missing_prerequisite') return 'teacher_intervention'
  return 'natural_decay'
}
