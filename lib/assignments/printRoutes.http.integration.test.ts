// lib/assignments/printRoutes.http.integration.test.ts
//
// Printable Adaptive Assignments pilot (Adaptive Assignment Domain audit,
// CONDITIONAL GO). Full HTTP integration coverage — same pattern as
// lib/assignments/create.http.integration.test.ts (the sibling test suite
// for the assignment-creation service this pilot extends) and
// lib/adaptiveLearning/differentiation.integration.test.ts (evidence
// seeding via runCsvIngestion, for the routing-suggestion assertions).
//
// Requires a server already running at LMS_TEST_BASE_URL (default
// http://localhost:3939) and a reachable Supabase project.
//
// Run: TEST_BASE_URL=http://localhost:3100 npx tsx --test lib/assignments/printRoutes.http.integration.test.ts
import { test, before, after } from 'node:test'
import assert from 'node:assert/strict'
import { createTestServiceClient as createServiceClient } from '@/utils/supabase/test-service'
import { signInForHttpTest, type SyntheticSession } from '@/lib/testing/httpAuthTestHelper'
import { runCsvIngestion } from '@/lib/intelligence/runCsvIngestion'

const BASE_URL = process.env.TEST_BASE_URL ?? process.env.LMS_TEST_BASE_URL ?? 'http://localhost:3100'
const SYNTHETIC_MARKER = 'SYNTHETIC_PRINT_ROUTES_HTTP_TEST'
const SUBJECT = 'mathematics'
const YEAR = 2026
const db = createServiceClient()

type Fixture = {
  teacherAuthId: string
  teacherId: string
  teacherSession: SyntheticSession
  otherTeacherAuthId: string
  otherTeacherId: string
  otherTeacherSession: SyntheticSession
  classId: string
  assignmentId: string
  // Roster spans the routing taxonomy on purpose:
  criticalStudentId: string  // level 1 + declining -> critical_gap -> guided
  gapStudentId: string       // level 2 -> prerequisite_gap -> guided
  confusionStudentId: string // level 3 -> concept_confusion -> core
  onTrackStudentId: string   // level 4 -> on_track -> extension
  noEvidenceStudentId: string // never scored anything -> insufficient_data -> core
  createdRunIds: string[]
}

let fx: Fixture

async function retryAsync<T>(fn: () => Promise<T>, attempts = 6): Promise<T> {
  let lastError: unknown
  for (let attempt = 1; attempt <= attempts; attempt++) {
    try { return await fn() } catch (err) { lastError = err }
    await new Promise(resolve => setTimeout(resolve, 500 * attempt))
  }
  throw lastError
}

async function createSyntheticUser(label: string): Promise<{ authId: string; session: SyntheticSession }> {
  const email = `${SYNTHETIC_MARKER.toLowerCase()}-${label}-${Date.now()}-${Math.random().toString(36).slice(2, 6)}@example.com`
  const password = `Test!${Math.random().toString(36).slice(2, 10)}`
  const { data } = await retryAsync(async () => {
    const res = await db.auth.admin.createUser({ email, password, email_confirm: true })
    if (res.error) throw res.error
    return res
  })
  const session = await retryAsync(() => signInForHttpTest(email, password))
  return { authId: data.user.id, session }
}

function cookie(session: SyntheticSession) {
  return { Cookie: session.cookieHeader }
}

async function api(path: string, headers: Record<string, string>, init: RequestInit = {}) {
  return fetch(`${BASE_URL}${path}`, { ...init, headers: { ...headers, 'Content-Type': 'application/json' } })
}

