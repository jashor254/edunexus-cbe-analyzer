// lib/academy/reflections.persist.test.ts
//
// Sprint 2 (Pilot Hardening): AI Fallback Integrity — "Academy fallback
// stored correctly." Proves the is_fallback flag survives the full
// repository round-trip (upsertReflection / upsertMissionCompletion) for
// both a genuine AI judgement and a fallback one, against the real
// database. Does not call any AI — feedback/verdict objects are constructed
// directly, matching what aiJudge.ts would hand to these functions.
//
// Run with: npx tsx --env-file=.env.local --test lib/academy/reflections.persist.test.ts
import { test, before, after } from 'node:test'
import assert from 'node:assert/strict'
import { createServiceClient } from '@/utils/supabase/service'
import { upsertReflection } from './reflections'
import { upsertMissionCompletion } from './missions'
import type { ReflectionFeedback, MissionVerdict } from './types'

const SYNTHETIC_MARKER = 'SYNTHETIC_FALLBACK_PERSIST_TEST'
const db = createServiceClient()

let teacherId: string
let authUserId: string
let lessonId: string
let moduleId: string
let missionId: string

before(async () => {
  const { data: authUser } = await db.auth.admin.createUser({
    email: `fallback-persist-test-${Date.now()}@example.com`,
    password: `Test!${Math.random().toString(36).slice(2, 10)}`,
    email_confirm: true,
  })
  authUserId = authUser!.user.id
  const { data: teacher } = await db
    .from('teachers')
    .insert({ user_id: authUserId, full_name: SYNTHETIC_MARKER, school: SYNTHETIC_MARKER })
    .select('id')
    .single()
  teacherId = teacher!.id

  // Reuse real, existing content rows for the FK references — this test
  // never creates or mutates academy_lessons/modules/missions.
  const { data: lesson } = await db.from('academy_lessons').select('id, module_id').limit(1).single()
  lessonId = lesson!.id
  moduleId = lesson!.module_id
  const { data: mission } = await db.from('academy_missions').select('id').limit(1).single()
  missionId = mission!.id
})

after(async () => {
  await db.from('academy_reflections').delete().eq('teacher_id', teacherId)
  await db.from('academy_mission_completions').delete().eq('teacher_id', teacherId)
  await db.from('teachers').delete().eq('id', teacherId)
  await db.auth.admin.deleteUser(authUserId)
})

const GENUINE_REFLECTION_FEEDBACK: ReflectionFeedback = {
  quality_score: 4,
  feedback_text: 'Genuine AI feedback text.',
  growth_indicator: 'deep',
  suggested_next_action: 'Next step.',
  isFallback: false,
}

const FALLBACK_REFLECTION_FEEDBACK: ReflectionFeedback = {
  quality_score: 2,
  feedback_text: 'Heuristic fallback text.',
  growth_indicator: 'surface',
  suggested_next_action: 'Try again.',
  isFallback: true,
}

test('a genuine reflection judgement persists with is_fallback = false', async () => {
  const reflection = await upsertReflection(
    teacherId,
    { lesson_id: lessonId, module_id: moduleId, tried: 'a', worked: 'b', failed: 'c', surprised: 'd', next_action: 'e' },
    GENUINE_REFLECTION_FEEDBACK
  )
  assert.equal(reflection.is_fallback, false)

  const { data: row } = await db.from('academy_reflections').select('is_fallback').eq('id', reflection.id).single()
  assert.equal(row?.is_fallback, false)
})

test('a fallback reflection score persists with is_fallback = true', async () => {
  const reflection = await upsertReflection(
    teacherId,
    { lesson_id: lessonId, module_id: moduleId, tried: 'a', worked: 'b', failed: 'c', surprised: 'd', next_action: 'e' },
    FALLBACK_REFLECTION_FEEDBACK
  )
  assert.equal(reflection.is_fallback, true)

  const { data: row } = await db.from('academy_reflections').select('is_fallback').eq('id', reflection.id).single()
  assert.equal(row?.is_fallback, true, 'a fallback score must never be persisted looking like a genuine one')
})

const GENUINE_MISSION_VERDICT: MissionVerdict = {
  ai_score: 4,
  ai_verdict: 'Genuine AI verdict text.',
  key_insight: 'Insight.',
  suggested_next_action: 'Next step.',
  isFallback: false,
}

const FALLBACK_MISSION_VERDICT: MissionVerdict = {
  ai_score: 2,
  ai_verdict: 'Fallback verdict text.',
  key_insight: 'Insight.',
  suggested_next_action: 'Next step.',
  isFallback: true,
}

test('a genuine mission verdict persists with is_fallback = false', async () => {
  const completion = await upsertMissionCompletion(teacherId, missionId, 'a', 'b', 'c', {}, GENUINE_MISSION_VERDICT)
  const { data: row } = await db.from('academy_mission_completions').select('is_fallback').eq('id', completion.id).single()
  assert.equal(row?.is_fallback, false)
})

test('a fallback mission verdict persists with is_fallback = true', async () => {
  const completion = await upsertMissionCompletion(teacherId, missionId, 'a', 'b', 'c', {}, FALLBACK_MISSION_VERDICT)
  const { data: row } = await db.from('academy_mission_completions').select('is_fallback').eq('id', completion.id).single()
  assert.equal(row?.is_fallback, true, 'a fallback verdict must never be persisted looking like a genuine one')
})
