// scripts/test-kangai-flow.ts
// End-to-end teacher flow test using Kangai Primary School real data.
// Grade 9Y (36 students) + Grade 9G (35 students) = 71 total.
// Skips PDF generation and WhatsApp/email — logs WOULD SEND / WOULD GENERATE instead.
// Does NOT delete existing DB data.
//
// Run: npx tsx scripts/test-kangai-flow.ts

import { config } from 'dotenv'
config({ path: '.env.local' })
import { createServiceClient } from '@/utils/supabase/service'
import { analyzePerformance } from '@/lib/adaptiveLearning'
import { calculateJuniorPathwayAffinity } from '@/lib/pathwayCalculator'
import {
  generateLearningCompassRec,
  formatSubjectName,
} from '@/lib/academicClinic/reportGenerator'
import type { SubjectProgress } from '@/lib/academicClinic/types'

// ─── Retry helper ────────────────────────────────────────────────────────────

async function withRetry<T>(fn: () => Promise<T>, attempts = 3, delayMs = 1500): Promise<T> {
  for (let i = 0; i < attempts; i++) {
    try {
      return await fn()
    } catch (err) {
      if (i === attempts - 1) throw err
      const msg = err instanceof Error ? err.message : String(err)
      process.stderr.write(`\n  [retry ${i + 1}/${attempts - 1}] ${msg}\n`)
      await new Promise(r => setTimeout(r, delayMs * (i + 1)))
    }
  }
  throw new Error('unreachable')
}

// ─── Constants ────────────────────────────────────────────────────────────────

const TEACHER_ID  = '45699ad6-f89c-4376-985f-31730a341801'
const TEACHER_USER_ID = '5cb45b89-0473-40f8-be70-0857424432a7'
const TEACHER_NAME = 'Dennis Kariuki Njeru'
const TERM = 1
const YEAR = 2026
const GRADE = 9
const CURRICULUM = 'cbc'

// CBC conversion: raw 0-100 → 1-4
function toCBC(raw: number): 1 | 2 | 3 | 4 {
  if (raw >= 75) return 4
  if (raw >= 50) return 3
  if (raw >= 25) return 2
  return 1
}

const SUBJECT_KEYS = [
  'mathematics',
  'english',
  'kiswahili',
  'integrated_science',
  'pre_technical_studies',
  'creative_arts_sports',
  'social_studies',
  'cre',
  'agriculture_nutrition',
] as const

type SubjectKey = typeof SUBJECT_KEYS[number]

type StudentRaw = {
  name: string
  scores: Record<SubjectKey, number>
}

// ─── Student Data ─────────────────────────────────────────────────────────────

function makeStudent(
  name: string,
  maths: number, eng: number, kisw: number, sci: number,
  pre_tech: number, ca: number, sst: number, cre: number, agri: number,
): StudentRaw {
  return {
    name,
    scores: {
      mathematics:          maths,
      english:              eng,
      kiswahili:            kisw,
      integrated_science:   sci,
      pre_technical_studies: pre_tech,
      creative_arts_sports: ca,
      social_studies:       sst,
      cre:                  cre,
      agriculture_nutrition: agri,
    },
  }
}

