// scripts/seed-demo-teacher.ts
// Creates a demo teacher with 3 weeks of historical CBC Grade 8 Math data for the June 24 demo.
//
// Run: npx tsx scripts/seed-demo-teacher.ts
//
// REAL code paths used — no parallel implementations:
//   SOW content:    generateSchemePipeline   (lib/sow/lessonPipeline.ts)
//   Lesson plans:   generateSpecificWeekPlans (lib/lessonPlan/weeklyGenerator.ts)
//   Evaluations:    submitEvaluation          (lib/lessonPlan/evaluation.ts)
//   Weekly intel:   runTIEForSOW              (lib/teachingIntelligence/weeklyGenerator.ts)
//
// Idempotent: re-running detects the demo teacher by email and skips creation.
// Zero production side-effects: no "if demo" branches in any lib/ or app/ file.

import * as dotenv from 'dotenv'
import * as path from 'path'
dotenv.config({ path: path.resolve(__dirname, '../.env.local') })

import { createClient } from '@supabase/supabase-js'
import { buildTermSchedule } from '../lib/sow/termSchedule'
import { applyBreaksToSchedule } from '../lib/sow/breakEngine'
import { generateSchemePipeline } from '../lib/sow/lessonPipeline'
import { generateSpecificWeekPlans } from '../lib/lessonPlan/weeklyGenerator'
import { submitEvaluation } from '../lib/lessonPlan/evaluation'
import { runTIEForSOW } from '../lib/teachingIntelligence/weeklyGenerator'
import type { SOWContext, SelectedSubstrand, TimelineSlot } from '../lib/sow/types'

// ─── Config ───────────────────────────────────────────────────────────────────
const DEMO_EMAIL    = 'demo-teacher@edunexus.test'
const DEMO_PASSWORD = process.env.DEMO_PASSWORD ?? (() => { throw new Error('Set DEMO_PASSWORD in .env.local') })()
const DEMO_NAME     = 'Amara Demo'
const DEMO_SCHOOL   = 'EduNexus Demo School'
const LESSONS_PER_WEEK = 3
const DEMO_WEEKS       = 3     // weeks 1, 2, 3
const DEMO_TERM        = 2
const DEMO_YEAR        = 2026

// Dates backdated so the Friday cron runs against realistic history.
// Week 3 taught_date = 1 week ago → within the cron's 7-day window tomorrow.
const today = new Date()
const weekDate = (weeksAgo: number): string =>
  new Date(today.getTime() - weeksAgo * 7 * 24 * 60 * 60 * 1000)
    .toISOString()
    .slice(0, 10)

const TAUGHT_DATES = {
  1: weekDate(3),
  2: weekDate(2),
  3: weekDate(1),
}

// ─── DB client (service role — same client factory scripts/qa* use) ───────────
const db = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL as string,
  process.env.SUPABASE_SERVICE_ROLE_KEY as string,
  { auth: { autoRefreshToken: false, persistSession: false } }
)

// ─── Step 1: Create or reuse demo teacher ────────────────────────────────────
async function ensureDemoTeacher(): Promise<{ authUserId: string; teachersId: string }> {
  console.log('\n[1/6] Checking demo teacher account…')

  // Check if auth user exists
  const { data: listData } = await db.auth.admin.listUsers()
  const existing = (listData.users as Array<{ id: string; email?: string }>).find(u => u.email === DEMO_EMAIL)

  let authUserId: string

  if (existing) {
    authUserId = existing.id
    console.log(`  ↳ Found existing auth user: ${authUserId}`)
  } else {
    const { data: created, error } = await db.auth.admin.createUser({
      email:          DEMO_EMAIL,
      password:       DEMO_PASSWORD,
      email_confirm:  true,
    })
    if (error) throw new Error(`Auth user creation failed: ${error.message}`)
    authUserId = created.user.id
    console.log(`  ↳ Created auth user: ${authUserId}`)

    // profiles row (role = 'teacher')
    await db.from('profiles').upsert(
      { id: authUserId, role: 'teacher', updated_at: new Date().toISOString() },
      { onConflict: 'id' }
    )
  }

  // Check for teachers row
  const { data: existingTeacher } = await db
    .from('teachers')
    .select('id')
    .eq('user_id', authUserId)
    .maybeSingle()

  let teachersId: string

  if (existingTeacher) {
    teachersId = (existingTeacher as { id: string }).id
    console.log(`  ↳ Found existing teacher record: ${teachersId}`)
  } else {
    const { data: teacher, error: tErr } = await db
      .from('teachers')
      .insert({
        user_id:      authUserId,
        full_name:    DEMO_NAME,
        school:       DEMO_SCHOOL,
        subject:      'Mathematics',
        grade_levels: [7, 8, 9],
        is_verified:  true,
      })
      .select('id')
      .single()
    if (tErr || !teacher) throw new Error(`Teacher insert failed: ${tErr?.message}`)
    teachersId = (teacher as { id: string }).id
    console.log(`  ↳ Created teacher record: ${teachersId}`)
  }

  return { authUserId, teachersId }
}

