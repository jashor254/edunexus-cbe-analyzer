// scripts/seed-kangai-marks.ts
// Seeds Kangai Primary School Mid-Term Assessment Term 1 2026 marks for Grade 9G and 9Y.
//
// Dry-run (default — logs rows, inserts nothing):
//   npx tsx scripts/seed-kangai-marks.ts
//
// Real insert:
//   DRY_RUN=false npx tsx scripts/seed-kangai-marks.ts

import * as dotenv from 'dotenv'
import * as path from 'path'
dotenv.config({ path: path.resolve(__dirname, '../.env.local') })

import { createClient } from '@supabase/supabase-js'

const DRY_RUN = process.env.DRY_RUN !== 'false'

const db = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL as string,
  process.env.SUPABASE_SERVICE_ROLE_KEY as string,
  { auth: { autoRefreshToken: false, persistSession: false } }
)

// ── Verified IDs (confirmed 2026-06-13) ──────────────────────────────────────
const TEACHER_ID = '45699ad6-f89c-4376-985f-31730a341801'
const CLASS_9G   = '9390d1d6-ce5d-4298-a4ab-d2ec511c6f40'
const ASSESS_9G  = 'b85540c1-28e4-43cf-ba43-aaaee75a91ca'
const CLASS_9Y   = 'c2a5b2bc-1314-4ab9-b4d9-2767f151b857'
const ASSESS_9Y  = '4946747c-43c9-4619-8ad1-f8faf751a69c'

// ── Types ────────────────────────────────────────────────────────────────────
type StudentEntry = {
  name: string
  pos: number   // 0 = no recorded position (absent / incomplete data)
  scores: Record<string, number>
}