const GRADE_9Y: StudentRaw[] = [
  makeStudent('EVANS NDEGE',         6,  36, 24, 24, 36, 36, 10, 34, 45),
  makeStudent('JOHN MUCHIRI',       23,  52, 38, 29, 58, 60, 31, 42, 62),
  makeStudent('BENARD MACHARIA',     1,  25, 24, 15, 28, 18, 11, 12, 24),
  makeStudent('MORGAN WAWERU',       3,  10, 16, 12, 16, 12,  4,  3, 14),
  makeStudent('JOHN NJANGIRU',       5,  10, 20, 11, 20, 25,  7, 13,  9),
  makeStudent('BRIAN NJUKI',         5,  57, 51, 29, 57, 46, 15, 50, 52),
  makeStudent('DENNIS MACHARIA',     4,  24, 31, 17, 43, 25, 13, 23, 35),
  makeStudent('SAMMY MWANGI',        7,  19, 29,  9, 18, 14,  5,  5,  9),
  makeStudent('BRIAN WACHIRA',       5,  44, 40, 16, 27, 24, 12, 11, 16),
  makeStudent('HESBON MACHARIA',     7,  21, 26, 13, 15, 24,  5, 11, 16),
  makeStudent('DENNIS MURIITHI',     5,  17, 13,  7, 14, 12,  9,  1, 11),
  makeStudent('PATRICK NJIRU',       4,  25, 21, 14, 30, 18,  2, 19, 18),
  makeStudent('MIKE MUNYIRI',        2,   0,  0,  0,  0, 37,  0, 35, 27),
  makeStudent('BENSON MURIMI',       9,  19,  0,  0,  0,  7,  0,  0,  9),
  makeStudent('IAN DAMA',           21,  41, 32, 22, 39, 48, 19, 37, 49),
  makeStudent('AUSTIN MAHIANYU',     6,  19, 25,  8, 13, 19,  6,  7, 13),
  makeStudent('DAVID MUTUGI',        6,  51, 40, 21, 32, 38, 11, 26, 19),
  makeStudent('ERICK MURIMI',       12,  45, 35, 27, 49, 34, 27, 36, 44),
  makeStudent('ROBINSON KINYUA',     6,  44, 42, 25, 95, 40, 22, 39, 44),
  makeStudent('MARY MUTHONI',        5,  19, 12,  8,  9,  5,  7,  4,  6),
  makeStudent('MERCY WANJIRU',      15,  55, 50, 21, 51, 53, 31, 59, 42),
  makeStudent('TUCYLA NYAWIRA',     25,  78, 78, 56, 80, 66, 42, 66, 78),
  makeStudent('LILIAN WAMBUI',      22,  63, 41, 41, 46, 44, 24, 56, 73),
  makeStudent('ABIGAEL WAMBUI',      6,  23, 19,  3, 21, 34, 12, 14, 23),
  makeStudent('JOAN WAMBUI',         4,  39, 34, 20, 38, 25, 16, 19, 21),
  makeStudent('FAITH WAKIO',         9,  55, 43, 20, 36, 20, 14, 31, 32),
  makeStudent('ROSE MUMBI',         10,  51, 33, 28, 30, 35, 17, 21, 19),
  makeStudent('YVONNE WANJIRU',      6,  34, 10, 14, 14, 14,  7, 11, 18),
  makeStudent('SHARON WAITHERA',     6,  24, 12, 12, 11, 13,  3,  8,  9),
  makeStudent('FAITH MUTHONI',       9,  31, 17, 12, 17, 30,  5, 19, 19),
  makeStudent('KAREN WANGARI',       4,  49, 32, 22, 29, 80, 13, 50, 52),
  makeStudent('DORIS NYAKIO',       10,  31, 25, 13, 21, 30, 12, 16, 15),
  makeStudent('JOY JASMINE MUTHONI',20,  69, 66, 54, 74, 62, 33, 85, 80),
  makeStudent('JOYCE WANGECHI',      8,  31, 42, 20, 40, 44, 19, 32, 34),
  makeStudent('OLIVE WANINI',       31,  74, 69, 64, 71, 71, 48, 66, 77),
  makeStudent('WINFRED NYAWIRA',     1,  23, 15, 12, 13, 14,  9,  7, 13),
]

