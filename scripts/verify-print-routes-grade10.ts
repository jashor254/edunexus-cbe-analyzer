// scripts/verify-print-routes-grade10.ts — ONE-OFF verification, Senior
// (Grade 10) parity check for the Printable Adaptive Assignments pilot.
// Smaller roster than the Grade 9 verification script (2 learners) —
// purpose is confirming the pipeline works unchanged for a Senior class,
// not re-proving the full routing matrix (already proven in
// scripts/verify-print-routes.ts and lib/assignments/printRoutes.pure.test.ts).
//
// Run: npx tsx --env-file=.env.local scripts/verify-print-routes-grade10.ts

import * as dotenv from 'dotenv'
import * as path from 'path'
import * as fs from 'fs'
dotenv.config({ path: path.resolve(__dirname, '../.env.local') })

import { createClient as createSupabaseJsClient } from '@supabase/supabase-js'

const SYNTHETIC_MARKER = 'SYNTHETIC_PRINT_ROUTES_G10_VERIFY'
const SUBJECT = 'mathematics'

async function main() {
  const { createServiceClient } = await import('../utils/supabase/service')
  const { runCsvIngestion } = await import('../lib/intelligence/runCsvIngestion')
  const { generatePrintRun, approvePrintRun } = await import('../lib/assignments/printRoutes')
  const { buildPrintRouteDocument } = await import('../lib/assignments/printRoutePdf')
  const { repos } = await import('../lib/repositories')

  const db = createServiceClient()
  const cleanup: Array<() => Promise<void>> = []

  try {
    const email = `${SYNTHETIC_MARKER.toLowerCase()}-${Date.now()}@example.com`
    const password = `Test!${Math.random().toString(36).slice(2, 10)}`
    const { data: authUser, error: authErr } = await db.auth.admin.createUser({ email, password, email_confirm: true })
    if (authErr) throw authErr
    cleanup.push(async () => { await db.auth.admin.deleteUser(authUser.user.id) })

    const { data: teacher, error: teacherErr } = await db
      .from('teachers').insert({ user_id: authUser.user.id, full_name: SYNTHETIC_MARKER, school: SYNTHETIC_MARKER })
      .select('id').single()
    if (teacherErr) throw teacherErr
    cleanup.push(async () => { await db.from('teachers').delete().eq('id', teacher.id) })

    const { data: cls, error: clsErr } = await db
      .from('teacher_classes')
      .insert({ teacher_id: teacher.id, name: `${SYNTHETIC_MARKER}_G10`, grade: 10, subject: 'Mathematics', class_code: `${SYNTHETIC_MARKER}_${Date.now()}` })
      .select('id').single()
    if (clsErr) throw clsErr
    cleanup.push(async () => { await db.from('teacher_classes').delete().eq('id', cls.id) })

    const names = ['Thin Evidence Senior', 'Thick Evidence Senior']
    const studentIds: string[] = []
    for (const name of names) {
      const { data: s, error } = await db
        .from('students')
        .insert({ teacher_id: teacher.id, name, grade: 10, level: 'Senior School', school: SYNTHETIC_MARKER, added_by: 'teacher' })
        .select('id').single()
      if (error) throw error
      studentIds.push(s.id)
    }
    await db.from('class_students').insert(studentIds.map(student_id => ({ class_id: cls.id, student_id })))
    cleanup.push(async () => {
      await db.from('class_students').delete().eq('class_id', cls.id)
      await db.from('students').delete().in('id', studentIds)
    })

    // Thick Evidence Senior gets two real rounds; Thin Evidence Senior gets none.
    for (const term of [1, 2]) {
      await runCsvIngestion({
        fileContents: ['name,Mathematics', `${names[1]},${term === 1 ? 55 : 88}`].join('\n'),
        teacherId: teacher.id, initiatedBy: authUser.user.id, institution: SYNTHETIC_MARKER,
        academicYear: 2026, term, assessmentType: 'cat',
      })
    }
    cleanup.push(async () => {
      const { data: runs } = await db.from('ingestion_runs').select('id').eq('teacher_id', teacher.id)
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
      await db.from('learner_projections').delete().in('learner_id', studentIds)
    })

    const { data: assignment, error: assignErr } = await db
      .from('assignments')
      .insert({
        class_id: cls.id, teacher_id: teacher.id, title: 'Quadratic Equations', subject: SUBJECT, topic: 'Quadratics',
        instructions: 'Solve each quadratic equation by factorisation, showing every step.',
        due_date: new Date(Date.now() + 7 * 86400_000).toISOString(), type: 'practice', status: 'active',
      })
      .select('id').single()
    if (assignErr) throw assignErr
    cleanup.push(async () => { await db.from('assignments').delete().eq('id', assignment.id) })

    const url = process.env.NEXT_PUBLIC_SUPABASE_URL!
    const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
    const teacherClient = createSupabaseJsClient(url, anonKey)
    const { error: signInErr } = await teacherClient.auth.signInWithPassword({ email, password })
    if (signInErr) throw signInErr

    const { run, routes } = await generatePrintRun(teacherClient, assignment.id)
    for (const r of routes) {
      const name = names[studentIds.indexOf(r.student_id)]
      console.log(`  ${name.padEnd(22)} -> ${r.route.padEnd(10)} (${r.evidence_band ?? 'no evidence'})`)
    }
    const approved = await approvePrintRun(teacherClient, assignment.id, run.id)

    const finalRoutes = await repos.assignmentPrintRuns.listRoutesForRun(run.id)
    const roster = await repos.assignments.listClassRoster(cls.id)
    const studentNames = Object.fromEntries(roster.map(s => [s.id, s.name]))
    const html = buildPrintRouteDocument({
      run: approved, routes: finalRoutes, studentNames,
      meta: { school: 'Reference Senior School (synthetic)', grade: '10', className: 'Grade 10 (synthetic)' },
      mode: 'grouped',
    })
    fs.writeFileSync('/home/the-dev/Desktop/printable-adaptive-routes-grade10-sample.html', html, 'utf-8')
    console.log('✅ Grade 10 verification complete.')
  } finally {
    for (const fn of cleanup.reverse()) {
      try { await fn() } catch (err) { console.error('cleanup failed:', err instanceof Error ? err.message : String(err)) }
    }
  }
}

main().catch((err) => { console.error('Fatal:', err); process.exit(1) })