// ── Grade 9G (35 students) ───────────────────────────────────────────────────
const grade9G: StudentEntry[] = [
  { name: 'CHINEASE NDIRITU',   pos: 4,  scores: { Mathematics: 21, English: 66, Kiswahili: 72, 'Integrated Science': 75, 'Pre-Technical Studies': 79, 'Creative Arts': 74, 'Social Studies': 70, CRE: 80, 'Agriculture & Nutrition': 32 } },
  { name: 'NICHOLUS GIKURU',    pos: 18, scores: { Mathematics: 15, English: 40, Kiswahili: 32, 'Integrated Science': 21, 'Pre-Technical Studies': 40, 'Creative Arts': 30, 'Social Studies': 15, CRE: 26, 'Agriculture & Nutrition': 24 } },
  { name: 'STEVE MUNENE',       pos: 18, scores: { Mathematics: 15, English: 36, Kiswahili: 21, 'Integrated Science': 26, 'Pre-Technical Studies': 38, 'Creative Arts': 34, 'Social Studies': 12, CRE: 25, 'Agriculture & Nutrition': 46 } },
  { name: 'ALVIN KARIUKI',      pos: 2,  scores: { Mathematics: 46, English: 70, Kiswahili: 75, 'Integrated Science': 76, 'Pre-Technical Studies': 70, 'Creative Arts': 81, 'Social Studies': 66, CRE: 81, 'Agriculture & Nutrition': 65 } },
  { name: 'ALEX GICHOBI',       pos: 17, scores: { Mathematics: 10, English: 28, Kiswahili: 36, 'Integrated Science': 37, 'Pre-Technical Studies': 36, 'Creative Arts': 13, 'Social Studies': 37, CRE: 24, 'Agriculture & Nutrition': 0 } },
  { name: 'ALFA KINYUA',        pos: 30, scores: { Mathematics: 3,  English: 14, Kiswahili: 14, 'Integrated Science': 12, 'Pre-Technical Studies': 10, 'Creative Arts': 17, 'Social Studies': 7,  CRE: 6,  'Agriculture & Nutrition': 9 } },
  { name: 'FRANCIS MACHARIA',   pos: 7,  scores: { Mathematics: 12, English: 45, Kiswahili: 33, 'Integrated Science': 50, 'Pre-Technical Studies': 48, 'Creative Arts': 47, 'Social Studies': 23, CRE: 37, 'Agriculture & Nutrition': 58 } },
  { name: 'MAXWELL GATIMU',     pos: 31, scores: { Mathematics: 3,  English: 15, Kiswahili: 9,  'Integrated Science': 6,  'Pre-Technical Studies': 6,  'Creative Arts': 8,  'Social Studies': 6,  CRE: 4,  'Agriculture & Nutrition': 8 } },
  { name: 'VINCENT MURIMI',     pos: 28, scores: { Mathematics: 16, English: 15, Kiswahili: 9,  'Integrated Science': 6,  'Pre-Technical Studies': 10, 'Creative Arts': 13, 'Social Studies': 8,  CRE: 5,  'Agriculture & Nutrition': 5 } },
  { name: 'ALBERT NJOGU',       pos: 27, scores: { Mathematics: 15, English: 29, Kiswahili: 16, 'Integrated Science': 6,  'Pre-Technical Studies': 10, 'Creative Arts': 20, 'Social Studies': 3,  CRE: 4,  'Agriculture & Nutrition': 14 } },
  { name: 'FILEX NGIRI',        pos: 28, scores: { Mathematics: 16, English: 22, Kiswahili: 5,  'Integrated Science': 12, 'Pre-Technical Studies': 17, 'Creative Arts': 20, 'Social Studies': 3,  CRE: 4,  'Agriculture & Nutrition': 1 } },
  { name: 'PATRICK NYAMU',      pos: 33, scores: { Mathematics: 24, English: 12, Kiswahili: 14, 'Integrated Science': 3,  'Pre-Technical Studies': 15, 'Creative Arts': 11, 'Social Studies': 2,  CRE: 4,  'Agriculture & Nutrition': 6 } },
  { name: 'STANELY KARIUKI',    pos: 14, scores: { Mathematics: 27, English: 39, Kiswahili: 42, 'Integrated Science': 24, 'Pre-Technical Studies': 34, 'Creative Arts': 49, 'Social Studies': 14, CRE: 33, 'Agriculture & Nutrition': 36 } },
  { name: 'KELVIN MUCHERIA',    pos: 26, scores: { Mathematics: 19, English: 22, Kiswahili: 17, 'Integrated Science': 11, 'Pre-Technical Studies': 14, 'Creative Arts': 44, 'Social Studies': 6,  CRE: 12, 'Agriculture & Nutrition': 8 } },
  { name: 'SAMUEL KARHA',       pos: 24, scores: { Mathematics: 15, English: 32, Kiswahili: 24, 'Integrated Science': 19, 'Pre-Technical Studies': 20, 'Creative Arts': 23, 'Social Studies': 14, CRE: 16, 'Agriculture & Nutrition': 17 } },
  { name: 'GEOFREY RUKENYA',    pos: 19, scores: { Mathematics: 19, English: 22, Kiswahili: 17, 'Integrated Science': 11, 'Pre-Technical Studies': 14, 'Creative Arts': 44, 'Social Studies': 6,  CRE: 12, 'Agriculture & Nutrition': 8 } },
  { name: 'DONALD MUNENE',      pos: 5,  scores: { Mathematics: 32, English: 63, Kiswahili: 68, 'Integrated Science': 67, 'Pre-Technical Studies': 80, 'Creative Arts': 71, 'Social Studies': 60, CRE: 75, 'Agriculture & Nutrition': 70 } },
  { name: 'JUNIOR MUGO',        pos: 0,  scores: { Mathematics: 17, English: 17, Kiswahili: 19, 'Integrated Science': 8,  'Pre-Technical Studies': 9,  'Creative Arts': 5,  'Social Studies': 6,  CRE: 4,  'Agriculture & Nutrition': 12 } },
  { name: 'LOUIS MURIITHI',     pos: 11, scores: { Mathematics: 12, English: 32, Kiswahili: 48, 'Integrated Science': 26, 'Pre-Technical Studies': 31, 'Creative Arts': 43, 'Social Studies': 25, CRE: 49, 'Agriculture & Nutrition': 59 } },
  { name: 'ALEX GICHUHI',       pos: 0,  scores: { Mathematics: 16, English: 25, Kiswahili: 37, 'Integrated Science': 19, 'Pre-Technical Studies': 22, 'Creative Arts': 17, 'Social Studies': 5,  CRE: 21, 'Agriculture & Nutrition': 21 } },
  { name: 'FRANKLINE BUNDI',    pos: 15, scores: { Mathematics: 11, English: 47, Kiswahili: 44, 'Integrated Science': 23, 'Pre-Technical Studies': 50, 'Creative Arts': 41, 'Social Studies': 22, CRE: 47, 'Agriculture & Nutrition': 61 } },
  { name: 'GIBSON MAINA',       pos: 0,  scores: { Mathematics: 0,  English: 0,  Kiswahili: 0,  'Integrated Science': 0,  'Pre-Technical Studies': 0,  'Creative Arts': 0,  'Social Studies': 0,  CRE: 0,  'Agriculture & Nutrition': 0 } },
  { name: 'RACHEAL NJERI',      pos: 0,  scores: { Mathematics: 0,  English: 0,  Kiswahili: 0,  'Integrated Science': 0,  'Pre-Technical Studies': 0,  'Creative Arts': 0,  'Social Studies': 0,  CRE: 0,  'Agriculture & Nutrition': 0 } },
  { name: 'CATHERINE MUNYIVA',  pos: 0,  scores: { Mathematics: 0,  English: 0,  Kiswahili: 0,  'Integrated Science': 0,  'Pre-Technical Studies': 0,  'Creative Arts': 0,  'Social Studies': 0,  CRE: 0,  'Agriculture & Nutrition': 0 } },
  { name: 'ABIGAEL WANGECI',    pos: 9,  scores: { Mathematics: 17, English: 55, Kiswahili: 40, 'Integrated Science': 33, 'Pre-Technical Studies': 30, 'Creative Arts': 40, 'Social Studies': 29, CRE: 43, 'Agriculture & Nutrition': 41 } },
  { name: 'EVALYNN WAMBUI',     pos: 25, scores: { Mathematics: 15, English: 32, Kiswahili: 28, 'Integrated Science': 16, 'Pre-Technical Studies': 14, 'Creative Arts': 13, 'Social Studies': 10, CRE: 12, 'Agriculture & Nutrition': 10 } },
  { name: 'ROSALED NJERI',      pos: 10, scores: { Mathematics: 13, English: 39, Kiswahili: 29, 'Integrated Science': 44, 'Pre-Technical Studies': 50, 'Creative Arts': 47, 'Social Studies': 14, CRE: 46, 'Agriculture & Nutrition': 45 } },
  { name: 'JOYCE NYAGUTHII',    pos: 12, scores: { Mathematics: 19, English: 50, Kiswahili: 52, 'Integrated Science': 33, 'Pre-Technical Studies': 39, 'Creative Arts': 37, 'Social Studies': 20, CRE: 51, 'Agriculture & Nutrition': 39 } },
  { name: 'KEZIAH WAIRIMU',     pos: 22, scores: { Mathematics: 13, English: 36, Kiswahili: 16, 'Integrated Science': 24, 'Pre-Technical Studies': 20, 'Creative Arts': 32, 'Social Studies': 14, CRE: 27, 'Agriculture & Nutrition': 23 } },
  { name: 'MARYANN WAMBUI',     pos: 31, scores: { Mathematics: 16, English: 15, Kiswahili: 15, 'Integrated Science': 5,  'Pre-Technical Studies': 16, 'Creative Arts': 10, 'Social Studies': 9,  CRE: 7,  'Agriculture & Nutrition': 3 } },
  { name: 'LIVIA NYAMBURA',     pos: 6,  scores: { Mathematics: 18, English: 59, Kiswahili: 59, 'Integrated Science': 45, 'Pre-Technical Studies': 54, 'Creative Arts': 53, 'Social Studies': 40, CRE: 57, 'Agriculture & Nutrition': 57 } },
  { name: 'HELLEN MUTHONI',     pos: 13, scores: { Mathematics: 18, English: 42, Kiswahili: 49, 'Integrated Science': 28, 'Pre-Technical Studies': 21, 'Creative Arts': 55, 'Social Studies': 20, CRE: 34, 'Agriculture & Nutrition': 27 } },
  { name: 'JOAN MUTHONI',       pos: 20, scores: { Mathematics: 3,  English: 38, Kiswahili: 29, 'Integrated Science': 24, 'Pre-Technical Studies': 32, 'Creative Arts': 25, 'Social Studies': 16, CRE: 26, 'Agriculture & Nutrition': 19 } },
  { name: 'MARGARET WAIRIMU',   pos: 2,  scores: { Mathematics: 35, English: 74, Kiswahili: 92, 'Integrated Science': 67, 'Pre-Technical Studies': 70, 'Creative Arts': 70, 'Social Studies': 76, CRE: 87, 'Agriculture & Nutrition': 90 } },
  { name: 'MARION WAIRIMU',     pos: 1,  scores: { Mathematics: 58, English: 75, Kiswahili: 90, 'Integrated Science': 84, 'Pre-Technical Studies': 81, 'Creative Arts': 80, 'Social Studies': 74, CRE: 83, 'Agriculture & Nutrition': 82 } },
]

