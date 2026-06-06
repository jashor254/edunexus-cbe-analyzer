// Single source of truth for compass state
// Reads and writes to compass_sessions only
// No in-memory state. No singleton.

import { createServiceClient } from '@/utils/supabase/service'

export interface CompassSession {
  sessionId:        string
  lockedSubject:    string | null
  lockedSubstrand:  string | null
  lockedGrade:      number | null
  isRevision:       boolean
  studentGrade:     number
  overallLevel:     number  // 1-4
  consecutiveRight: number
  consecutiveWrong: number
  initialized:      boolean
}

export async function readSession(
  sessionId: string,
  userId: string
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
  update: Partial<CompassSession>
): Promise<void> {

  const db = createServiceClient()

  // Read current state first
  const { data } = await db
    .from('compass_sessions')
    .select('session_state')
    .eq('id', sessionId)
    .maybeSingle()

  const current = (data?.session_state ?? {}) as Record<string, unknown>

  await db
    .from('compass_sessions')
    .update({
      session_state: {
        ...current,
        ...update,
        initialized: true,
      },
      last_subject: update.lockedSubject || current.lockedSubject,
      updated_at:   new Date().toISOString(),
    })
    .eq('id', sessionId)
}

export function resolveSubject(
  incoming: {
    lockedSubject?:  string
    sessionSubject?: string
    message:         string
  },
  savedSession: CompassSession | null
): string {

  // Priority: incoming lock > saved lock > session subject > keyword > default

  if (incoming.lockedSubject)         return incoming.lockedSubject
  if (savedSession?.lockedSubject)    return savedSession.lockedSubject
  if (incoming.sessionSubject)        return incoming.sessionSubject

  // Keyword detection — last resort
  const msg = incoming.message.toLowerCase()

  const keywords: Record<string, string[]> = {
    mathematics:   ['math','algebra','fraction','percentage','geometry','equation','hesabu','calculate'],
    english:       ['english','grammar','essay','reading','writing','vocabulary'],
    kiswahili:     ['kiswahili','sarufi','insha','fasihi','ngeli'],
    biology:       ['biology','cell','plant','photosynthesis','organism'],
    chemistry:     ['chemistry','atom','reaction','element','compound'],
    physics:       ['physics','force','energy','electricity','circuit','motion'],
    geography:     ['geography','map','weather','climate','river','volcano'],
    agriculture:   ['agriculture','farm','crop','soil','harvest','hay','silage','forage'],
    history:       ['history','colonialism','independence','empire'],
    integrated_science: ['science','experiment','ecosystem','environment','solar'],
  }

  for (const [subj, words] of Object.entries(keywords)) {
    if (words.some(w => msg.includes(w))) return subj
  }

  return 'mathematics' // safe default
}