// ─── Step 2: Check for existing demo SOW ─────────────────────────────────────
async function findExistingSOW(teachersId: string): Promise<string | null> {
  const { data } = await db
    .from('schemes_of_work')
    .select('id')
    .eq('teacher_id', teachersId)
    .ilike('learning_area', '%math%')
    .eq('term', DEMO_TERM)
    .eq('year', DEMO_YEAR)
    .maybeSingle()

  return data ? (data as { id: string }).id : null
}

// ─── Step 3+4: Build and save SOW ────────────────────────────────────────────
async function createDemoSOW(teachersId: string, authUserId: string): Promise<{ sowId: string; grade: string; learningArea: string }> {
  console.log('\n[2/6] Fetching Grade 8 Mathematics substrands from KICD curriculum…')

  // Walk the DB hierarchy: level → grade → learning area → strands → substrands
  const { data: levels } = await db
    .from('sow_levels')
    .select('id')
    .eq('curriculum_type', 'cbc_junior')
    .order('order_index')
    .limit(1)
  if (!levels?.length) throw new Error('No cbc_junior level found in DB')
  const levelId = (levels[0] as { id: string }).id

  const { data: gradeRows } = await db
    .from('sow_grades')
    .select('id, name')
    .eq('level_id', levelId)
    .eq('is_active', true)
    .ilike('name', 'Grade 8%')
    .order('order_index')
    .limit(1)
  if (!gradeRows?.length) throw new Error('Grade 8 not found in sow_grades')
  const gradeRow = gradeRows[0] as { id: string; name: string }

  const { data: areas } = await db
    .from('sow_learning_areas')
    .select('id, name')
    .eq('grade_id', gradeRow.id)
    .ilike('name', '%math%')
    .order('order_index')
    .limit(1)
  if (!areas?.length) throw new Error('Mathematics not found in sow_learning_areas for Grade 8')
  const area = areas[0] as { id: string; name: string }

  const { data: strands } = await db
    .from('sow_strands')
    .select('id, title')
    .eq('learning_area_id', area.id)
    .order('order_index')
    .limit(3)
  if (!strands?.length) throw new Error('No strands found for Grade 8 Mathematics')

  const strandIds = (strands as Array<{ id: string; title: string }>).map(s => s.id)
  const { data: allSubs } = await db
    .from('sow_substrands')
    .select('id, strand_id, title, order_index')
    .in('strand_id', strandIds)
    .order('order_index')
    .limit(5)
  if (!allSubs || allSubs.length < 2) throw new Error('Not enough substrands found')

  const subs = allSubs as Array<{ id: string; strand_id: string; title: string; order_index: number }>
  const strandMap = new Map((strands as Array<{ id: string; title: string }>).map(s => [s.id, s.title]))

  // We want 5 substrands so distributeSlots gives [2,2,2,2,1] over 9 slots.
  // Sub 2 (index 1) spans W1L3 + W2L1 → PACE_MISMATCH candidate (flagged in both weeks)
  // Sub 5 (index 4) gets 1 slot → W3L3 → CONCEPT_LEAP candidate (first and only teaching)
  const selectedSubstrands: SelectedSubstrand[] = subs.slice(0, 5).map((sub, i) => ({
    strandId:       sub.strand_id,
    strandTitle:    strandMap.get(sub.strand_id) ?? 'Strand',
    substrandId:    sub.id,
    substrandTitle: sub.title,
    lessonsRequired: 2,  // overridden by distributeSlots internally
    orderIndex:      i,
  }))

  console.log(`  ↳ ${area.name} / Grade ${gradeRow.name}`)
  console.log(`  ↳ ${selectedSubstrands.length} substrands selected`)
  selectedSubstrands.forEach((s, i) => console.log(`     [${i}] ${s.substrandTitle} (strand: ${s.strandTitle})`))

  // Build timeline: weeks 1–3, 3 lessons/week, no breaks
  const termSchedule = buildTermSchedule({
    lessonsPerWeek:   LESSONS_PER_WEEK,
    firstWeek:        1,
    firstLesson:      1,
    lastWeek:         DEMO_WEEKS,
    lastLesson:       LESSONS_PER_WEEK,
    doubleLessonOption: 'single',
  })
  const timeline: TimelineSlot[] = applyBreaksToSchedule(termSchedule, [])
  console.log(`  ↳ Timeline: ${timeline.length} slots, weeks 1–${DEMO_WEEKS}`)

  // SOW context — same shape as the real generate route uses
  const context: SOWContext = {
    school:            DEMO_SCHOOL,
    teacherName:       DEMO_NAME,
    grade:             gradeRow.name,
    gradeName:         gradeRow.name,
    learningArea:      area.name,
    learningAreaName:  area.name,
    term:              DEMO_TERM,
    year:              DEMO_YEAR,
    curriculumMode:    'cbc_junior',
  }

  console.log('\n[3/6] Generating SOW via generateSchemePipeline (AI)…')
  const result = await generateSchemePipeline({ timeline, selectedSubstrands, context })
  console.log(`  ↳ ${result.lessons.length} lessons generated (${result.failures.length} failures)`)

  // Save SOW to DB — same columns as app/api/sow/save/route.ts
  const teachingSlots = result.lessons.map(l => ({ week: l.week, lesson: l.lesson, isBreak: false }))
  const sowTimeline: TimelineSlot[] = teachingSlots.map((s, i) => ({
    slotIndex: i + 1,
    week: s.week,
    lesson: s.lesson,
    isBreak: false,
  }))

  const { data: sow, error: sowErr } = await db
    .from('schemes_of_work')
    .insert({
      teacher_id:       teachersId,
      school:           DEMO_SCHOOL,
      grade:            gradeRow.name,
      learning_area:    area.name,
      term:             DEMO_TERM,
      year:             DEMO_YEAR,
      curriculum_mode:  'cbc_junior',
      total_lessons:    result.lessons.length,
      total_weeks:      DEMO_WEEKS,
      lessons_per_week: LESSONS_PER_WEEK,
      average_confidence: 0.82,
      breaks:           [],
      lessons:          result.lessons,
      timeline:         sowTimeline,
      teacher_name:     DEMO_NAME,
      tsc_number:       null,
      status:           'active',
      created_at:       new Date().toISOString(),
    })
    .select('id')
    .single()

  if (sowErr || !sow) throw new Error(`SOW insert failed: ${sowErr?.message}`)
  const sowId = (sow as { id: string }).id
  console.log(`  ↳ SOW saved: ${sowId}`)

  return { sowId, grade: gradeRow.name, learningArea: area.name }
}