// ── Grade 9Y (36 students) ───────────────────────────────────────────────────
const grade9Y: StudentEntry[] = [
  { name: 'EVANS NDEGE',         pos: 13, scores: { Mathematics: 6,  English: 36, Kiswahili: 24, 'Integrated Science': 24, 'Pre-Technical Studies': 36, 'Creative Arts': 36, 'Social Studies': 10, CRE: 34, 'Agriculture & Nutrition': 43 } },
  { name: 'JOHN MUCHIRI',        pos: 5,  scores: { Mathematics: 23, English: 52, Kiswahili: 38, 'Integrated Science': 29, 'Pre-Technical Studies': 52, 'Creative Arts': 60, 'Social Studies': 31, CRE: 42, 'Agriculture & Nutrition': 62 } },
  { name: 'BENARD MACHARIA',     pos: 18, scores: { Mathematics: 1,  English: 25, Kiswahili: 24, 'Integrated Science': 15, 'Pre-Technical Studies': 28, 'Creative Arts': 18, 'Social Studies': 11, CRE: 12, 'Agriculture & Nutrition': 24 } },
  { name: 'MORGAN WAWERU',       pos: 33, scores: { Mathematics: 9,  English: 10, Kiswahili: 16, 'Integrated Science': 12, 'Pre-Technical Studies': 16, 'Creative Arts': 12, 'Social Studies': 4,  CRE: 3,  'Agriculture & Nutrition': 14 } },
  { name: 'JOHN NJANGIRU',       pos: 29, scores: { Mathematics: 5,  English: 10, Kiswahili: 20, 'Integrated Science': 11, 'Pre-Technical Studies': 20, 'Creative Arts': 28, 'Social Studies': 1,  CRE: 13, 'Agriculture & Nutrition': 9 } },
  { name: 'BRIAN NJUKI',         pos: 7,  scores: { Mathematics: 5,  English: 51, Kiswahili: 51, 'Integrated Science': 29, 'Pre-Technical Studies': 51, 'Creative Arts': 46, 'Social Studies': 15, CRE: 50, 'Agriculture & Nutrition': 38 } },
  { name: 'DENNIS MACHARIA',     pos: 18, scores: { Mathematics: 4,  English: 24, Kiswahili: 31, 'Integrated Science': 17, 'Pre-Technical Studies': 43, 'Creative Arts': 25, 'Social Studies': 13, CRE: 23, 'Agriculture & Nutrition': 35 } },
  { name: 'SAMMY MWANGI',        pos: 29, scores: { Mathematics: 1,  English: 19, Kiswahili: 29, 'Integrated Science': 9,  'Pre-Technical Studies': 18, 'Creative Arts': 14, 'Social Studies': 5,  CRE: 6,  'Agriculture & Nutrition': 1 } },
  { name: 'BRIAN WACHIRA',       pos: 19, scores: { Mathematics: 5,  English: 44, Kiswahili: 40, 'Integrated Science': 16, 'Pre-Technical Studies': 27, 'Creative Arts': 24, 'Social Studies': 12, CRE: 11, 'Agriculture & Nutrition': 16 } },
  { name: 'HESBON MACHARIA',     pos: 25, scores: { Mathematics: 1,  English: 21, Kiswahili: 26, 'Integrated Science': 13, 'Pre-Technical Studies': 15, 'Creative Arts': 24, 'Social Studies': 5,  CRE: 11, 'Agriculture & Nutrition': 16 } },
  { name: 'DENNIS MURIITHI',     pos: 34, scores: { Mathematics: 5,  English: 17, Kiswahili: 13, 'Integrated Science': 17, 'Pre-Technical Studies': 14, 'Creative Arts': 12, 'Social Studies': 1,  CRE: 1,  'Agriculture & Nutrition': 11 } },
  { name: 'PATRICK NJIRU',       pos: 24, scores: { Mathematics: 4,  English: 25, Kiswahili: 21, 'Integrated Science': 14, 'Pre-Technical Studies': 30, 'Creative Arts': 18, 'Social Studies': 2,  CRE: 19, 'Agriculture & Nutrition': 18 } },
  { name: 'MIKE MUNYIRI',        pos: 31, scores: { Mathematics: 2,  English: 0,  Kiswahili: 0,  'Integrated Science': 0,  'Pre-Technical Studies': 0,  'Creative Arts': 31, 'Social Studies': 0,  CRE: 35, 'Agriculture & Nutrition': 27 } },
  { name: 'BENSON MURIMI',       pos: 36, scores: { Mathematics: 9,  English: 19, Kiswahili: 0,  'Integrated Science': 0,  'Pre-Technical Studies': 0,  'Creative Arts': 7,  'Social Studies': 0,  CRE: 0,  'Agriculture & Nutrition': 9 } },
  { name: 'IAN DAMA',            pos: 9,  scores: { Mathematics: 21, English: 41, Kiswahili: 32, 'Integrated Science': 22, 'Pre-Technical Studies': 39, 'Creative Arts': 48, 'Social Studies': 19, CRE: 37, 'Agriculture & Nutrition': 49 } },
  { name: 'AUSTIN MAHIANYU',     pos: 28, scores: { Mathematics: 6,  English: 19, Kiswahili: 23, 'Integrated Science': 8,  'Pre-Technical Studies': 13, 'Creative Arts': 19, 'Social Studies': 6,  CRE: 7,  'Agriculture & Nutrition': 13 } },
  { name: 'DAVID MUTUGI',        pos: 15, scores: { Mathematics: 6,  English: 51, Kiswahili: 40, 'Integrated Science': 21, 'Pre-Technical Studies': 32, 'Creative Arts': 38, 'Social Studies': 11, CRE: 26, 'Agriculture & Nutrition': 19 } },
  { name: 'ERICK MURIMI',        pos: 8,  scores: { Mathematics: 12, English: 45, Kiswahili: 35, 'Integrated Science': 27, 'Pre-Technical Studies': 49, 'Creative Arts': 34, 'Social Studies': 21, CRE: 36, 'Agriculture & Nutrition': 44 } },
  { name: 'ROBINSON KINYUA',     pos: 10, scores: { Mathematics: 6,  English: 44, Kiswahili: 42, 'Integrated Science': 25, 'Pre-Technical Studies': 35, 'Creative Arts': 40, 'Social Studies': 22, CRE: 39, 'Agriculture & Nutrition': 44 } },
  { name: 'MARY MUTHONI',        pos: 35, scores: { Mathematics: 5,  English: 19, Kiswahili: 12, 'Integrated Science': 8,  'Pre-Technical Studies': 9,  'Creative Arts': 5,  'Social Studies': 7,  CRE: 4,  'Agriculture & Nutrition': 6 } },
  { name: 'MERCY WANJIRU',       pos: 6,  scores: { Mathematics: 15, English: 55, Kiswahili: 50, 'Integrated Science': 21, 'Pre-Technical Studies': 51, 'Creative Arts': 53, 'Social Studies': 31, CRE: 59, 'Agriculture & Nutrition': 43 } },
  { name: 'TUCYLA NYAWIRA',      pos: 2,  scores: { Mathematics: 25, English: 78, Kiswahili: 78, 'Integrated Science': 56, 'Pre-Technical Studies': 80, 'Creative Arts': 66, 'Social Studies': 42, CRE: 66, 'Agriculture & Nutrition': 78 } },
  { name: 'LILIAN WAMBUI',       pos: 4,  scores: { Mathematics: 22, English: 63, Kiswahili: 41, 'Integrated Science': 41, 'Pre-Technical Studies': 45, 'Creative Arts': 44, 'Social Studies': 24, CRE: 56, 'Agriculture & Nutrition': 73 } },
  { name: 'ABIGAEL WAMBUI',      pos: 22, scores: { Mathematics: 6,  English: 23, Kiswahili: 19, 'Integrated Science': 3,  'Pre-Technical Studies': 21, 'Creative Arts': 24, 'Social Studies': 12, CRE: 14, 'Agriculture & Nutrition': 23 } },
  { name: 'JOAN WAMBUI',         pos: 17, scores: { Mathematics: 4,  English: 39, Kiswahili: 34, 'Integrated Science': 20, 'Pre-Technical Studies': 38, 'Creative Arts': 28, 'Social Studies': 16, CRE: 19, 'Agriculture & Nutrition': 21 } },
  { name: 'FAITH WAKIO',         pos: 12, scores: { Mathematics: 9,  English: 55, Kiswahili: 43, 'Integrated Science': 20, 'Pre-Technical Studies': 86, 'Creative Arts': 20, 'Social Studies': 14, CRE: 31, 'Agriculture & Nutrition': 32 } },
  { name: 'ROSE MUMBI',          pos: 15, scores: { Mathematics: 10, English: 51, Kiswahili: 33, 'Integrated Science': 22, 'Pre-Technical Studies': 80, 'Creative Arts': 35, 'Social Studies': 17, CRE: 21, 'Agriculture & Nutrition': 19 } },
  { name: 'YVONNE WANJIRU',      pos: 25, scores: { Mathematics: 6,  English: 24, Kiswahili: 10, 'Integrated Science': 14, 'Pre-Technical Studies': 14, 'Creative Arts': 14, 'Social Studies': 7,  CRE: 11, 'Agriculture & Nutrition': 13 } },
  { name: 'SHARON WAITHERA',     pos: 32, scores: { Mathematics: 6,  English: 24, Kiswahili: 12, 'Integrated Science': 12, 'Pre-Technical Studies': 11, 'Creative Arts': 13, 'Social Studies': 3,  CRE: 8,  'Agriculture & Nutrition': 9 } },
  { name: 'FAITH MUTHONI',       pos: 17, scores: { Mathematics: 9,  English: 31, Kiswahili: 11, 'Integrated Science': 12, 'Pre-Technical Studies': 17, 'Creative Arts': 30, 'Social Studies': 5,  CRE: 19, 'Agriculture & Nutrition': 19 } },
  { name: 'KAREN WANGARI',       pos: 14, scores: { Mathematics: 4,  English: 49, Kiswahili: 32, 'Integrated Science': 22, 'Pre-Technical Studies': 29, 'Creative Arts': 30, 'Social Studies': 13, CRE: 50, 'Agriculture & Nutrition': 52 } },
  { name: 'DORIS NYAKIO',        pos: 19, scores: { Mathematics: 10, English: 31, Kiswahili: 25, 'Integrated Science': 13, 'Pre-Technical Studies': 21, 'Creative Arts': 30, 'Social Studies': 12, CRE: 16, 'Agriculture & Nutrition': 15 } },
  { name: 'JOY JASMINE MUTHONI', pos: 3,  scores: { Mathematics: 20, English: 69, Kiswahili: 62, 'Integrated Science': 54, 'Pre-Technical Studies': 74, 'Creative Arts': 62, 'Social Studies': 33, CRE: 89, 'Agriculture & Nutrition': 80 } },
  { name: 'JOYCE WANGECHI',      pos: 11, scores: { Mathematics: 8,  English: 31, Kiswahili: 42, 'Integrated Science': 20, 'Pre-Technical Studies': 40, 'Creative Arts': 44, 'Social Studies': 19, CRE: 32, 'Agriculture & Nutrition': 34 } },
  { name: 'OLIVE WANINI',        pos: 1,  scores: { Mathematics: 81, English: 74, Kiswahili: 69, 'Integrated Science': 64, 'Pre-Technical Studies': 71, 'Creative Arts': 71, 'Social Studies': 48, CRE: 66, 'Agriculture & Nutrition': 77 } },
  { name: 'WINFRED NYAWIRA',     pos: 30, scores: { Mathematics: 1,  English: 23, Kiswahili: 15, 'Integrated Science': 12, 'Pre-Technical Studies': 13, 'Creative Arts': 14, 'Social Studies': 9,  CRE: 7,  'Agriculture & Nutrition': 13 } },
]