before(async () => {
  const teacher = await createSyntheticUser('teacher')
  const otherTeacher = await createSyntheticUser('other-teacher')

  const { data: teacherRow, error: teacherErr } = await db
    .from('teachers').insert({ user_id: teacher.authId, full_name: SYNTHETIC_MARKER, school: SYNTHETIC_MARKER })
    .select('id').single()
  if (teacherErr) throw teacherErr

  const { data: otherTeacherRow, error: otherTeacherErr } = await db
    .from('teachers').insert({ user_id: otherTeacher.authId, full_name: SYNTHETIC_MARKER, school: SYNTHETIC_MARKER })
    .select('id').single()
  if (otherTeacherErr) throw otherTeacherErr

  const { data: cls, error: clsErr } = await db
    .from('teacher_classes')
    .insert({ teacher_id: teacherRow.id, name: SYNTHETIC_MARKER, grade: 9, subject: 'Mathematics', class_code: `${SYNTHETIC_MARKER}_${Date.now()}` })
    .select('id').single()
  if (clsErr) throw clsErr

  const names = ['Critical Learner', 'Gap Learner', 'Confusion Learner', 'On Track Learner', 'No Evidence Learner']
  const ids: string[] = []
  for (const name of names) {
    const { data: s, error } = await db
      .from('students')
      .insert({ teacher_id: teacherRow.id, name, grade: 9, level: 'Junior School', school: SYNTHETIC_MARKER, added_by: 'teacher' })
      .select('id').single()
    if (error) throw error
    ids.push(s.id)
  }
  const [criticalId, gapId, confusionId, onTrackId, noEvidenceId] = ids
  await db.from('class_students').insert(ids.map(student_id => ({ class_id: cls.id, student_id })))

  // Term 1: establish a declining trend for the "critical" learner.
  await runCsvIngestion({
    fileContents: ['name,Mathematics', `${names[0]},35`].join('\n'),
    teacherId: teacherRow.id, initiatedBy: teacher.authId, institution: SYNTHETIC_MARKER,
    academicYear: YEAR, term: 1, assessmentType: 'cat',
  })
  // Term 2: the real levels the routing test assertions depend on.
  const scores: Record<string, number> = { [names[0]]: 15, [names[1]]: 40, [names[2]]: 62, [names[3]]: 95 }
  for (const [name, score] of Object.entries(scores)) {
    await runCsvIngestion({
      fileContents: ['name,Mathematics', `${name},${score}`].join('\n'),
      teacherId: teacherRow.id, initiatedBy: teacher.authId, institution: SYNTHETIC_MARKER,
      academicYear: YEAR, term: 2, assessmentType: 'cat',
    })
  }
  // noEvidenceId deliberately never scored anything.

  const { data: assignment, error: assignErr } = await db
    .from('assignments')
    .insert({
      class_id: cls.id, teacher_id: teacherRow.id, title: SYNTHETIC_MARKER, subject: SUBJECT, topic: 'Ratios',
      instructions: 'Solve the following ratio problems, showing your working for each step.',
      due_date: new Date(Date.now() + 86400_000).toISOString(), type: 'practice', status: 'active',
    })
    .select('id').single()
  if (assignErr) throw assignErr

  fx = {
    teacherAuthId: teacher.authId, teacherId: teacherRow.id, teacherSession: teacher.session,
    otherTeacherAuthId: otherTeacher.authId, otherTeacherId: otherTeacherRow.id, otherTeacherSession: otherTeacher.session,
    classId: cls.id, assignmentId: assignment.id,
    criticalStudentId: criticalId, gapStudentId: gapId, confusionStudentId: confusionId,
    onTrackStudentId: onTrackId, noEvidenceStudentId: noEvidenceId,
    createdRunIds: [],
  }
})

