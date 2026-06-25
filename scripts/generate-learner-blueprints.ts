// scripts/generate-learner-blueprints.ts
// Generates Learner Blueprint PDFs for Tucyla (junior) and Trevor (senior).
// Output: ~/Desktop/learner blueprints/
// Run: npx tsx scripts/generate-learner-blueprints.ts

import * as dotenv from 'dotenv'
import * as path   from 'path'
import * as fs     from 'fs'
import { createClient } from '@supabase/supabase-js'

dotenv.config({ path: path.resolve(__dirname, '../.env.local') })

const TUCYLA_ID = '4f9dbb62-b9b3-44ae-b4e9-8a34ba6073eb'
const TREVOR_ID = '494c21c4-18ff-46c1-b364-5c19e6c7509f'

const OUT_DIR = path.resolve('/home/the-dev/Desktop/learner blueprints')

const db = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL as string,
  process.env.SUPABASE_SERVICE_ROLE_KEY as string,
  { auth: { autoRefreshToken: false, persistSession: false } }
)

// ─── Pull student + assessments from Supabase ─────────────────────────────────

async function fetchStudentData(studentId: string) {
  const [{ data: student, error: sErr }, { data: assessments, error: aErr }] = await Promise.all([
    db.from('students')
      .select('id, name, grade, school, current_pathway, curriculum_type')
      .eq('id', studentId)
      .single(),
    db.from('assessments')
      .select('id, term, year, subject_scores, created_at')
      .eq('student_id', studentId)
      .order('year', { ascending: true })
      .order('term', { ascending: true }),
  ])

  if (sErr || !student) throw new Error(`Student ${studentId} not found: ${sErr?.message}`)
  if (aErr || !assessments || assessments.length === 0) throw new Error(`No assessments for ${studentId}: ${aErr?.message}`)

  return { student, assessments }
}

// ─── Build Learner Blueprint PDF buffer ───────────────────────────────────────

async function buildBlueprint(studentId: string): Promise<{ name: string; buffer: Buffer }> {
  const {
    calculateVitals,
    generateActionPlan,
    generateJuniorGuidance,
    generateSeniorGuidance,
    generateReport,
    formatSubjectName,
  } = await import('../lib/academicClinic/reportGenerator')

  const { buildLearnerIntelligenceReport } = await import('../lib/learnerIntelligence/reportGenerator')
  const { generateLearnerIntelligencePDF } = await import('../lib/learnerIntelligence/pdfGenerator')

  const { student, assessments } = await fetchStudentData(studentId)
  const latest    = assessments[assessments.length - 1]
  const isJunior  = student.grade >= 7 && student.grade <= 9
  const firstName = student.name.split(' ')[0]

  // Build SubjectProgress — use history across all assessments for trend/velocity
  const latestScores: Record<string, number> = latest.subject_scores as Record<string, number>

  const subjectProgress = Object.entries(latestScores).map(([subject, latestScore]) => {
    const history = assessments
      .map((a: { subject_scores: Record<string, number> }) => (a.subject_scores as Record<string, number>)?.[subject])
      .filter((v): v is number => v !== undefined && v !== null)

    let trend: 'improving' | 'declining' | 'stable' = 'stable'
    let velocity = 0
    if (history.length > 1) {
      if (history[history.length - 1] > history[0]) trend = 'improving'
      else if (history[history.length - 1] < history[0]) trend = 'declining'
      let total = 0
      for (let i = 1; i < history.length; i++) total += history[i] - history[i - 1]
      velocity = parseFloat((total / (history.length - 1)).toFixed(2))
    }

    return {
      subject,
      displayName:    formatSubjectName(subject),
      level:          Math.max(1, Math.min(4, Math.round(latestScore as number))) as 1 | 2 | 3 | 4,
      trend,
      velocity,
      previousScores: history,
    }
  })

  const studentProfile = {
    id:      student.id,
    name:    student.name,
    grade:   student.grade,
    level:   (isJunior ? 'Junior School' : 'Senior School') as 'Junior School' | 'Senior School',
    term:    latest.term as number,
    year:    latest.year as number,
    pathway: student.current_pathway as string | null | undefined,
    school:  student.school  as string | null | undefined,
  }

  const vitals        = calculateVitals(subjectProgress)
  const actionPlan    = generateActionPlan(subjectProgress)
  const juniorGuidance = isJunior  ? generateJuniorGuidance(subjectProgress)                                                      : undefined
  const seniorGuidance = !isJunior ? generateSeniorGuidance(subjectProgress, firstName, student.grade, student.current_pathway ?? undefined) : undefined

  const clinicReport = generateReport(
    studentProfile,
    subjectProgress,
    vitals,
    actionPlan,
    assessments as Parameters<typeof generateReport>[4],
    juniorGuidance,
    seniorGuidance,
  )

  const liReport  = buildLearnerIntelligenceReport(clinicReport)
  const pdfBlob   = await generateLearnerIntelligencePDF(liReport)
  const buffer    = Buffer.from(await pdfBlob.arrayBuffer())

  return { name: student.name, buffer }
}

// ─── Main ─────────────────────────────────────────────────────────────────────

async function main() {
  console.log('━━━ EduNexus Learner Blueprint Generator ━━━\n')

  if (!fs.existsSync(OUT_DIR)) {
    fs.mkdirSync(OUT_DIR, { recursive: true })
    console.log(`Created folder: ${OUT_DIR}\n`)
  }

  // Junior — Tucyla
  console.log('▸ Generating: Tucyla (Junior School)…')
  const tucyla = await buildBlueprint(TUCYLA_ID)
  const tucylaPath = path.join(OUT_DIR, `Learner_Blueprint_TUCYLA_${new Date().toISOString().slice(0, 10)}.pdf`)
  fs.writeFileSync(tucylaPath, tucyla.buffer)
  console.log(`  ✅  ${tucyla.name} → ${tucylaPath}`)

  // Senior — Trevor
  console.log('▸ Generating: Trevor (Senior School)…')
  const trevor = await buildBlueprint(TREVOR_ID)
  const trevorPath = path.join(OUT_DIR, `Learner_Blueprint_TREVOR_${new Date().toISOString().slice(0, 10)}.pdf`)
  fs.writeFileSync(trevorPath, trevor.buffer)
  console.log(`  ✅  ${trevor.name} → ${trevorPath}`)

  console.log('\n━━━ Both Learner Blueprints saved to Desktop ━━━')
}

main().catch(err => { console.error('Fatal:', err); process.exit(1) })