// ── Helpers ───────────────────────────────────────────────────────────────────
function sumScores(scores: Record<string, number>): number {
  return Object.values(scores).reduce((a, b) => a + b, 0)
}

function meanScore(scores: Record<string, number>): number {
  const vals = Object.values(scores)
  return Math.round((vals.reduce((a, b) => a + b, 0) / vals.length) * 100) / 100
}

function meanGrade(mean: number): string {
  if (mean >= 75) return 'EE'
  if (mean >= 50) return 'ME'
  if (mean >= 25) return 'AE'
  return 'BE'
}

// ── Student name → UUID lookup ────────────────────────────────────────────────
async function buildStudentMap(names: string[]): Promise<Map<string, string>> {
  const map = new Map<string, string>()
  if (names.length === 0) return map

  // Fetch all in one query — match by uppercased name
  const { data, error } = await db
    .from('students')
    .select('id, name')
    .in('name', names)

  if (error) throw new Error(`Student lookup failed: ${error.message}`)

  for (const s of data ?? []) {
    map.set((s.name as string).toUpperCase(), s.id as string)
  }
  return map
}

// ── Row builder ───────────────────────────────────────────────────────────────
type MarkRow = {
  assessment_id:    string
  class_id:         string
  teacher_id:       string
  student_name:     string
  student_id:       string | null
  subject_scores:   Record<string, number>
  total_marks:      number
  mean_score:       number
  mean_grade:       string
  position:         number | null
}