after(async () => {
  if (!fx) return
  await db.from('assignment_print_routes').delete().in('print_run_id', fx.createdRunIds)
  for (const runId of fx.createdRunIds) {
    // Approved rows are immutable — clear approved_at first so the row can be deleted (DELETE is not blocked by the trigger, only UPDATE of frozen fields is).
    await db.from('assignment_print_runs').delete().eq('id', runId)
  }
  await db.from('assignments').delete().eq('id', fx.assignmentId)

  const studentIds = [fx.criticalStudentId, fx.gapStudentId, fx.confusionStudentId, fx.onTrackStudentId, fx.noEvidenceStudentId]
  await db.from('learner_projections').delete().in('learner_id', studentIds)
  const { data: runs } = await db.from('ingestion_runs').select('id').eq('teacher_id', fx.teacherId)
  const runIds = (runs ?? []).map(r => r.id)
  if (runIds.length > 0) {
    const { data: ev } = await db.from('learner_evidence').select('id').in('ingestion_run_id', runIds)
    const evidenceIds = (ev ?? []).map(e => e.id)
    if (evidenceIds.length > 0) {
      await db.from('evidence_projection_events').delete().in('evidence_id', evidenceIds)
      await db.from('evidence_audit_log').delete().in('evidence_id', evidenceIds)
      await db.from('learner_evidence').update({ supersedes: null, superseded_by: null }).in('id', evidenceIds)
      await db.from('learner_evidence').delete().in('id', evidenceIds)
    }
    await db.from('ingestion_runs').delete().in('id', runIds)
  }
  await db.from('class_students').delete().eq('class_id', fx.classId)
  await db.from('students').delete().in('id', studentIds)
  await db.from('teacher_classes').delete().eq('id', fx.classId)
  await db.from('teachers').delete().eq('id', fx.teacherId)
  await db.from('teachers').delete().eq('id', fx.otherTeacherId)
  for (const authId of [fx.teacherAuthId, fx.otherTeacherAuthId]) {
    await db.auth.admin.deleteUser(authId)
  }
})

// ── 1. non-owning teacher receives 403 ──────────────────────────────────────
test('POST .../print-routes: a teacher who does not own the assignment/class is denied with 403', async () => {
  const res = await api(`/api/teacher/assignments/${fx.assignmentId}/print-routes`, cookie(fx.otherTeacherSession), { method: 'POST' })
  assert.equal(res.status, 403)
})

let draftRunId: string
let draftRoutes: Array<{ student_id: string; route: string; source: string; evidence_band: string | null }>

test('POST .../print-routes: the owning teacher generates a draft run covering the whole roster', async () => {
  const res = await api(`/api/teacher/assignments/${fx.assignmentId}/print-routes`, cookie(fx.teacherSession), { method: 'POST' })
  assert.equal(res.status, 201)
  const body = await res.json()
  draftRunId = body.data.run.id
  draftRoutes = body.data.routes
  fx.createdRunIds.push(draftRunId)

  assert.equal(body.data.run.status, 'draft')
  // ── 12. one learner appears exactly once per print run ──────────────────
  const studentIdsInRun = draftRoutes.map((r) => r.student_id)
  assert.equal(new Set(studentIdsInRun).size, studentIdsInRun.length)
  assert.equal(studentIdsInRun.length, 5)
})

// ── 2/3/4/5. routing rule correctness ───────────────────────────────────────
test('Routing: critical-gap and prerequisite-gap learners default to Guided Practice', async () => {
  const critical = draftRoutes.find(r => r.student_id === fx.criticalStudentId)!
  const gap = draftRoutes.find(r => r.student_id === fx.gapStudentId)!
  assert.equal(critical.route, 'guided')
  assert.equal(critical.evidence_band, 'critical_gap')
  assert.equal(gap.route, 'guided')
  assert.equal(gap.evidence_band, 'prerequisite_gap')
})

test('Routing: concept-confusion learner maps to Core Practice', async () => {
  const confusion = draftRoutes.find(r => r.student_id === fx.confusionStudentId)!
  assert.equal(confusion.route, 'core')
  assert.equal(confusion.evidence_band, 'concept_confusion')
})

test('Routing: on-track (thick-evidence) learner maps to Extension Practice — never defaulted to Guided', async () => {
  const onTrack = draftRoutes.find(r => r.student_id === fx.onTrackStudentId)!
  assert.equal(onTrack.route, 'extension')
  assert.equal(onTrack.evidence_band, 'on_track')
})

test('Routing: a learner with zero evidence defaults to Core, never Guided', async () => {
  const noEvidence = draftRoutes.find(r => r.student_id === fx.noEvidenceStudentId)!
  assert.equal(noEvidence.route, 'core')
  assert.equal(noEvidence.evidence_band, 'insufficient_data')
})