const GRADE_9G: StudentRaw[] = [
  makeStudent('CHINEASE NDIRITU',   31,  66, 72, 75, 79, 74, 70, 80, 32),
  makeStudent('NICHOLUS GIKURU',     5,  40, 32, 21, 40, 30, 15, 26, 24),
  makeStudent('STEVE MUNENE',       15,  36, 21, 26, 32, 34, 12, 25, 45),
  makeStudent('ALEX GICHOBI',       46,  70, 75, 76, 80, 81, 66, 81, 65),
  makeStudent('ALVIN KARIUKI',       6,  32, 15, 37, 37, 36, 13, 33, 42),
  makeStudent('ALFA KINYUA',        10,  28, 36, 36, 27, 33, 14,  6,  9),
  makeStudent('FRANCIS MACHARIA',    3,  14, 14, 12, 10, 17,  7, 57, 56),
  makeStudent('MAXWELL GATIMU',     12,  45, 33, 50, 48, 47, 23, 57, 56),
  makeStudent('VINCENT MURIMI',      6,  15,  9,  6,  6,  8,  6,  4,  8),
  makeStudent('ALBERT NJOGU',       25,  29, 16,  6, 10, 13,  8,  5,  5),
  makeStudent('FILEX NGIRI',         2,  22, 16,  4,  7,  9,  5,  2,  8),
  makeStudent('PATRICK NYAMU',       5,  22,  5, 12, 17, 20,  3,  7, 14),
  makeStudent('STANELY KARIUKI',    44,  12, 14,  3, 16, 11,  2,  4,  6),
  makeStudent('KELVIN MUCHERIA',     7,  39, 42, 24, 34, 49, 14, 33, 36),
  makeStudent('SAMUEL KARHA',        9,  22, 17, 11, 14, 14,  6, 12,  8),
  makeStudent('GEOFREY RUKENYA',     6,  32, 22, 19, 22, 23, 14, 16, 17),
  makeStudent('DONALD MUNENE',       6,  36, 31, 19, 20, 30, 17,  8, 19),
  makeStudent('JUNIOR MUGO',        10,  34, 32, 25, 31, 43,  6, 23, 13),
  makeStudent('LOIUS MURIITHI',     11,  47, 44, 25, 50, 41, 22, 47, 61),
  makeStudent('ALEX GICHUHI',        6,  27, 23, 21, 24, 32, 15, 16, 44),
  makeStudent('FRANKLINE BUNDI',    30,  63, 68, 57, 80, 71, 60, 75, 70),
  makeStudent('GIBSON MAINA',       17,  17, 19,  8,  9,  5,  6,  4, 12),
  makeStudent('RACHEAL NJERI',      12,  32, 48, 26, 31, 43, 25, 49, 59),
  makeStudent('CATHERINE MUNYIVA',  16,  25, 39, 19, 22, 27,  5, 21, 21),
  makeStudent('ABIGAEL WANGECI',    17,  55, 40, 33, 32, 42, 29, 45, 41),
  makeStudent('EVALYNN WAMBUI',      5,  32, 28, 16, 14, 13, 10, 12, 10),
  makeStudent('ROSALED NJERI',      13,  39, 29, 44, 50, 47, 14, 46, 45),
  makeStudent('JOYCE NYAGUTHII',    19,  50, 52, 33, 39, 37, 20, 51, 39),
  makeStudent('KEZIAH WAIRIMU',     13,  36, 16, 24, 20, 32, 14, 27, 23),
  makeStudent('MARYANN WAMBUI',      6,  15, 15,  5, 16, 10,  9,  7,  3),
  makeStudent('LIVIA NYAMBURA',     18,  59, 59, 45, 54, 53, 40, 57, 57),
  makeStudent('HELLEN MUTHONI',     18,  42, 49, 28, 21, 55, 20, 34, 27),
  makeStudent('JOAN MUTHONI',        3,  38, 29, 24, 32, 25, 16, 26, 19),
  makeStudent('MARGARET WAIRIMU',   35,  74, 82, 67, 72, 72, 76, 87, 90),
  makeStudent('MARION WAIRIMU',     58,  75, 90, 84, 81, 80, 74, 83, 82),
]

// ─── Helpers ──────────────────────────────────────────────────────────────────

function sep(char = '─', len = 70) { return char.repeat(len) }

function avgCBC(scores: Record<string, number>): number {
  const vals = Object.values(scores).map(toCBC)
  return vals.reduce((s, v) => s + v, 0) / vals.length
}

function isAbsent(scores: Record<string, number>): boolean {
  return Object.values(scores).some(v => v === 0)
}

function absentSubjects(scores: Record<string, number>): string[] {
  return Object.entries(scores)
    .filter(([, v]) => v === 0)
    .map(([k]) => formatSubjectName(k))
}

function tierLabel(tier: string): string {
  switch (tier) {
    case 'remedial':      return 'Remedial    '
    case 'reinforcement': return 'Reinforcement'
    case 'standard':      return 'Standard    '
    case 'challenge':     return 'Challenge   '
    default:              return tier.padEnd(13)
  }
}

// ─── DB helpers ───────────────────────────────────────────────────────────────

type DB = ReturnType<typeof createServiceClient>

async function findOrCreateClass(
  db: DB,
  name: string,
  grade: number,
): Promise<string> {
  const { data: existing } = await db
    .from('teacher_classes')
    .select('id')
    .eq('teacher_id', TEACHER_ID)
    .eq('name', name)
    .eq('grade', grade)
    .maybeSingle()

  if (existing) {
    console.log(`  ↩  Class "${name}" already exists: ${existing.id}`)
    return existing.id
  }

  const classCode = `${name.replace(/\s+/g, '').toUpperCase()}-${YEAR}`

  const { data, error } = await db
    .from('teacher_classes')
    .insert({
      teacher_id:       TEACHER_ID,
      name,
      grade,
      subject:          'All Subjects',
      curriculum_level: 'Junior School',
      academic_year:    String(YEAR),
      class_code:       classCode,
    })
    .select('id')
    .single()

  if (error || !data) throw new Error(`Create class "${name}": ${error?.message}`)
  console.log(`  ✓  Created class "${name}": ${data.id}`)
  return data.id
}