// ─── Step 5: Generate lesson plans for weeks 1–3 ─────────────────────────────
async function generatePlans(sowId: string, authUserId: string): Promise<void> {
  console.log('\n[4/6] Generating lesson plans for weeks 1–3 (AI)…')
  for (const week of [1, 2, 3]) {
    const r = await generateSpecificWeekPlans(sowId, authUserId, week)
    console.log(`  ↳ Week ${week}: ${r.generated} plan(s) generated`)
  }
}

// ─── Step 6: Mark taught + submit evaluations ─────────────────────────────────
// Distribution from distributeSlots([2,2,2,2,1]) over 9 slots:
//   Sub 0 (2 lessons): W1L1, W1L2  → Hapana + Hapana
//   Sub 1 (2 lessons): W1L3, W2L1  → Kidogo (W1L3) + Kidogo (W2L1)  ← PACE_MISMATCH
//   Sub 2 (2 lessons): W2L2, W2L3  → Hapana + Hapana
//   Sub 3 (2 lessons): W3L1, W3L2  → Hapana + Hapana
//   Sub 4 (1 lesson):  W3L3        → Ndiyo                           ← CONCEPT_LEAP
async function submitAllEvaluations(
  sowId: string,
  authUserId: string,
  selectedSubstrands: SelectedSubstrand[]
): Promise<{ paceMatchSub: string; conceptLeapSub: string }> {
  console.log('\n[5/6] Marking lessons taught + submitting evaluations…')

  // Fetch all lesson plans for this SOW ordered by week + lesson
  const { data: plans, error: plErr } = await db
    .from('lesson_plans')
    .select('id, week_number, lesson_number, sub_strand')
    .eq('sow_id', sowId)
    .eq('teacher_id', authUserId)
    .order('week_number')
    .order('lesson_number')

  if (plErr || !plans?.length) throw new Error(`No lesson plans found: ${plErr?.message}`)

  type PlanRow = { id: string; week_number: number; lesson_number: number; sub_strand: string }
  const rows = plans as PlanRow[]

  // Map lesson slot index → followUp. Slot ordering matches distributeSlots output.
  // Slots: W1L1=0, W1L2=1, W1L3=2, W2L1=3, W2L2=4, W2L3=5, W3L1=6, W3L2=7, W3L3=8
  const followUpByIndex: Array<'none' | 'minor' | 'major'> = [
    'none',   // slot 0: W1L1 — no issue
    'none',   // slot 1: W1L2 — no issue
    'minor',  // slot 2: W1L3 — Sub 1, first flag (Kidogo) → PACE_MISMATCH eventually
    'minor',  // slot 3: W2L1 — Sub 1, second flag (Kidogo)
    'none',   // slot 4: W2L2 — no issue
    'none',   // slot 5: W2L3 — no issue
    'none',   // slot 6: W3L1 — no issue
    'none',   // slot 7: W3L2 — no issue
    'major',  // slot 8: W3L3 — Sub 4, first and only lesson, Ndiyo → CONCEPT_LEAP
  ]

  const paceMatchSub = rows[2]?.sub_strand ?? ''  // W1L3 = Sub 1's first lesson
  const conceptLeapSub = rows[8]?.sub_strand ?? '' // W3L3 = Sub 4's only lesson

  for (let i = 0; i < rows.length; i++) {
    const plan = rows[i]
    const followUp = followUpByIndex[i] ?? 'none'
    const taughtDate = TAUGHT_DATES[plan.week_number as 1 | 2 | 3]

    // Mark as taught with backdated date (direct DB update — no business logic, same as mark-taught route)
    await db
      .from('lesson_plans')
      .update({ status: 'taught', taught_date: taughtDate })
      .eq('id', plan.id)

    // Submit real evaluation via lib function (substrand_health fires naturally)
    await submitEvaluation(plan.id, authUserId, {
      evaluation:       followUp === 'none'
        ? 'Lesson went well. Students engaged throughout.'
        : 'Some students needed additional support with this concept.',
      followUp,
      reflectionSource: 'manual',
    })

    const label = followUp === 'none' ? 'Hapana ✓' : followUp === 'minor' ? 'Kidogo ⚠' : 'Ndiyo ✖'
    console.log(`  ↳ W${plan.week_number}L${plan.lesson_number} [${plan.sub_strand.slice(0, 30)}] → ${label}`)
  }

  return { paceMatchSub, conceptLeapSub }
}

