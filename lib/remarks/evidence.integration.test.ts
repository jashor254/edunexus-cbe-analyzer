// lib/remarks/evidence.integration.test.ts
//
// Phase C integration proof against real (synthetic, cleaned up) data —
// verifying remarks never supersede each other (the claim-key carve-out),
// round-trip through payload correctly, and that erasure actually purges
// the remark's real content (payload), not just the empty extracted_name
// field, per docs/architecture/learner-record-layer-decisions.md Decision 1.
//
// ⚠️ Creates one real (throwaway) auth.users account and legacy
// teachers/students rows, all deleted in `after()`, including on failure.
//
// Run: npx tsx --env-file=.env.local --test lib/remarks/evidence.integration.test.ts
import { test, before, after } from 'node:test'
import assert from 'node:assert/strict'
import { createTestServiceClient as createServiceClient } from '@/utils/supabase/test-service'
import { recordRemarkEvidence, getRemarksForStudent } from './evidence'
import { eraseEvidence } from '@/lib/intelligence/evidenceLifecycle'
import { deleteAuthUserOrThrow } from '@/lib/testing/deleteAuthUserOrThrow'

const SYNTHETIC_MARKER = 'SYNTHETIC_REMARK_TEST'
const db = createServiceClient()

let authUserId: string
let teacherId: string
let studentId: string

before(async () => {
  const { data: authUser, error: authErr } = await db.auth.admin.createUser({
    email: `remark-test-${Date.now()}@example.com`,
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
  await db.from('students').delete().eq('id', studentId)
  await db.from('teachers').delete().eq('id', teacherId)
  await deleteAuthUserOrThrow(db, authUserId)
  console.log('[cleanup] synthetic remark fixtures removed')
})

test('an empty or whitespace-only remark records nothing', async () => {
  await recordRemarkEvidence({
    studentId, studentName: SYNTHETIC_MARKER, teacherId, initiatedByUserId: authUserId,
    body: '   ', subject: null, term: 1, academicYear: 2026,
  })
  const remarks = await getRemarksForStudent(studentId)
  assert.equal(remarks.length, 0)
})

test('two remarks for the same student, same year, do NOT supersede each other — both remain current', async () => {
  await recordRemarkEvidence({
    studentId, studentName: SYNTHETIC_MARKER, teacherId, initiatedByUserId: authUserId,
    body: 'Quiet learner, building confidence.', subject: null, term: 1, academicYear: 2026,
  })
  await recordRemarkEvidence({
    studentId, studentName: SYNTHETIC_MARKER, teacherId, initiatedByUserId: authUserId,
    body: 'Confidence improving noticeably this term.', subject: null, term: 2, academicYear: 2026,
  })

  const remarks = await getRemarksForStudent(studentId)
  assert.equal(remarks.length, 2, 'a second remark must not supersede the first — both are permanently true statements at their respective times')
  assert.equal(remarks[0].lifecycleState, 'auto_confirmed')
  assert.equal(remarks[1].lifecycleState, 'auto_confirmed')
  assert.equal(remarks[0].body, 'Quiet learner, building confidence.')
  assert.equal(remarks[1].body, 'Confidence improving noticeably this term.')
})

test('a general (non-subject) remark uses the "general" sentinel, matching this codebase\'s existing convention', async () => {
  const { data: evBefore } = await db.from('learner_evidence').select('id').eq('learner_id', studentId)
  const countBefore = evBefore?.length ?? 0

  await recordRemarkEvidence({
    studentId, studentName: SYNTHETIC_MARKER, teacherId, initiatedByUserId: authUserId,
    body: 'Excellent reasoning shown across subjects this term.', subject: null, term: 3, academicYear: 2026,
  })

  const { data: evAfter } = await db
    .from('learner_evidence')
    .select('subject, raw_subject')
    .eq('learner_id', studentId)
    .eq('evidence_source', 'teacher_remark')
    .order('created_at', { ascending: false })
    .limit(1)
  assert.equal(evAfter![0].subject, 'general')
  assert.equal(evAfter![0].raw_subject, 'general')
  assert.ok((evAfter?.length ?? 0) + countBefore >= 1)
})

test('erasing a remark purges the actual content (payload), not just the empty extracted_name field', async () => {
  await recordRemarkEvidence({
    studentId, studentName: SYNTHETIC_MARKER, teacherId, initiatedByUserId: authUserId,
    body: 'This remark was entered in error and must be erasable.', subject: null, term: 1, academicYear: 2027,
  })

  const { data: rows } = await db
    .from('learner_evidence')
    .select('id, payload')
    .eq('learner_id', studentId)
    .eq('academic_year', 2027)
    .eq('evidence_source', 'teacher_remark')
    .limit(1)
  const evidenceId = rows![0].id
  assert.ok((rows![0].payload as { body?: string }).body?.includes('entered in error'))

  const erased = await eraseEvidence(evidenceId, authUserId, 'Right-to-erasure request')
  assert.equal(erased.lifecycle_state, 'erased')
  assert.equal(erased.payload, null, 'payload must be purged on erasure — this is where a remark\'s real content lives, not extracted_name')
})