async function addStudentToClass(
  db: DB,
  classId: string,
  student: StudentRaw,
): Promise<string> {
  // Upsert student (ON CONFLICT on name + teacher_id) — cannot upsert without unique constraint,
  // so check first
  const { data: existing } = await db
    .from('students')
    .select('id')
    .eq('name', student.name)
    .eq('teacher_id', TEACHER_ID)
    .maybeSingle()

  let studentId: string

  if (existing) {
    studentId = existing.id
  } else {
    const { data, error } = await db
      .from('students')
      .insert({
        name:            student.name,
        grade:           GRADE,
        curriculum_type: CURRICULUM,
        level:           'Junior School',
        added_by:        'teacher',
        teacher_id:      TEACHER_ID,
        user_id:         TEACHER_USER_ID, // placeholder — no student auth account yet
      })
      .select('id')
      .single()

    if (error || !data) throw new Error(`Insert student "${student.name}": ${error?.message}`)
    studentId = data.id
  }

  // Link to class (ignore if already linked)
  const { data: existingLink } = await db
    .from('class_students')
    .select('id')
    .eq('class_id', classId)
    .eq('student_id', studentId)
    .maybeSingle()

  if (!existingLink) {
    const { error: linkErr } = await db
      .from('class_students')
      .insert({
        class_id:   classId,
        student_id: studentId,
        parent_id:  TEACHER_USER_ID, // placeholder — NOT NULL with no FK
      })

    if (linkErr) throw new Error(`Link student "${student.name}" to class: ${linkErr.message}`)
  }

  return studentId
}

async function findOrCreateClassAssessment(
  db: DB,
  classId: string,
  title: string,
): Promise<string> {
  const { data: existing } = await db
    .from('class_assessments')
    .select('id')
    .eq('class_id', classId)
    .eq('title', title)
    .maybeSingle()

  if (existing) {
    console.log(`  ↩  Class assessment "${title}" already exists: ${existing.id}`)
    return existing.id
  }

  const { data, error } = await db
    .from('class_assessments')
    .insert({
      class_id:        classId,
      teacher_id:      TEACHER_ID,
      title,
      term:            String(TERM),
      year:            YEAR,
      max_score:       100,
      curriculum_type: CURRICULUM,
      subjects:        [...SUBJECT_KEYS],
    })
    .select('id')
    .single()

  if (error || !data) throw new Error(`Create class assessment: ${error?.message}`)
  console.log(`  ✓  Created class assessment: ${data.id}`)
  return data.id
}

async function upsertAssessment(
  db: DB,
  studentId: string,
  raw: Record<string, number>,
): Promise<string> {
  // Convert raw → CBC
  const cbcScores: Record<string, number> = {}
  for (const [k, v] of Object.entries(raw)) {
    cbcScores[k] = toCBC(v)
  }

  const avgLevel = Math.round(
    Object.values(cbcScores).reduce((s, v) => s + v, 0) / Object.values(cbcScores).length
  )

  // Check if assessment already exists for this student+term+year
  const { data: existing } = await db
    .from('assessments')
    .select('id')
    .eq('student_id', studentId)
    .eq('term', TERM)
    .eq('year', YEAR)
    .maybeSingle()

  if (existing) return existing.id

  const { data, error } = await db
    .from('assessments')
    .insert({
      student_id:      studentId,
      term:            TERM,
      year:            YEAR,
      grade:           GRADE,
      grade_level:     'Junior School',
      curriculum_type: CURRICULUM,
      subject_scores:  cbcScores,
      subject_marks:   raw, // store raw marks separately
    })
    .select('id')
    .single()

  if (error || !data) throw new Error(`Insert assessment for ${studentId}: ${error?.message} | avgLevel=${avgLevel}`)
  return data.id
}

// ─── Pipeline per student ─────────────────────────────────────────────────────

type PipelineResult = {
  studentId:    string
  name:         string
  overallTier:  string
  pathway:      string | null
  confidence:   string | null
  compass:      string
  overallLevel: number
  absent:       boolean
  absentIn:     string[]
}

