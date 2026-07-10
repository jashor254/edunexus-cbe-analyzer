// lib/compass/session.ts
// Session lifecycle: create, rotate, expire, record.
// No AI logic — no prompts, no DeepSeek calls here.

import { repos } from '@/lib/repositories'
import { publishEvent } from '@/lib/events'

// ── Types ──────────────────────────────────────────────────────────────────────

export interface CompassSession {
  sessionId:        string
  lockedSubject:    string | null
  lockedSubstrand:  string | null
  lockedGrade:      number | null
  isRevision:       boolean
  studentGrade:     number
  overallLevel:     number
  initialized:      boolean
  masteredConcepts: string[]
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

// Canonical tier→level mapping — imported by app/api/learn/route.ts and
// app/api/learn/student/route.ts rather than redefined in each.
// Current DB values: 'challenge' | 'standard' | 'reinforcement' | 'remedial'
// Legacy fallback handles old 'approaching_expectations' style strings.
export function tierToLevel(tier: string): 1 | 2 | 3 | 4 {
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

const SESSION_TTL_MS        = 30 * 60 * 1000       // 30 min — holiday-mode resume window
const SCHOOL_RESUME_MS      = 3 * 60 * 60 * 1000   // 3 h  — resume window during school day

// ── 1. getOrCreateSession ──────────────────────────────────────────────────────

export async function getOrCreateSession(
  studentId: string,
  subject:   string,
  mode:      'school' | 'holiday'
): Promise<SessionHandle> {
  // School sessions: resume any active session touched in the last 3 h AND started today.
  // Holiday sessions: 30-minute window (shorter, focused bursts).
  const resumeMs      = mode === 'school' ? SCHOOL_RESUME_MS : SESSION_TTL_MS
  const resumeCutoff  = new Date(Date.now() - resumeMs).toISOString()
  const todayStart    = new Date(new Date().setHours(0, 0, 0, 0)).toISOString()

  const existing = await repos.compass.findResumableSession(studentId, subject, resumeCutoff, todayStart)

  if (existing) {
    return {
      sessionId: existing.id,
      isNew:     false,
      startedAt: existing.created_at,
    }
  }

  // No resumable session — close out any stale 'active' rows left behind by a
  // tab close/crash so they don't sit open forever.
  const stale = await repos.compass.findStaleActiveSessions(studentId, subject)

  if (stale.length > 0) {
    await Promise.all(
      stale.map(row => {
        const durationSeconds = Math.max(
          0,
          Math.round(
            (new Date(row.updated_at).getTime() - new Date(row.created_at).getTime()) / 1000
          )
        )
        return repos.compass.abandonSession(row.id, durationSeconds)
      })
    )
  }

  const created = await repos.compass.createSession({
    learner_id:     studentId,
    subject,
    mode,
    status:         'active',
    exchange_count: 0,
    session_state:  {},
  })

  return {
    sessionId: created.id,
    isNew:     true,
    startedAt: created.created_at,
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
  const restUntil = await repos.compass.getSubjectRestUntil(studentId)
  if (!restUntil) return false
  return new Date(restUntil) > new Date()
}

// ── 3. getNextSubject ──────────────────────────────────────────────────────────

export async function getNextSubject(studentId: string): Promise<NextSubject> {
  const [ctx, lastSubject] = await Promise.all([
    repos.compass.getStudentLearningContext(studentId),
    repos.compass.getLastActiveSessionSubject(studentId),
  ])

  const subjectTiers  = ctx?.subject_tiers  ?? {}
  const compassBridge = ctx?.compass_bridge ?? {}
  const pathway       = ctx?.recommended_pathway ?? null
  const grade         = ctx?.grade ?? 7
  const isSenior      = grade >= 10

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
  const sessionGoal = ctx?.session_goal ?? null
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
  const current = await repos.compass.getExchangeCount(sessionId)
  const next = current + 1
  await repos.compass.updateExchangeCount(sessionId, next)
  return next
}

// ── 5. endSession ──────────────────────────────────────────────────────────────

export async function endSession(
  sessionId:       string,
  learnerId:       string,
  status:          'completed' | 'abandoned',
  durationSeconds: number,
  subject?:        string,
): Promise<void> {
  const exchangeCount = await repos.compass.getExchangeCount(sessionId)
  await repos.compass.endSession(sessionId, learnerId, status, durationSeconds)

  if (status === 'completed') {
    void publishEvent({
      event_type:      'student.session.completed',
      resource_type:   'compass_session',
      resource_id:     sessionId,
      actor_id:        learnerId,
      payload: {
        session_id:       sessionId,
        student_id:       learnerId,
        subject:          subject ?? 'unknown',
        exchanges:        exchangeCount,
        duration_seconds: durationSeconds,
      },
      idempotency_key: `student.session.completed:${sessionId}`,
    }).catch(err => console.error('[events] student.session.completed:', err instanceof Error ? err.message : String(err)))
  }
}

// ── Legacy: used by app/api/learn/route.ts ────────────────────────────────────

export async function readSession(
  sessionId: string,
  userId:    string
): Promise<CompassSession | null> {
  const state = await repos.compass.findSessionState(sessionId, userId)
  if (!state) return null

  const s = state

  return {
    sessionId,
    lockedSubject:    (s.lockedSubject    as string  | null) ?? null,
    lockedSubstrand:  (s.lockedSubstrand  as string  | null) ?? null,
    lockedGrade:      (s.lockedGrade      as number  | null) ?? null,
    isRevision:       (s.isRevision       as boolean)        ?? false,
    studentGrade:     (s.studentGrade     as number)         ?? 7,
    overallLevel:     (s.overallLevel     as number)         ?? 2,
    initialized:      (s.initialized     as boolean)        ?? false,
    masteredConcepts: (s.masteredConcepts as string[] | null) ?? [],
  }
}

export async function writeSession(
  sessionId: string,
  update:    Partial<CompassSession>
): Promise<void> {
  // The only caller (app/api/learn/route.ts) passes all CompassSession fields,
  // so the previous SELECT-then-merge pattern was reading back what was just written.
  // Build the new state directly from the update and write in one round-trip.
  const newState = { ...update, initialized: true }

  await repos.compass.updateSessionState(
    sessionId,
    newState,
    (update.lockedSubject as string | null) ?? null,
  )
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