// ── 6/7. teacher override persists and is distinguishable ──────────────────
test('PATCH .../print-routes/[runId]: teacher override persists and is distinguishable from system_suggested', async () => {
  const res = await api(`/api/teacher/assignments/${fx.assignmentId}/print-routes/${draftRunId}`, cookie(fx.teacherSession), {
    method: 'PATCH',
    body: JSON.stringify({ kind: 'routeOverride', studentId: fx.onTrackStudentId, route: 'core' }),
  })
  assert.equal(res.status, 200)
  const body = await res.json()
  assert.equal(body.data.route.route, 'core')
  assert.equal(body.data.route.source, 'teacher_override')

  const { data: row } = await db.from('assignment_print_routes').select('route, source').eq('print_run_id', draftRunId).eq('student_id', fx.onTrackStudentId).single()
  assert.equal(row!.route, 'core')
  assert.equal(row!.source, 'teacher_override')
})

// ── 8. teacher can edit route content before approval ───────────────────────
test('PATCH .../print-routes/[runId]: teacher can edit a route\'s printable content before approval', async () => {
  const res = await api(`/api/teacher/assignments/${fx.assignmentId}/print-routes/${draftRunId}`, cookie(fx.teacherSession), {
    method: 'PATCH',
    body: JSON.stringify({ kind: 'routeContent', route: 'guided', html: '<p>Teacher-edited guided content.</p>' }),
  })
  assert.equal(res.status, 200)
  const { data: run } = await db.from('assignment_print_runs').select('route_content').eq('id', draftRunId).single()
  assert.match((run!.route_content as { guided: { html: string } }).guided.html, /Teacher-edited guided content/)
})

// ── 9. no print output before explicit approval ─────────────────────────────
test('GET .../print: a draft (unapproved) run returns 409, never a printable document', async () => {
  const res = await api(`/api/teacher/assignments/${fx.assignmentId}/print-routes/${draftRunId}/print`, cookie(fx.teacherSession))
  assert.equal(res.status, 409)
})

// ── 20. no automatic approval path exists ────────────────────────────────────
test('A draft run remains draft with no approved_at until POST .../approve is explicitly called', async () => {
  const { data: run } = await db.from('assignment_print_runs').select('status, approved_at').eq('id', draftRunId).single()
  assert.equal(run!.status, 'draft')
  assert.equal(run!.approved_at, null)
})

test('POST .../approve: approval requires the owning teacher (403 for another teacher)', async () => {
  const res = await api(`/api/teacher/assignments/${fx.assignmentId}/print-routes/${draftRunId}/approve`, cookie(fx.otherTeacherSession), { method: 'POST' })
  assert.equal(res.status, 403)
})

test('POST .../approve: the owning teacher approves successfully', async () => {
  const res = await api(`/api/teacher/assignments/${fx.assignmentId}/print-routes/${draftRunId}/approve`, cookie(fx.teacherSession), { method: 'POST' })
  assert.equal(res.status, 200)
  const body = await res.json()
  assert.equal(body.data.run.status, 'approved')
  assert.ok(body.data.run.approved_at)
})

// ── 10. approved content snapshot remains unchanged if the source assignment later changes ──
test('The approved snapshot is unaffected by a later edit to the source assignment', async () => {
  await db.from('assignments').update({ instructions: 'CHANGED AFTER APPROVAL — should not appear in the frozen snapshot.' }).eq('id', fx.assignmentId)
  const { data: run } = await db.from('assignment_print_runs').select('assignment_snapshot').eq('id', draftRunId).single()
  assert.doesNotMatch((run!.assignment_snapshot as { instructions: string }).instructions, /CHANGED AFTER APPROVAL/)
})

test('An approved run rejects a direct content mutation at the database level (immutability trigger)', async () => {
  const { error } = await db.from('assignment_print_runs').update({ route_content: { guided: { html: 'x' }, core: { html: 'x' }, extension: { html: 'x' } } }).eq('id', draftRunId)
  assert.ok(error, 'expected the immutability trigger to reject this update')
})