function runPipeline(student: StudentRaw, studentId: string): PipelineResult {
  const raw = student.scores

  // CBC scores
  const cbcScores: Record<string, number> = {}
  for (const [k, v] of Object.entries(raw)) {
    cbcScores[k] = toCBC(v)
  }

  // Build SubjectProgress array
  const subjects: SubjectProgress[] = SUBJECT_KEYS.map(key => ({
    subject:        key,
    displayName:    formatSubjectName(key),
    level:          cbcScores[key] as 1 | 2 | 3 | 4,
    trend:          'stable' as const,
    velocity:       0,
    previousScores: [],
  }))

  // Adaptive analysis
  const analysis = analyzePerformance(cbcScores)

  // Pathway (grade 7-9)
  const pathway = calculateJuniorPathwayAffinity(cbcScores)

  // Compass
  const compassRec = generateLearningCompassRec(subjects)

  const overallLevel = Math.round(
    subjects.reduce((s, sub) => s + sub.level, 0) / subjects.length
  )

  return {
    studentId,
    name:         student.name,
    overallTier:  analysis.overallTier,
    pathway:      pathway.top_pathway ?? null,
    confidence:   pathway.confidence  ?? null,
    compass:      compassRec.firstSessionSubject,
    overallLevel,
    absent:       isAbsent(raw),
    absentIn:     absentSubjects(raw),
  }
}

async function saveContext(
  db: DB,
  studentId: string,
  assessmentId: string,
  student: StudentRaw,
  result: PipelineResult,
): Promise<void> {
  const raw = student.scores
  const cbcScores: Record<string, number> = {}
  for (const [k, v] of Object.entries(raw)) cbcScores[k] = toCBC(v)

  const analysis    = analyzePerformance(cbcScores)
  const pathwayRec  = calculateJuniorPathwayAffinity(cbcScores)
  const subjects: SubjectProgress[] = SUBJECT_KEYS.map(key => ({
    subject: key, displayName: formatSubjectName(key),
    level: cbcScores[key] as 1|2|3|4, trend: 'stable', velocity: 0, previousScores: [],
  }))
  const compassRec = generateLearningCompassRec(subjects)

  const subjectTiers: Record<string, string>      = {}
  const subjectActionSteps: Record<string, string[]> = {}
  analysis.recommendations.forEach(rec => {
    subjectTiers[rec.subject]       = rec.tier
    subjectActionSteps[rec.subject] = rec.actionSteps
  })

  const { error } = await db.from('student_learning_context').upsert({
    student_id:           studentId,
    user_id:              TEACHER_USER_ID,
    overall_tier:         analysis.overallTier,
    subject_tiers:        subjectTiers,
    subject_action_steps: subjectActionSteps,
    recommended_pathway:  pathwayRec.top_pathway ?? null,
    pathway_confidence:   pathwayRec.confidence  ?? null,
    pathway_scores: {
      STEM:              pathwayRec.stem_score,
      'Social Sciences': pathwayRec.social_sciences_score,
      'Arts & Sports':   pathwayRec.arts_sports_score,
    },
    first_subject:       compassRec.firstSessionSubject,
    session_goal:        compassRec.sessionGoal,
    guided_topics:       compassRec.topicsToAsk,
    overall_level:       result.overallLevel,
    curriculum_type:     CURRICULUM,
    grade:               GRADE,
    last_assessment_id:  assessmentId,
  }, { onConflict: 'student_id' })

  if (error) throw new Error(`Upsert learning context for ${studentId}: ${error.message}`)
}

// ─── Reports ──────────────────────────────────────────────────────────────────

function printClassReport(
  className: string,
  results: PipelineResult[],
) {
  console.log(`\n${sep('═')}`)
  console.log(`  CLASS REPORT — ${className}  (${results.length} students)`)
  console.log(sep('═'))

  const tierOrder = ['remedial', 'reinforcement', 'standard', 'challenge']
  const tierCounts: Record<string, number> = { remedial: 0, reinforcement: 0, standard: 0, challenge: 0 }
  const pathwayCounts: Record<string, number> = {}
  const absentStudents: PipelineResult[] = []

  for (const r of results) {
    tierCounts[r.overallTier] = (tierCounts[r.overallTier] ?? 0) + 1
    if (r.pathway) pathwayCounts[r.pathway] = (pathwayCounts[r.pathway] ?? 0) + 1
    if (r.absent) absentStudents.push(r)
  }

  // Per-student table
  console.log(`\n  ${'Name'.padEnd(26)} Tier            Lvl  Pathway             Compass Subject`)
  console.log(`  ${sep('-', 85)}`)
  for (const r of results) {
    const absent = r.absent ? ' ⚠' : ''
    const name   = r.name.substring(0, 25).padEnd(25)
    const tier   = tierLabel(r.overallTier)
    const lvl    = String(r.overallLevel).padStart(2)
    const path   = (r.pathway ?? '—').padEnd(19)
    const comp   = r.compass
    console.log(`  ${name} ${tier} ${lvl}  ${path} ${comp}${absent}`)
  }

  // Tier summary
  console.log(`\n  ${sep('-')}`)
  console.log(`  TIER BREAKDOWN`)
  for (const t of tierOrder) {
    const count = tierCounts[t] ?? 0
    const bar   = '█'.repeat(count)
    const pct   = ((count / results.length) * 100).toFixed(0).padStart(3)
    console.log(`  ${tierLabel(t)}  ${String(count).padStart(2)} (${pct}%)  ${bar}`)
  }

  // Pathway summary
  console.log(`\n  PATHWAY DISTRIBUTION`)
  for (const [p, c] of Object.entries(pathwayCounts).sort((a, b) => b[1] - a[1])) {
    const pct = ((c / results.length) * 100).toFixed(0).padStart(3)
    console.log(`  ${p.padEnd(20)}  ${String(c).padStart(2)} (${pct}%)`)
  }

  // Absent / zero scores
  if (absentStudents.length > 0) {
    console.log(`\n  ⚠  ABSENT / MISSING SCORES (${absentStudents.length} students)`)
    for (const r of absentStudents) {
      console.log(`     ${r.name}: missing ${r.absentIn.join(', ')}`)
    }
  }
}

