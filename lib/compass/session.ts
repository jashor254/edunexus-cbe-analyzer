// lib/compass/session.ts
// Session lifecycle: create, rotate, expire, record.
// No AI logic — no prompts, no DeepSeek calls here.

import { createServiceClient } from '@/utils/supabase/service'

// ── Types ──────────────────────────────────────────────────────────────────────

export interface CompassSession {
  sessionId:        string
  lockedSubject:    string | null
  lockedSubstrand:  string | null
  lockedGrade:      number | null
  isRevision:       boolean
  studentGrade:     number
  overallLevel:     number
  consecutiveRight: number
  consecutiveWrong: number
  initialized:      boolean
}

export interface SessionHandle {
  sessionId: string
  isNew:     boolean
  startedAt: string
}

export interface NextSubject {
  subject:  string
  subtopic: string | null
  reason:   'teacher_recommendation' | 'weakest_gap' | 'rotation' | 'holiday_plan'
}

// ── Internal helpers ───────────────────────────────────────────────────────────

// Current DB values: 'challenge' | 'standard' | 'reinforcement' | 'remedial'
// Legacy fallback handles old 'approaching_expectations' style strings.
function tierToLevel(tier: string): 1 | 2 | 3 | 4 {
  if (tier === 'challenge'     || tier.includes('exceeding'))   return 4
  if (tier === 'standard'      || tier.includes('meeting'))     return 3
  if (tier === 'reinforcement' || tier.includes('approaching')) return 2
  return 1 // remedial or unknown
}

const PATHWAY_SUBJECTS: Record<string, string[]> = {
  'STEM':            ['mathematics', 'physics', 'chemistry', 'biology', 'geography'],
  'Social Sciences': ['history', 'geography', 'business_studies', 'economics', 'cre'],
  'Arts & Sports':   ['creative_arts', 'music', 'physical_education', 'art_design'],
}

const SESSION_TTL_MS        = 30 * 60 * 1000       // 30 min — used by isSessionExpired (client keepalive)
const SCHOOL_RESUME_MS      = 3 * 60 * 60 * 1000   // 3 h  — resume window during school day

// ── 1. getOrCreateSession ──────────────────────────────────────────────────────

export async function getOrCreateSession(
  studentId: string,
  subject:   string,
  mode:      'school' | 'holiday'
): Promise<SessionHandle> {
  const db = createServiceClient()

  // School sessions: resume any active session touched in the last 3 h AND started today.
  // Holiday sessions: 30-minute window (shorter, focused bursts).
  const resumeMs      = mode === 'school' ? SCHOOL_RESUME_MS : SESSION_TTL_MS
  const resumeCutoff  = new Date(Date.now() - resumeMs).toISOString()
  const todayStart    = new Date(new Date().setHours(0, 0, 0, 0)).toISOString()

  const { data: existing } = await db
    .from('compass_sessions')
    .select('id, created_at')
    .eq('learner_id', studentId)
    .eq('subject', subject)
    .eq('status', 'active')
    .gte('updated_at', resumeCutoff)   // last exchange was recent
    .gte('created_at', todayStart)     // started today — don't bleed across days
    .order('updated_at', { ascending: false })
    .limit(1)
    .maybeSingle()

  if (existing) {
    return {
      sessionId: existing.id as string,
      isNew:     false,
      startedAt: existing.created_at as string,
    }
  }

  const { data: created, error } = await db
    .from('compass_sessions')
    .insert({
      learner_id:     studentId,
      subject,
      mode,
      status:         'active',
      exchange_count: 0,
      session_state:  {},
    })
    .select('id, created_at')
    .single()

  if (error || !created) {
    throw new Error(`[compass/session] Failed to create session: ${error?.message ?? 'unknown'}`)
  }

  return {
    sessionId: created.id as string,
    isNew:     true,
    startedAt: created.created_at as string,
  }
}

