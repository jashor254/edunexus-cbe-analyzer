// lib/testing/sowJobState.http.integration.test.ts
//
// SOW background job status must agree with what generation actually produced.
//
// The gap this pins (STALL-4): the completion boundary marked a job
// `completed` whenever the pipeline RETURNED without throwing — regardless of
// what it returned. A run that generated nothing finished as:
//
//     jobs.status          = 'completed'
//     result.result.status = 'failed'
//     lessons              = []
//     result.completed     = total      (hardcoded, not measured)
//
// The polling route passes `status` straight through, and the teacher UI
// advances to the preview step on 'completed' — so a zero-lesson run showed an
// empty scheme of work as a success.
//
// Route-level, because checkFeatureAccess reads the session through
// next/headers cookies(). Run with:
//   npm run dev          (in another shell)
//   npx tsx --env-file=.env.local --test lib/testing/sowJobState.http.integration.test.ts

import { test, before, after } from 'node:test'
import assert from 'node:assert/strict'
import { createServiceClient } from '@/utils/supabase/service'
import { signInForHttpTest } from '@/lib/testing/httpAuthTestHelper'

const BASE = process.env.TEST_BASE_URL ?? 'http://localhost:3000'
const MARKER = 'SYNTHETIC_SOWJOBSTATE'
const db = createServiceClient()
const ENDPOINT = `${BASE}/api/sow/generate`
const JOB_TYPE = 'ai.sow.generate'

const createdUsers: string[] = []
let teacher: { id: string; cookie: string }

const baseContext = () => ({
  school:           `${MARKER} School`,
  learningArea:     'Mathematics',
  learningAreaName: 'Mathematics',
  grade:            'Grade 10',
  gradeName:        'Grade 10',
  term:             1,
  year:             2026,
  curriculumMode:   'cbc_senior',
})

const substrands = () => ([{
  strandId: 'num-1', strandTitle: 'Numbers',
  substrandId: 'num-1-1', substrandTitle: 'Real Numbers',
  lessonsRequired: 2, orderIndex: 1,
}])

/** A request that passes route validation but yields an EMPTY timeline. */
const zeroLessonBody = () => ({
  context: baseContext(),
  // No firstWeek/lastWeek: slot arithmetic goes NaN, buildTermSchedule's range
  // guard never trips, and the timeline comes out empty -> total 0.
  lessonStructure: { lessonsPerWeek: 2 },
  selectedSubstrands: substrands(),
  breaks: [],
})

const validBody = () => ({
  context: baseContext(),
  lessonStructure: { lessonsPerWeek: 2, firstWeek: 1, firstLesson: 1, lastWeek: 1, lastLesson: 2 },
  selectedSubstrands: substrands(),
  breaks: [],
})

async function call(cookie: string, body: unknown) {
  const res = await fetch(ENDPOINT, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Cookie: cookie },
    body: JSON.stringify(body),
  })
  const raw = await res.text()
  let json: { success?: boolean; data?: Record<string, unknown>; error?: string } = {}
  try { json = JSON.parse(raw) } catch { /* non-JSON */ }
  return { status: res.status, raw, json }
}

type JobRow = {
  status: string
  result: {
    total?: number
    completed?: number
    failed?: number
    errorMessage?: string
    result?: { status: string; lessons: unknown[]; summary?: { generated: number; failed: number } }
  }
}

/** Polls the REAL status endpoint the UI polls, then reads the row for detail. */
async function settle(cookie: string, jobId: string): Promise<JobRow> {
  for (let i = 0; i < 30; i++) {
    await new Promise(r => setTimeout(r, 2000))
    const res = await fetch(`${BASE}/api/sow/generate/status?jobId=${jobId}`, { headers: { Cookie: cookie } })
    const json = await res.json()
    const job = json?.data as JobRow | undefined
    if (job && (job.status === 'completed' || job.status === 'failed')) return job
  }
  throw new Error(`job ${jobId} never settled`)
}

before(async () => {
  const email = `sowjobstate-${Date.now()}-${Math.random().toString(36).slice(2, 7)}@example.com`
  const password = `Test!${Math.random().toString(36).slice(2, 12)}`
  const { data, error } = await db.auth.admin.createUser({ email, password, email_confirm: true })
  if (error || !data?.user) throw new Error(`createUser: ${error?.message}`)
  createdUsers.push(data.user.id)

  await db.from('profiles').upsert({ id: data.user.id, role: 'teacher', full_name: `${MARKER} Teacher` })
  await db.from('teachers').insert({ user_id: data.user.id, full_name: `${MARKER} Teacher`, school: `${MARKER} School` })

  const session = await signInForHttpTest(email, password)
  teacher = { id: data.user.id, cookie: session.cookieHeader }
})