function printCohortGapReport(
  allResults: PipelineResult[],
  classTags: Map<string, string>,
) {
  console.log(`\n${sep('═')}`)
  console.log('  COHORT GAP REPORT — KANGAI PRIMARY GRADE 9')
  console.log(sep('═'))

  // Subject-level CBC averages across cohort
  const subjectAvgCBC: Record<string, number[]> = {}
  for (const key of SUBJECT_KEYS) subjectAvgCBC[key] = []

  // Rebuild CBC scores per student from their names
  const allStudents = [...GRADE_9Y, ...GRADE_9G]
  for (const student of allStudents) {
    for (const key of SUBJECT_KEYS) {
      subjectAvgCBC[key].push(toCBC(student.scores[key]))
    }
  }

  console.log(`\n  SUBJECT AVERAGES (CBC 1-4 scale)`)
  console.log(`  ${'Subject'.padEnd(28)} Avg   Distribution (1→2→3→4)`)
  console.log(`  ${sep('-', 65)}`)

  const subjectStats: { key: string; avg: number }[] = []

  for (const key of SUBJECT_KEYS) {
    const vals  = subjectAvgCBC[key]
    const avg   = vals.reduce((s, v) => s + v, 0) / vals.length
    const lvl1  = vals.filter(v => v === 1).length
    const lvl2  = vals.filter(v => v === 2).length
    const lvl3  = vals.filter(v => v === 3).length
    const lvl4  = vals.filter(v => v === 4).length
    const total = vals.length

    const bar = (n: number, symbol: string) =>
      symbol.repeat(Math.round((n / total) * 20)).padEnd(20)

    console.log(
      `  ${formatSubjectName(key).padEnd(27)} ${avg.toFixed(2)}  ` +
      `[1:${lvl1.toString().padStart(2)}][2:${lvl2.toString().padStart(2)}][3:${lvl3.toString().padStart(2)}][4:${lvl4.toString().padStart(2)}]`
    )
    subjectStats.push({ key, avg })
  }

  subjectStats.sort((a, b) => a.avg - b.avg)

  console.log(`\n  CRITICAL GAPS (lowest-performing subjects)`)
  const threshold = 1.8
  const gaps = subjectStats.filter(s => s.avg <= threshold)
  if (gaps.length === 0) {
    console.log('  No subjects below threshold 1.8')
  } else {
    for (const g of gaps) {
      console.log(`  ⛔ ${formatSubjectName(g.key).padEnd(28)} avg ${g.avg.toFixed(2)} — INTERVENTION NEEDED`)
    }
  }

  // Overall tier distribution
  const tierCounts: Record<string, number> = {}
  for (const r of allResults) {
    tierCounts[r.overallTier] = (tierCounts[r.overallTier] ?? 0) + 1
  }

  console.log(`\n  OVERALL COHORT TIER DISTRIBUTION (${allResults.length} students)`)
  const tierOrder = ['remedial', 'reinforcement', 'standard', 'challenge']
  for (const t of tierOrder) {
    const c   = tierCounts[t] ?? 0
    const pct = ((c / allResults.length) * 100).toFixed(0).padStart(3)
    console.log(`  ${tierLabel(t)}  ${String(c).padStart(2)} (${pct}%)`)
  }

  // Top 5 / bottom 5 students
  const sorted = [...allResults].sort((a, b) => b.overallLevel - a.overallLevel)
  console.log(`\n  TOP 5 STUDENTS`)
  sorted.slice(0, 5).forEach((r, i) => {
    const cls = classTags.get(r.studentId) ?? '?'
    console.log(`  ${i + 1}. ${r.name.padEnd(28)} Lvl ${r.overallLevel}  ${cls}  → ${r.pathway ?? '—'}`)
  })

  console.log(`\n  BOTTOM 5 STUDENTS (need most support)`)
  sorted.slice(-5).reverse().forEach((r, i) => {
    const cls = classTags.get(r.studentId) ?? '?'
    const flag = r.absent ? '  ⚠ absent subjects' : ''
    console.log(`  ${i + 1}. ${r.name.padEnd(28)} Lvl ${r.overallLevel}  ${cls}${flag}`)
  })
}