// ── 2. shouldRestSubject ───────────────────────────────────────────────────────
// subject_rest_until is currently a single per-student field.
// The subject parameter is accepted for forward-compatibility with
// per-subject rest tracking once that column exists.

export async function shouldRestSubject(
  studentId: string,
  _subject:  string
): Promise<boolean> {
  const db = createServiceClient()

  const { data } = await db
    .from('student_learning_context')
    .select('subject_rest_until')
    .eq('student_id', studentId)
    .maybeSingle()

  const restUntil = data?.subject_rest_until as string | null
  if (!restUntil) return false

  return new Date(restUntil) > new Date()
}

// ── 3. getNextSubject ──────────────────────────────────────────────────────────

export async function getNextSubject(studentId: string): Promise<NextSubject> {
  const db = createServiceClient()

  const [contextResult, lastSessionResult] = await Promise.all([
    db.from('student_learning_context')
      .select('subject_tiers, compass_bridge, recommended_pathway, grade, session_goal')
      .eq('student_id', studentId)
      .maybeSingle(),
    db.from('compass_sessions')
      .select('subject')
      .eq('learner_id', studentId)
      .eq('status', 'active')
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle(),
  ])

  const ctx           = contextResult.data
  const subjectTiers  = (ctx?.subject_tiers   ?? {}) as Record<string, string>
  const compassBridge = (ctx?.compass_bridge  ?? {}) as Record<string, unknown>
  const pathway       = ctx?.recommended_pathway as string | null
  const grade         = (ctx?.grade as number | null) ?? 7
  const isSenior      = grade >= 10
  const lastSubject   = lastSessionResult.data?.subject as string | null

  // a) Teacher recommendation — highest priority
  if (compassBridge.teacherSuggested && compassBridge.firstSubject) {
    return {
      subject:  compassBridge.firstSubject as string,
      subtopic: (compassBridge.firstConcept as string | null) ?? null,
      reason:   'teacher_recommendation',
    }
  }

  // Build candidate list
  let candidates = Object.keys(subjectTiers)

  // e) Senior: restrict to pathway subjects
  if (isSenior && pathway) {
    const normPathway = pathway.replace(/\s*Science\s*$/i, '').trim()
    const pathwayKey  = Object.keys(PATHWAY_SUBJECTS).find(
      k => k.toLowerCase() === normPathway.toLowerCase()
    )
    if (pathwayKey) {
      const allowed = PATHWAY_SUBJECTS[pathwayKey]
      const filtered = candidates.filter(s =>
        allowed.some(a => s.toLowerCase().includes(a.toLowerCase()))
      )
      if (filtered.length > 0) candidates = filtered
    }
  }

  // b+c+d) Sort weakest first; skip last-session subject to avoid repetition
  const ranked = candidates
    .map(s => ({ subject: s, level: tierToLevel(subjectTiers[s] ?? '') }))
    .sort((a, b) => a.level - b.level)

  const eligible = ranked.filter(s => s.subject !== lastSubject)
  const pick     = eligible[0] ?? ranked[0] // fallback if all filtered

  if (!pick) {
    return { subject: 'mathematics', subtopic: null, reason: 'rotation' }
  }

  // Holiday plan: use session_goal as the subtopic hint when set
  const sessionGoal = (ctx?.session_goal as string | null) ?? null
  const reason: NextSubject['reason'] = sessionGoal
    ? 'holiday_plan'
    : pick.level <= 2
    ? 'weakest_gap'
    : 'rotation'

  return {
    subject:  pick.subject,
    subtopic: sessionGoal,
    reason,
  }
}

// ── 4. recordExchange ─────────────────────────────────────────────────────────

export async function recordExchange(sessionId: string): Promise<number> {
  const db = createServiceClient()

  const { data } = await db
    .from('compass_sessions')
    .select('exchange_count')
    .eq('id', sessionId)
    .maybeSingle()

  const next = ((data?.exchange_count as number | null) ?? 0) + 1

  await db
    .from('compass_sessions')
    .update({ exchange_count: next })
    .eq('id', sessionId)

  return next
}