// ─── Step 7: Backdate last_flagged for PACE_MISMATCH substrand ────────────────
async function backdateFlags(sowId: string, paceMatchSub: string): Promise<void> {
  console.log('\n  Backdating substrand_health.last_flagged for PACE_MISMATCH substrand…')
  const twentyOneDaysAgo = new Date(today.getTime() - 21 * 24 * 60 * 60 * 1000).toISOString()

  await db
    .from('substrand_health')
    .update({ last_flagged: twentyOneDaysAgo, updated_at: new Date().toISOString() })
    .eq('sow_id', sowId)
    .eq('sub_strand', paceMatchSub)

  console.log(`  ↳ last_flagged set to ${twentyOneDaysAgo.slice(0, 10)} for: ${paceMatchSub}`)
}

// ─── Step 8: Run TIE for weeks 1 and 2 ───────────────────────────────────────
async function backfillWeeklyIntelligence(
  sowId: string,
  teachersId: string,
  grade: string,
  learningArea: string
): Promise<void> {
  console.log('\n[6/6] Backfilling weekly_intelligence for weeks 1 and 2…')

  for (const week of [1, 2]) {
    const result = await runTIEForSOW(
      sowId,
      teachersId,
      { grade, learningArea },
      { overrideWeek: week }
    )
    console.log(`  ↳ Week ${week}: processed=${result.processed}, lessons=${result.lessonsAnalyzed}${result.skipped ? `, skipped=${result.skipped}` : ''}`)
  }
}