function printTeacherSummary(allResults: PipelineResult[]) {
  console.log(`\n${sep('═')}`)
  console.log('  TEACHER SUMMARY — Dennis Kariuki Njeru')
  console.log(`  Kangai Primary School  |  Grade 9  |  Term ${TERM}, ${YEAR}`)
  console.log(`  Total students processed: ${allResults.length}`)
  console.log(sep('═'))

  const byPathway: Record<string, string[]> = {}
  for (const r of allResults) {
    const p = r.pathway ?? 'Undecided'
    if (!byPathway[p]) byPathway[p] = []
    byPathway[p].push(r.name)
  }

  console.log(`\n  PATHWAY RECOMMENDATIONS`)
  for (const [p, names] of Object.entries(byPathway).sort((a, b) => b[1].length - a[1].length)) {
    console.log(`\n  ${p} (${names.length} students)`)
    for (const name of names) {
      const r = allResults.find(x => x.name === name)!
      console.log(`    • ${name.padEnd(28)} Lvl ${r.overallLevel}  Tier: ${r.overallTier}`)
    }
  }

  const remedialStudents = allResults.filter(r => r.overallTier === 'remedial')
  if (remedialStudents.length > 0) {
    console.log(`\n  REMEDIAL SUPPORT PRIORITY (${remedialStudents.length} students)`)
    console.log('  These students need immediate Academic Clinic intervention:')
    for (const r of remedialStudents) {
      const flag = r.absent ? ' ⚠ absent subjects' : ''
      console.log(`    ⛔ ${r.name}${flag}`)
    }
  }

  console.log(`\n  COMPASS FIRST-SESSION SUBJECTS`)
  const compassGroups: Record<string, string[]> = {}
  for (const r of allResults) {
    if (!compassGroups[r.compass]) compassGroups[r.compass] = []
    compassGroups[r.compass].push(r.name)
  }
  for (const [subj, names] of Object.entries(compassGroups).sort((a, b) => b[1].length - a[1].length)) {
    console.log(`  ${formatSubjectName(subj).padEnd(28)} → ${names.length} students`)
  }
}

// ─── Main ─────────────────────────────────────────────────────────────────────