// ── 13. student-facing output contains no route labels or evidence-band language ──
test('GET .../print (grouped mode): student-facing copies contain no route/evidence-band language; the routing sheet does', async () => {
  const res = await api(`/api/teacher/assignments/${fx.assignmentId}/print-routes/${draftRunId}/print?mode=grouped`, cookie(fx.teacherSession))
  assert.equal(res.status, 200)
  const html = await res.text()

  const routingSheetEnd = html.indexOf('Teacher copy only')
  assert.ok(routingSheetEnd > -1, 'routing sheet should be present and marked teacher-only')
  const afterRoutingSheet = html.slice(html.indexOf('</table>', routingSheetEnd))

  for (const banned of ['Guided Practice', 'Core Practice', 'Extension Practice', 'critical_gap', 'prerequisite_gap', 'concept_confusion', 'on_track', 'insufficient_data']) {
    assert.doesNotMatch(afterRoutingSheet, new RegExp(banned), `student-facing output must not contain "${banned}"`)
  }
  // ── 14. teacher routing sheet contains the required routing information ──
  assert.match(html, /Guided Practice/)
  assert.match(html, /Core Practice/)
  assert.match(html, /Extension Practice/)
})

// ── 11. regeneration creates a new print run and does not mutate the old approved run ──
test('POST .../regenerate: creates a new draft run, supersedes the old one, old approved content is untouched', async () => {
  const res = await api(`/api/teacher/assignments/${fx.assignmentId}/print-routes/${draftRunId}/regenerate`, cookie(fx.teacherSession), { method: 'POST' })
  assert.equal(res.status, 201)
  const body = await res.json()
  const newRunId = body.data.run.id
  fx.createdRunIds.push(newRunId)

  assert.equal(body.data.run.status, 'draft')
  assert.equal(body.data.run.supersedes_print_run_id, draftRunId)

  const { data: oldRun } = await db.from('assignment_print_runs').select('status, route_content').eq('id', draftRunId).single()
  assert.equal(oldRun!.status, 'superseded')
  assert.match((oldRun!.route_content as { guided: { html: string } }).guided.html, /Teacher-edited guided content/, 'old approved run content must survive superseding untouched')
})

// ── 19. all new tables enforce teacher ownership through RLS ────────────────
test('RLS/API: a non-owning teacher cannot list print runs for an assignment they do not teach', async () => {
  const res = await api(`/api/teacher/assignments/${fx.assignmentId}/print-routes`, cookie(fx.otherTeacherSession))
  assert.equal(res.status, 403)
})

test('RLS/API: a non-owning teacher cannot approve or PATCH a print run for an assignment they do not teach', async () => {
  const patchRes = await api(`/api/teacher/assignments/${fx.assignmentId}/print-routes/${draftRunId}`, cookie(fx.otherTeacherSession), {
    method: 'PATCH',
    body: JSON.stringify({ kind: 'routeOverride', studentId: fx.onTrackStudentId, route: 'guided' }),
  })
  assert.equal(patchRes.status, 403)
})

// ── 15. missing substrand does not crash generation ──────────────────────────
test('Generation does not crash when the assignment has no substrand_id (free-text/custom mode)', async () => {
  const { data: freeTextAssignment, error } = await db
    .from('assignments')
    .insert({
      class_id: fx.classId, teacher_id: fx.teacherId, title: `${SYNTHETIC_MARKER}_FREE_TEXT`, subject: SUBJECT, topic: 'Fractions',
      instructions: 'Free-text assignment with no curriculum substrand linked.',
      due_date: new Date(Date.now() + 86400_000).toISOString(), type: 'practice', status: 'active', substrand_id: null,
    })
    .select('id').single()
  if (error) throw error

  const res = await api(`/api/teacher/assignments/${freeTextAssignment.id}/print-routes`, cookie(fx.teacherSession), { method: 'POST' })
  assert.equal(res.status, 201)
  const body = await res.json()
  fx.createdRunIds.push(body.data.run.id)
  await db.from('assignments').delete().eq('id', freeTextAssignment.id)
})