// ─── Main ─────────────────────────────────────────────────────────────────────
async function main() {
  console.log('═══════════════════════════════════════════════════════')
  console.log('  EduNexus Demo Teacher Seed — June 24 Demo')
  console.log('═══════════════════════════════════════════════════════')

  const { authUserId, teachersId } = await ensureDemoTeacher()

  const existingSowId = await findExistingSOW(teachersId)
  if (existingSowId) {
    console.log(`\n⚠  Demo SOW already exists (${existingSowId}). Skipping SOW + plan generation.`)
    console.log('   Delete the SOW and lesson_plans rows manually to re-run from scratch.\n')
    process.exit(0)
  }

  const { sowId, grade, learningArea } = await createDemoSOW(teachersId, authUserId)
  await generatePlans(sowId, authUserId)

  // We need selectedSubstrands just for the log — fetch them from the plans
  const { paceMatchSub, conceptLeapSub } = await submitAllEvaluations(sowId, authUserId, [])

  await backdateFlags(sowId, paceMatchSub)
  await backfillWeeklyIntelligence(sowId, teachersId, grade, learningArea)

  // ─── Summary ───────────────────────────────────────────────────────────────
  console.log('\n═══════════════════════════════════════════════════════')
  console.log('  SEED COMPLETE — Summary for June 24 Demo')
  console.log('═══════════════════════════════════════════════════════')
  console.log(`  Demo teacher email:    ${DEMO_EMAIL}`)
  console.log(`  Demo teacher password: ${DEMO_PASSWORD}`)
  console.log(`  SOW:                   ${grade} · ${learningArea} · Term ${DEMO_TERM} ${DEMO_YEAR}`)
  console.log(`  SOW ID:                ${sowId}`)
  console.log('')
  console.log('  Flagged substrands and EXPECTED Friday cron classification:')
  console.log(`  ┌─────────────────────────────────────────────────────────`)
  console.log(`  │ PACE_MISMATCH (persistent)`)
  console.log(`  │   Sub-strand: ${paceMatchSub}`)
  console.log(`  │   Flags: Kidogo (W1) + Kidogo (W2) → struggle_count=2`)
  console.log(`  │   last_flagged backdated to 21 days ago → persistent ✓`)
  console.log(`  ├─────────────────────────────────────────────────────────`)
  console.log(`  │ CONCEPT_LEAP (new)`)
  console.log(`  │   Sub-strand: ${conceptLeapSub}`)
  console.log(`  │   Flags: Ndiyo (W3 only) → struggle_count=1, lessons_covered=1`)
  console.log(`  │   last_flagged = today → new ✓`)
  console.log(`  └─────────────────────────────────────────────────────────`)
  console.log('')
  console.log('  Week 3 is UNPROCESSED — Friday cron (June 19) will classify:')
  console.log('    • PACE_MISMATCH sub-strand → persistent (last_flagged > 7 days ago)')
  console.log('    • CONCEPT_LEAP sub-strand  → new       (last_flagged = today)')
  console.log('')
  console.log('  weekly_intelligence backfilled for weeks 1 and 2. ✓')
  console.log('═══════════════════════════════════════════════════════\n')
}

main().catch(e => { console.error('\n[SEED ERROR]', e); process.exit(1) })