function buildRows(
  entries: StudentEntry[],
  assessmentId: string,
  classId: string,
  studentMap: Map<string, string>,
  warnings: string[]
): MarkRow[] {
  return entries.map((e) => {
    const upperName = e.name.toUpperCase()
    const studentId = studentMap.get(upperName) ?? null
    if (!studentId) warnings.push(`⚠  No student record found for: ${e.name}`)

    const ms = meanScore(e.scores)
    return {
      assessment_id:  assessmentId,
      class_id:       classId,
      teacher_id:     TEACHER_ID,
      student_name:   e.name,
      student_id:     studentId,
      subject_scores: e.scores,
      total_marks:    sumScores(e.scores),
      mean_score:     ms,
      mean_grade:     meanGrade(ms),
      position:       e.pos === 0 ? null : e.pos,
    }
  })
}

// ── Main ──────────────────────────────────────────────────────────────────────
async function main() {
  console.log(`\n${'='.repeat(60)}`)
  console.log(`  Kangai Marks Seed — ${DRY_RUN ? 'DRY RUN' : 'LIVE INSERT'}`)
  console.log(`${'='.repeat(60)}\n`)

  const allNames = [
    ...grade9G.map(e => e.name.toUpperCase()),
    ...grade9Y.map(e => e.name.toUpperCase()),
  ]
  const studentMap = await buildStudentMap(allNames)
  console.log(`  Students matched from DB: ${studentMap.size} / ${allNames.length}\n`)

  const warnings: string[] = []

  const rows9G = buildRows(grade9G, ASSESS_9G, CLASS_9G, studentMap, warnings)
  const rows9Y = buildRows(grade9Y, ASSESS_9Y, CLASS_9Y, studentMap, warnings)
  const allRows = [...rows9G, ...rows9Y]

  // ── Dry-run report ─────────────────────────────────────────────────────────
  console.log('── Grade 9G ─────────────────────────────────────────────────')
  for (const r of rows9G) {
    const matched = r.student_id ? '✓' : '✗'
    console.log(`  [${matched}] ${r.student_name.padEnd(24)} total=${String(r.total_marks).padStart(3)}  mean=${String(r.mean_score).padStart(5)}  grade=${r.mean_grade}  pos=${r.position ?? '-'}`)
  }

  console.log('\n── Grade 9Y ─────────────────────────────────────────────────')
  for (const r of rows9Y) {
    const matched = r.student_id ? '✓' : '✗'
    console.log(`  [${matched}] ${r.student_name.padEnd(24)} total=${String(r.total_marks).padStart(3)}  mean=${String(r.mean_score).padStart(5)}  grade=${r.mean_grade}  pos=${r.position ?? '-'}`)
  }

  console.log(`\n  Total rows to insert: ${allRows.length}`)
  console.log(`  Matched to students:  ${allRows.filter(r => r.student_id).length}`)
  console.log(`  Unmatched (null id):  ${allRows.filter(r => !r.student_id).length}`)

  if (warnings.length > 0) {
    console.log('\n── Warnings ──────────────────────────────────────────────────')
    for (const w of warnings) console.log(' ', w)
  }

  if (DRY_RUN) {
    console.log('\n  ⟶  DRY RUN complete — nothing inserted.')
    console.log('     To insert: DRY_RUN=false npx tsx scripts/seed-kangai-marks.ts\n')
    return
  }

  // ── Real insert ────────────────────────────────────────────────────────────
  console.log('\n  Inserting...')

  const { error: err9G } = await db.from('learner_marks').insert(rows9G)
  if (err9G) throw new Error(`Grade 9G insert failed: ${err9G.message}`)
  console.log(`  ✓ Grade 9G — ${rows9G.length} rows inserted`)

  const { error: err9Y } = await db.from('learner_marks').insert(rows9Y)
  if (err9Y) throw new Error(`Grade 9Y insert failed: ${err9Y.message}`)
  console.log(`  ✓ Grade 9Y — ${rows9Y.length} rows inserted`)

  console.log(`\n  Done. ${allRows.length} total rows seeded.\n`)
}

main().catch((e) => {
  console.error('\n  FATAL:', e instanceof Error ? e.message : String(e))
  process.exit(1)
})
