// scripts/verify-print-routes.ts — ONE-OFF verification. Exercises the real
// Printable Adaptive Assignments pilot end-to-end against the live database:
// creates a real teacher + Grade 9 class + a roster spanning the routing
// taxonomy (critical/gap/confusion/on-track/no-evidence), a real assignment,
// then calls the actual service functions (generatePrintRun -> override ->
// approve -> render) exactly as the API routes do, using a real signed-in
// Supabase session (not the service-role client) so requireAuthentication/
// requireClassTeacher run for real. Writes the combined printable HTML to
// Desktop for visual verification, then cleans up every row it created.
//
// Run: npx tsx --env-file=.env.local scripts/verify-print-routes.ts

import * as dotenv from 'dotenv'
import * as path from 'path'
import * as fs from 'fs'
dotenv.config({ path: path.resolve(__dirname, '../.env.local') })

import { createClient as createSupabaseJsClient } from '@supabase/supabase-js'

const SYNTHETIC_MARKER = 'SYNTHETIC_PRINT_ROUTES_VERIFY'
const SUBJECT = 'mathematics'
const YEAR = 2026

async function main() {
  const { createServiceClient } = await import('../utils/supabase/service')
  const { runCsvIngestion } = await import('../lib/intelligence/runCsvIngestion')
  const { generatePrintRun, overrideLearnerRoute, approvePrintRun } = await import('../lib/assignments/printRoutes')
  const { buildPrintRouteDocument } = await import('../lib/assignments/printRoutePdf')
  const { repos } = await import('../lib/repositories')

  const db = createServiceClient()
  const cleanup: Array<() => Promise<void>> = []

  try {
    console.log('▸ Creating synthetic teacher + Grade 9 class + roster…')
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
      .insert({ teacher_id: teacher.id, name: `${SYNTHETIC_MARKER}_G9`, grade: 9, subject: 'Mathematics', class_code: `${SYNTHETIC_MARKER}_${Date.now()}` })
      .select('id').single()
    if (clsErr) throw clsErr
    cleanup.push(async () => { await db.from('teacher_classes').delete().eq('id', cls.id) })

    const names = ['Critical Learner', 'Gap Learner', 'Confusion Learner', 'On Track Learner', 'No Evidence Learner']
    const studentIds: string[] = []
    for (const name of names) {
      const { data: s, error } = await db
        .from('students')
        .insert({ teacher_id: teacher.id, name, grade: 9, level: 'Junior School', school: SYNTHETIC_MARKER, added_by: 'teacher' })
        .select('id').single()
      if (error) throw error
      studentIds.push(s.id)
    }
    await db.from('class_students').insert(studentIds.map(student_id => ({ class_id: cls.id, student_id })))
    cleanup.push(async () => {
      await db.from('class_students').delete().eq('class_id', cls.id)
      await db.from('students').delete().in('id', studentIds)
    })

    console.log('▸ Seeding real evidence across the routing taxonomy…')
    await runCsvIngestion({
      fileContents: ['name,Mathematics', `${names[0]},35`].join('\n'),
      teacherId: teacher.id, initiatedBy: authUser.user.id, institution: SYNTHETIC_MARKER,
      academicYear: YEAR, term: 1, assessmentType: 'cat',
    })
    const t2Scores: Record<string, number> = { [names[0]]: 15, [names[1]]: 40, [names[2]]: 62, [names[3]]: 95 }
    for (const [name, score] of Object.entries(t2Scores)) {
      await runCsvIngestion({
        fileContents: ['name,Mathematics', `${name},${score}`].join('\n'),
        teacherId: teacher.id, initiatedBy: authUser.user.id, institution: SYNTHETIC_MARKER,
        academicYear: YEAR, term: 2, assessmentType: 'cat',
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

    console.log('▸ Creating the assignment…')
    const { data: assignment, error: assignErr } = await db
      .from('assignments')
      .insert({
        class_id: cls.id, teacher_id: teacher.id, title: 'Ratios and Proportions', subject: SUBJECT, topic: 'Ratios',
        instructions: 'Solve the ratio and proportion problems below, showing your working for every step.',
        due_date: new Date(Date.now() + 7 * 86400_000).toISOString(), type: 'practice', status: 'active',
      })
      .select('id').single()
    if (assignErr) throw assignErr
    cleanup.push(async () => { await db.from('assignments').delete().eq('id', assignment.id) })

    console.log('▸ Signing in as the teacher (real session, not service-role)…')
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL!
    const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
    const teacherClient = createSupabaseJsClient(url, anonKey)
    const { error: signInErr } = await teacherClient.auth.signInWithPassword({ email, password })
    if (signInErr) throw signInErr

    console.log('▸ generatePrintRun() — real service call, real auth, real routing…')
    const { run, routes } = await generatePrintRun(teacherClient, assignment.id)
    console.log('  run.status =', run.status)
    for (const r of routes) {
      const name = names[studentIds.indexOf(r.student_id)]
      console.log(`  ${name.padEnd(20)} -> ${r.route.padEnd(10)} (${r.evidence_band ?? 'no evidence'})`)
    }

    console.log('▸ Teacher overrides the Confusion Learner to Extension…')
    await overrideLearnerRoute(teacherClient, assignment.id, run.id, studentIds[2], 'extension')

    console.log('▸ approvePrintRun()…')
    const approved = await approvePrintRun(teacherClient, assignment.id, run.id)
    console.log('  approved.status =', approved.status, 'approved_at =', approved.approved_at)

    console.log('▸ Rendering combined printable document (grouped mode)…')
    const finalRoutes = await repos.assignmentPrintRuns.listRoutesForRun(run.id)
    const roster = await repos.assignments.listClassRoster(cls.id)
    const studentNames = Object.fromEntries(roster.map(s => [s.id, s.name]))
    const html = buildPrintRouteDocument({
      run: approved,
      routes: finalRoutes,
      studentNames,
      meta: { school: 'Mwatate Ridge Senior School (synthetic)', grade: '9', className: 'Grade 9 (synthetic)' },
      mode: 'grouped',
    })
    const outPath = '/home/the-dev/Desktop/printable-adaptive-routes-grade9-sample.html'
    fs.writeFileSync(outPath, html, 'utf-8')
    console.log(`  wrote ${outPath}`)

    console.log('▸ Verifying immutability trigger…')
    const { error: mutateErr } = await db
      .from('assignment_print_runs')
      .update({ route_content: { guided: { html: 'x' }, core: { html: 'x' }, extension: { html: 'x' } } })
      .eq('id', run.id)
    console.log('  direct mutation of approved run rejected:', !!mutateErr, mutateErr?.message)

    console.log('\n✅ End-to-end verification complete.')
  } finally {
    console.log('▸ Cleaning up synthetic fixtures…')
    for (const fn of cleanup.reverse()) {
      try { await fn() } catch (err) { console.error('  cleanup step failed:', err instanceof Error ? err.message : String(err)) }
    }
  }
}

main().catch((err) => {
  console.error('Fatal:', err)
  process.exit(1)
})
