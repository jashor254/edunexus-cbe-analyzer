// lib/learnerRecord/timeline.integration.test.ts
//
// Phase E integration proof against real (synthetic, cleaned up) data —
// verifying getLearnerTimeline merges Evidence and promotion history into
// one true chronological sequence, per
// docs/architecture/learner-record-layer-decisions.md roadmap Phase E.
//
// ⚠️ Creates one real (throwaway) auth.users account and legacy
// teachers/students/teacher_classes rows, all deleted in `after()`,
// including on failure.
//
// Run: npx tsx --env-file=.env.local --test lib/learnerRecord/timeline.integration.test.ts
import { test, before, after } from 'node:test'
import assert from 'node:assert/strict'
import { createTestServiceClient as createServiceClient } from '@/utils/supabase/test-service'
import { getLearnerTimeline } from './timeline'
import { recordRemarkEvidence } from '@/lib/remarks/evidence'
import { promoteStudent } from '@/lib/promotions/promote'
import { deleteAuthUserOrThrow } from '@/lib/testing/deleteAuthUserOrThrow'

const SYNTHETIC_MARKER = 'SYNTHETIC_TIMELINE_TEST'
const db = createServiceClient()

let authUserId: string
let teacherId: string
let studentId: string

before(async () => {
  const { data: authUser, error: authErr } = await db.auth.admin.createUser({
    email: `timeline-test-${Date.now()}@example.com`,
    password: `Test!${Math.random().toString(36).slice(2, 10)}`,
    email_confirm: true,
  })
  if (authErr) throw authErr
  authUserId = authUser.user.id

  const { data: teacher, error: teacherErr } = await db
    .from('teachers')
    .insert({ user_id: authUserId, full_name: SYNTHETIC_MARKER, school: SYNTHETIC_MARKER })
    .select('id')
    .single()
  if (teacherErr) throw teacherErr
  teacherId = teacher.id

  const { data: student, error: studentErr } = await db
    .from('students')
    .insert({ teacher_id: teacherId, name: SYNTHETIC_MARKER, grade: 7, level: 'Junior', school: SYNTHETIC_MARKER, added_by: 'teacher' })
    .select('id')
    .single()
  if (studentErr) throw studentErr
  studentId = student.id
})

after(async () => {
  const { data: runs } = await db.from('ingestion_runs').select('id').eq('teacher_id', teacherId)
  const runIds = (runs ?? []).map(r => r.id)
  if (runIds.length > 0) {
    const { data: ev } = await db.from('learner_evidence').select('id').in('ingestion_run_id', runIds)
    const evIds = (ev ?? []).map(e => e.id)
    if (evIds.length > 0) {
      await db.from('evidence_projection_events').delete().in('evidence_id', evIds)
      await db.from('evidence_audit_log').delete().in('evidence_id', evIds)
      await db.from('learner_evidence').delete().in('id', evIds)
    }
    await db.from('ingestion_runs').delete().in('id', runIds)
  }
  await db.from('student_promotions').delete().eq('student_id', studentId)
  await db.from('students').delete().eq('id', studentId)
  await db.from('teachers').delete().eq('id', teacherId)
  await deleteAuthUserOrThrow(db, authUserId)
  console.log('[cleanup] synthetic timeline fixtures removed')
})

test('the timeline merges Evidence and promotion events into one true chronological sequence, not two concatenated lists', async () => {
  // Deliberately out of insertion order: a remark, then a promotion, then
  // an earlier-dated remark backfilled second — the timeline must sort by
  // actual date, not by which write happened first.
  await recordRemarkEvidence({
    studentId, studentName: SYNTHETIC_MARKER, teacherId, initiatedByUserId: authUserId,
    body: 'Second remark chronologically, inserted first.', subject: null, term: 2, academicYear: 2026,
  })

  await promoteStudent({
    studentId, toGrade: 8, academicYear: '2027', promotedBy: authUserId, notes: 'Year-end promotion',
  })

  const timeline = await getLearnerTimeline(studentId)

  assert.ok(timeline.length >= 2, 'expected at least the remark and the promotion')
  const kinds = timeline.map(e => e.kind)
  assert.ok(kinds.includes('evidence'))
  assert.ok(kinds.includes('promotion'))

  // Sorted ascending by date — every entry's date must be <= the next one's.
  for (let i = 1; i < timeline.length; i++) {
    assert.ok(
      new Date(timeline[i - 1].date).getTime() <= new Date(timeline[i].date).getTime(),
      'timeline must be strictly chronological, not grouped by kind or insertion order',
    )
  }

  const remarkEntry = timeline.find(e => e.kind === 'evidence' && e.evidenceSource === 'teacher_remark')
  assert.ok(remarkEntry)
  if (remarkEntry?.kind === 'evidence') {
    assert.equal(remarkEntry.body, 'Second remark chronologically, inserted first.')
  }

  const promotionEntry = timeline.find(e => e.kind === 'promotion')
  assert.ok(promotionEntry)
  if (promotionEntry?.kind === 'promotion') {
    assert.equal(promotionEntry.toGrade, 8)
    assert.equal(promotionEntry.notes, 'Year-end promotion')
  }
})

test('a learner with no history at all gets an empty timeline, not an error', async () => {
  const { data: authUser } = await db.auth.admin.createUser({
    email: `timeline-empty-test-${Date.now()}@example.com`,
    password: `Test!${Math.random().toString(36).slice(2, 10)}`,
    email_confirm: true,
  })
  const { data: emptyStudent } = await db
    .from('students')
    .insert({ teacher_id: teacherId, name: SYNTHETIC_MARKER, grade: 7, level: 'Junior', school: SYNTHETIC_MARKER, added_by: 'teacher' })
    .select('id')
    .single()

  try {
    const timeline = await getLearnerTimeline(emptyStudent!.id)
    assert.deepEqual(timeline, [])
  } finally {
    await db.from('students').delete().eq('id', emptyStudent!.id)
    await deleteAuthUserOrThrow(db, authUser!.user.id)
  }
})