after(async () => {
  for (const id of createdUsers) {
    await db.from('jobs').delete().eq('user_id', id)
    await db.from('teachers').delete().eq('user_id', id)
    await db.auth.admin.deleteUser(id)
  }
})

// ── The zero-lesson case — the acceptance test ───────────────────────────────

test('1-3. a run that generates nothing is a FAILED job, not a completed one', async () => {
  const res = await call(teacher.cookie, zeroLessonBody())
  assert.equal(res.status, 200, res.raw)
  const { jobId, total } = res.json.data as { jobId: string; total: number }
  assert.equal(total, 0, 'fixture no longer reproduces the zero-lesson condition')

  const job = await settle(teacher.cookie, jobId)

  // 1-2. The outer status tells the truth, through the endpoint the UI polls.
  assert.equal(job.status, 'failed',
    `a job that generated nothing was reported as "${job.status}"`)
  assert.notEqual(job.status, 'completed')

  // 3. The pipeline's own verdict is preserved, not overwritten.
  assert.equal(job.result.result?.status, 'failed')
  assert.equal(job.result.result?.lessons.length ?? 0, 0)

  // The counts must not claim work that never happened.
  assert.equal(job.result.completed ?? 0, 0, 'a job with no lessons reported completed work')
})

test('4. the failure carries a user-safe explanation, with no internals', async () => {
  const res = await call(teacher.cookie, zeroLessonBody())
  const { jobId } = res.json.data as { jobId: string }
  const job = await settle(teacher.cookie, jobId)

  const msg = job.result.errorMessage ?? ''
  assert.ok(msg.length > 0, 'a failed job carried no explanation for the teacher')
  assert.ok(!/TypeError|at Object|\.ts:\d+|node_modules|DeepSeek|api[_-]?key|Error:/i.test(msg),
    `internal detail leaked into the job error: ${msg}`)
})

test('5. the UI polling contract cannot read a zero-lesson job as success', async () => {
  // Mirrors app/teacher/scheme-of-work/new/page.tsx exactly: it advances to
  // the preview when status === 'completed' AND result.result exists.
  const res = await call(teacher.cookie, zeroLessonBody())
  const { jobId } = res.json.data as { jobId: string }
  const job = await settle(teacher.cookie, jobId)

  const uiWouldShowPreview = job.status === 'completed' && !!job.result.result
  assert.equal(uiWouldShowPreview, false,
    'the teacher UI would advance to an empty scheme-of-work preview')
})

// ── Valid generation must be unaffected ──────────────────────────────────────

test('6-8. a valid request still completes, with lessons and a complete result', async () => {
  const res = await call(teacher.cookie, validBody())
  assert.equal(res.status, 200, res.raw)
  const { jobId, total } = res.json.data as { jobId: string; total: number }
  assert.equal(total, 2)

  const job = await settle(teacher.cookie, jobId)

  assert.equal(job.status, 'completed', `valid generation regressed to "${job.status}"`)
  assert.equal(job.result.result?.status, 'complete')
  assert.ok((job.result.result?.lessons.length ?? 0) > 0, 'a completed job produced no lessons')
  assert.equal(job.result.completed, job.result.result?.lessons.length,
    'reported completed count disagrees with lessons generated')
})

// ── STALL-3 must stay closed ─────────────────────────────────────────────────

test('9. missing required context is still rejected before any job exists', async () => {
  const { count: before } = await db.from('jobs')
    .select('id', { count: 'exact', head: true }).eq('user_id', teacher.id).eq('type', JOB_TYPE)

  for (const field of ['learningAreaName', 'gradeName']) {
    const body = validBody()
    delete (body.context as Record<string, unknown>)[field]
    const res = await call(teacher.cookie, body)
    assert.equal(res.status, 400, `omitting ${field} was accepted`)
    assert.ok(!/jobId/.test(res.raw))
  }

  await new Promise(r => setTimeout(r, 750))
  const { count: after } = await db.from('jobs')
    .select('id', { count: 'exact', head: true }).eq('user_id', teacher.id).eq('type', JOB_TYPE)
  assert.equal(after, before, 'an invalid request created a job')
})