// ── 5. isSessionExpired ───────────────────────────────────────────────────────

export function isSessionExpired(startedAt: string): boolean {
  return Date.now() - new Date(startedAt).getTime() > SESSION_TTL_MS
}

// ── Legacy: used by app/api/learn/route.ts ────────────────────────────────────

export async function readSession(
  sessionId: string,
  userId:    string
): Promise<CompassSession | null> {
  const db = createServiceClient()

  const { data } = await db
    .from('compass_sessions')
    .select('session_state')
    .eq('id', sessionId)
    .eq('learner_id', userId)
    .eq('status', 'active')
    .maybeSingle()

  if (!data?.session_state) return null

  const s = data.session_state as Record<string, unknown>

  return {
    sessionId,
    lockedSubject:    (s.lockedSubject    as string  | null) ?? null,
    lockedSubstrand:  (s.lockedSubstrand  as string  | null) ?? null,
    lockedGrade:      (s.lockedGrade      as number  | null) ?? null,
    isRevision:       (s.isRevision       as boolean)        ?? false,
    studentGrade:     (s.studentGrade     as number)         ?? 7,
    overallLevel:     (s.overallLevel     as number)         ?? 2,
    consecutiveRight: (s.consecutiveRight as number)         ?? 0,
    consecutiveWrong: (s.consecutiveWrong as number)         ?? 0,
    initialized:      (s.initialized     as boolean)        ?? false,
  }
}

export async function writeSession(
  sessionId: string,
  update:    Partial<CompassSession>
): Promise<void> {
  const db = createServiceClient()

  const { data } = await db
    .from('compass_sessions')
    .select('session_state')
    .eq('id', sessionId)
    .maybeSingle()

  const current  = (data?.session_state ?? {}) as Record<string, unknown>
  const newState = { ...current, ...update, initialized: true }

  const { error } = await db
    .from('compass_sessions')
    .update({
      session_state: newState,
      last_subject:  (update.lockedSubject as string | null) || (current.lockedSubject as string | null) || null,
      updated_at:    new Date().toISOString(),
    })
    .eq('id', sessionId)

  if (error) {
    console.error('[writeSession] FAILED:', error)
  }
}

export function resolveSubject(
  incoming: {
    lockedSubject?:  string
    sessionSubject?: string
    message:         string
  },
  savedSession: CompassSession | null
): string {
  if (incoming.lockedSubject)      return incoming.lockedSubject
  if (savedSession?.lockedSubject) return savedSession.lockedSubject
  if (incoming.sessionSubject)     return incoming.sessionSubject

  const msg = incoming.message.toLowerCase()

  const keywords: Record<string, string[]> = {
    mathematics:        ['math', 'algebra', 'fraction', 'percentage', 'geometry', 'equation', 'hesabu', 'calculate'],
    english:            ['english', 'grammar', 'essay', 'reading', 'writing', 'vocabulary'],
    kiswahili:          ['kiswahili', 'sarufi', 'insha', 'fasihi', 'ngeli'],
    biology:            ['biology', 'cell', 'plant', 'photosynthesis', 'organism'],
    chemistry:          ['chemistry', 'atom', 'reaction', 'element', 'compound'],
    physics:            ['physics', 'force', 'energy', 'electricity', 'circuit', 'motion'],
    geography:          ['geography', 'map', 'weather', 'climate', 'river', 'volcano'],
    agriculture:        ['agriculture', 'farm', 'crop', 'soil', 'harvest', 'hay', 'silage', 'forage'],
    history:            ['history', 'colonialism', 'independence', 'empire'],
    integrated_science: ['science', 'experiment', 'ecosystem', 'environment', 'solar'],
  }

  for (const [subj, words] of Object.entries(keywords)) {
    if (words.some(w => msg.includes(w))) return subj
  }

  return 'mathematics'
}
