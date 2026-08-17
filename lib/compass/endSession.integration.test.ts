// lib/compass/endSession.integration.test.ts
//
// Ending a Compass session is not idempotent downstream: the caller awards XP,
// bumps `total_sessions` / `sessions_this_week`, credits the study-group bonus,
// writes the Learner Model and emits Evidence. The client can legitimately fire
// the end route more than once — the idle wrap, the countdown hitting zero, the
// eval-summary handler's delayed close and the manual end button can all run
// against the same live session.
//
// `endSession` is therefore the atomic claim on that work, and this test proves
// the claim holds against the real database rather than against a stub: the
// `status = 'active'` predicate on the UPDATE means exactly one caller can win,
// and the loser is told so instead of silently succeeding.
//
// ⚠️ Creates one throwaway `compass_sessions` row (no FK on `learner_id`, so no
// user or student rows are needed) and deletes it in `after()`, including on
// failure. Uses status 'abandoned' so no event is published.
//
// Run: npx tsx --env-file=.env.local --test lib/compass/endSession.integration.test.ts

import { test, before, after } from 'node:test'
import assert from 'node:assert/strict'
import { randomUUID } from 'node:crypto'
import { createTestServiceClient as createServiceClient } from '@/utils/supabase/test-service'
import { endSession } from './session'

const db = createServiceClient()

const learnerId = randomUUID()
let sessionId: string

async function createActiveSession(): Promise<string> {
  const { data, error } = await db
    .from('compass_sessions')
    .insert({
      learner_id:     learnerId,
      subject:        'mathematics',
      mode:           'school',
      status:         'active',
      exchange_count: 4,
      session_state:  {},
    })
    .select('id')
    .single()

  if (error) throw new Error(`failed to seed session: ${error.message}`)
  return data.id as string
}

before(async () => {
  sessionId = await createActiveSession()
})

after(async () => {
  await db.from('compass_sessions').delete().eq('learner_id', learnerId)
})

test('the first end call wins and the second is refused', async () => {
  const first = await endSession(sessionId, learnerId, 'abandoned', 300)
  assert.equal(first, true, 'the call that transitions the session must report it')

  const second = await endSession(sessionId, learnerId, 'abandoned', 300)
  assert.equal(second, false,
    'a repeat call must not report success — the caller gates XP, counters and Evidence on this')
})

test('a refused call does not overwrite the recorded outcome', async () => {
  const id = await createActiveSession()

  assert.equal(await endSession(id, learnerId, 'completed', 600), true)

  const { data: afterFirst } = await db
    .from('compass_sessions')
    .select('status, duration_seconds, completed_at')
    .eq('id', id)
    .single()

  // A later, different-looking end attempt must change nothing.
  assert.equal(await endSession(id, learnerId, 'abandoned', 5), false)

  const { data: afterSecond } = await db
    .from('compass_sessions')
    .select('status, duration_seconds, completed_at')
    .eq('id', id)
    .single()

  assert.deepEqual(afterSecond, afterFirst,
    'the terminal state, duration and completion time are set once and never rewritten')
})

test('concurrent end calls produce exactly one winner', async () => {
  const id = await createActiveSession()

  const results = await Promise.all([
    endSession(id, learnerId, 'abandoned', 120),
    endSession(id, learnerId, 'abandoned', 120),
    endSession(id, learnerId, 'abandoned', 120),
  ])

  assert.equal(results.filter(Boolean).length, 1,
    'the UPDATE ... WHERE status = active predicate is the lock; only one call may claim it')
})

test('another learner cannot end this learner\'s session', async () => {
  const id = await createActiveSession()

  assert.equal(await endSession(id, randomUUID(), 'abandoned', 120), false)

  const { data } = await db
    .from('compass_sessions')
    .select('status')
    .eq('id', id)
    .single()

  assert.equal(data?.status, 'active', 'the session must be left untouched')
})