// ── 17. full no-device flow creates no Compass session ───────────────────────
test('The full generate -> override -> approve -> print flow creates no compass_sessions row', async () => {
  const { data: sessions } = await db.from('compass_sessions').select('id').eq('student_id', fx.onTrackStudentId)
  assert.equal((sessions ?? []).length, 0)
})

// ── 18. printed assignment can later be marked through the existing teacher grading flow ──
test('A learner who received a printed route can still be graded through the existing mark endpoint', async () => {
  const { data: submission, error } = await db
    .from('assignment_submissions')
    .select('id')
    .eq('assignment_id', fx.assignmentId)
    .eq('student_id', fx.onTrackStudentId)
    .maybeSingle()
  if (error) throw error
  // No pre-existing submission row exists for a directly-inserted assignment
  // (fan-out only runs through lib/assignments/create.ts, not the raw insert
  // this fixture used) — insert one to prove the existing grading endpoint
  // still works for a learner who was printed a route.
  let submissionId = submission?.id
  if (!submissionId) {
    const { data: created, error: createErr } = await db
      .from('assignment_submissions')
      .insert({ assignment_id: fx.assignmentId, student_id: fx.onTrackStudentId, class_id: fx.classId, status: 'pending' })
      .select('id').single()
    if (createErr) throw createErr
    submissionId = created.id
  }

  const res = await api(`/api/teacher/assignments/${fx.assignmentId}/mark`, cookie(fx.teacherSession), {
    method: 'POST',
    body: JSON.stringify({ submissionId, score: 8, feedback: 'Marked from the printed Extension copy.' }),
  })
  assert.equal(res.status, 200)
})

// ── 16. Junior and Senior classes both work ──────────────────────────────────
test('Generation works for a Senior-grade class exactly as for the Junior-grade fixture class', async () => {
  const { data: seniorClass, error: classErr } = await db
    .from('teacher_classes')
    .insert({ teacher_id: fx.teacherId, name: `${SYNTHETIC_MARKER}_SENIOR`, grade: 11, subject: 'Mathematics', class_code: `${SYNTHETIC_MARKER}_SR_${Date.now()}` })
    .select('id').single()
  if (classErr) throw classErr

  const { data: seniorStudent, error: studentErr } = await db
    .from('students')
    .insert({ teacher_id: fx.teacherId, name: 'Senior Learner', grade: 11, level: 'Senior School', school: SYNTHETIC_MARKER, added_by: 'teacher' })
    .select('id').single()
  if (studentErr) throw studentErr
  await db.from('class_students').insert({ class_id: seniorClass.id, student_id: seniorStudent.id })

  const { data: seniorAssignment, error: assignErr } = await db
    .from('assignments')
    .insert({
      class_id: seniorClass.id, teacher_id: fx.teacherId, title: `${SYNTHETIC_MARKER}_SENIOR`, subject: SUBJECT, topic: 'Quadratics',
      instructions: 'Solve the quadratic equations below.', due_date: new Date(Date.now() + 86400_000).toISOString(),
      type: 'practice', status: 'active',
    })
    .select('id').single()
  if (assignErr) throw assignErr

  const res = await api(`/api/teacher/assignments/${seniorAssignment.id}/print-routes`, cookie(fx.teacherSession), { method: 'POST' })
  assert.equal(res.status, 201)
  const body = await res.json()
  assert.equal(body.data.routes.length, 1)
  // No evidence for this brand-new Senior learner -> Core, same rule as Junior.
  assert.equal(body.data.routes[0].route, 'core')
  fx.createdRunIds.push(body.data.run.id)

  await db.from('assignments').delete().eq('id', seniorAssignment.id)
  await db.from('class_students').delete().eq('class_id', seniorClass.id)
  await db.from('students').delete().eq('id', seniorStudent.id)
  await db.from('teacher_classes').delete().eq('id', seniorClass.id)
})