async function main() {
  console.log(sep('═'))
  console.log('  KANGAI PRIMARY SCHOOL — GRADE 9 END-TO-END TEST')
  console.log(`  Teacher: ${TEACHER_NAME}`)
  console.log(`  Term ${TERM}, ${YEAR}  |  9Y: ${GRADE_9Y.length} students  |  9G: ${GRADE_9G.length} students`)
  console.log(sep('═'))

  const db = createServiceClient()

  // ── Phase 1: Classes ────────────────────────────────────────────────────────
  console.log('\n[Phase 1] Creating classes…')
  const classId9Y = await findOrCreateClass(db, 'Grade 9Y', GRADE)
  const classId9G = await findOrCreateClass(db, 'Grade 9G', GRADE)

  // ── Phase 2: Add students ───────────────────────────────────────────────────
  console.log('\n[Phase 2] Adding students…')
  const studentIdMap9Y = new Map<string, string>() // name → id
  const studentIdMap9G = new Map<string, string>()
  const classTags      = new Map<string, string>()  // student_id → class name

  process.stdout.write('  9Y: ')
  for (const student of GRADE_9Y) {
    const id = await withRetry(() => addStudentToClass(db, classId9Y, student))
    studentIdMap9Y.set(student.name, id)
    classTags.set(id, '9Y')
    process.stdout.write('.')
  }
  console.log(` ${GRADE_9Y.length} done`)

  process.stdout.write('  9G: ')
  for (const student of GRADE_9G) {
    const id = await withRetry(() => addStudentToClass(db, classId9G, student))
    studentIdMap9G.set(student.name, id)
    classTags.set(id, '9G')
    process.stdout.write('.')
  }
  console.log(` ${GRADE_9G.length} done`)

  // ── Phase 3: Class assessment headers ──────────────────────────────────────
  console.log('\n[Phase 3] Creating class assessment headers…')
  const title = `Mid-Term Assessment Term ${TERM} ${YEAR}`
  await findOrCreateClassAssessment(db, classId9Y, title)
  await findOrCreateClassAssessment(db, classId9G, title)

  // ── Phase 4: Save marks (assessments table with CBC scores) ─────────────────
  console.log('\n[Phase 4] Saving assessments…')
  const assessmentIdMap = new Map<string, string>() // student_id → assessment_id

  process.stdout.write('  9Y: ')
  for (const student of GRADE_9Y) {
    const sid = studentIdMap9Y.get(student.name)!
    const aid = await withRetry(() => upsertAssessment(db, sid, student.scores))
    assessmentIdMap.set(sid, aid)
    process.stdout.write('.')
  }
  console.log(` ${GRADE_9Y.length} done`)

  process.stdout.write('  9G: ')
  for (const student of GRADE_9G) {
    const sid = studentIdMap9G.get(student.name)!
    const aid = await withRetry(() => upsertAssessment(db, sid, student.scores))
    assessmentIdMap.set(sid, aid)
    process.stdout.write('.')
  }
  console.log(` ${GRADE_9G.length} done`)

  // ── Phase 5: Run pipeline ───────────────────────────────────────────────────
  console.log('\n[Phase 5] Running pipeline (analysis + compass + save context)…')

  const results9Y: PipelineResult[] = []
  const results9G: PipelineResult[] = []

  for (const student of GRADE_9Y) {
    const sid = studentIdMap9Y.get(student.name)!
    const aid = assessmentIdMap.get(sid)!
    const result = runPipeline(student, sid)
    await withRetry(() => saveContext(db, sid, aid, student, result))
    results9Y.push(result)
    console.log(`  WOULD GENERATE PDF FOR: ${student.name}`)
    console.log(`  WOULD SEND WHATSAPP TO: ${student.name}`)
  }
  console.log(`  9Y pipeline done (${results9Y.length} students)`)

  for (const student of GRADE_9G) {
    const sid = studentIdMap9G.get(student.name)!
    const aid = assessmentIdMap.get(sid)!
    const result = runPipeline(student, sid)
    await withRetry(() => saveContext(db, sid, aid, student, result))
    results9G.push(result)
    console.log(`  WOULD GENERATE PDF FOR: ${student.name}`)
    console.log(`  WOULD SEND WHATSAPP TO: ${student.name}`)
  }
  console.log(`  9G pipeline done (${results9G.length} students)`)

  // ── Phase 6: Reports ────────────────────────────────────────────────────────
  printClassReport('Grade 9Y', results9Y)
  printClassReport('Grade 9G', results9G)

  const allResults = [...results9Y, ...results9G]
  printCohortGapReport(allResults, classTags)
  printTeacherSummary(allResults)

  // ── Phase 7: DB verification ────────────────────────────────────────────────
  console.log(`\n${sep('═')}`)
  console.log('  DB VERIFICATION')
  console.log(sep('═'))

  const [{ count: studentCount }, { count: assessmentCount }, { count: contextCount }] =
    await Promise.all([
      db.from('students').select('id', { count: 'exact', head: true }).eq('teacher_id', TEACHER_ID),
      db.from('assessments').select('id', { count: 'exact', head: true })
        .in('student_id', [...assessmentIdMap.keys()]),
      db.from('student_learning_context').select('student_id', { count: 'exact', head: true })
        .in('student_id', [...assessmentIdMap.keys()]),
    ])

  const expected = GRADE_9Y.length + GRADE_9G.length

  console.log(`  Students in DB    : ${studentCount ?? '?'}  (expected ${expected})  ${studentCount === expected ? '✓' : '✗'}`)
  console.log(`  Assessments in DB : ${assessmentCount ?? '?'}  (expected ${expected})  ${assessmentCount === expected ? '✓' : '✗'}`)
  console.log(`  Learning contexts : ${contextCount ?? '?'}  (expected ${expected})  ${contextCount === expected ? '✓' : '✗'}`)

  console.log(`\n${sep('═')}`)
  console.log('  COMPLETE')
  console.log(sep('═'))
}

main().catch(err => {
  console.error('\n[FATAL]', err)
  process.exit(1)
})
