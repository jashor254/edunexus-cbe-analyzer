// scripts/generate-tucyla-junior.ts
// Generate Tucyla Nyawira's 3-page junior clinic report using the new academicClinic system.
// Run: npx tsx scripts/generate-tucyla-junior.ts

import * as dotenv from 'dotenv'
import * as path   from 'path'
import * as fs     from 'fs'

dotenv.config({ path: path.resolve(__dirname, '../.env.local') })

import { createClient } from '@supabase/supabase-js'
import {
  generateReport,
  calculateVitals,
  generateActionPlan,
  generateJuniorGuidance,
  formatSubjectName,
} from '@/lib/academicClinic/reportGenerator'
import { generateAcademicClinicPDF } from '@/lib/academicClinic/pdfGenerator'
import { resolveLevel } from '@/lib/assessments/gradeCalculator'
import type { CBCLevel }       from '@/lib/assessments/gradeCalculator'
import type { SubjectProgress, StudentProfile } from '@/lib/academicClinic/reportGenerator'

const TUCYLA_STUDENT_ID = '4f9dbb62-b9b3-44ae-b4e9-8a34ba6073eb'

const db = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL as string,
  process.env.SUPABASE_SERVICE_ROLE_KEY as string,
  { auth: { autoRefreshToken: false, persistSession: false } }
)

async function main() {
  console.log('─── Tucyla Nyawira — 3-Page Junior Clinic Report ───\n')

  // ── 1. Fetch student ─────────────────────────────────────────────────────────
  const { data: student, error: se } = await db
    .from('students')
    .select('id, user_id, name, grade, school, current_pathway')
    .eq('id', TUCYLA_STUDENT_ID)
    .single()

  if (se || !student) throw new Error(`Student fetch failed: ${se?.message}`)
  console.log(`  Student: ${student.name} · Grade ${student.grade}`)

  // ── 2. Fetch assessments ─────────────────────────────────────────────────────
  const { data: assessments, error: ae } = await db
    .from('assessments')
    .select('id, student_id, subject_scores, term, year, source, created_at')
    .eq('student_id', TUCYLA_STUDENT_ID)
    .order('created_at', { ascending: true })

  if (ae) throw new Error(`Assessments fetch failed: ${ae.message}`)
  if (!assessments || assessments.length === 0) throw new Error('No assessments found for Tucyla')

  console.log(`  Assessments: ${assessments.length} record(s)`)

  // ── 3. Build subject progress (mirrors download route logic) ─────────────────
  const latestAssessment = assessments[assessments.length - 1]
  const teacherAss = assessments.find(
    a => a.source === 'teacher' && a.term === latestAssessment.term && a.year === latestAssessment.year
  )

  const baseScores: Record<string, number> = (latestAssessment.subject_scores as Record<string, number>) || {}
  const currentScores: Record<string, number> = teacherAss
    ? Object.fromEntries(
        Object.entries(baseScores).map(([subj, parentLevel]) => {
          const teacherLevel = (teacherAss.subject_scores as Record<string, number>)?.[subj] ?? null
          const resolved = resolveLevel(teacherLevel as CBCLevel | null, parentLevel as CBCLevel | null)
          return [subj, resolved?.level ?? parentLevel]
        })
      )
    : baseScores

  const subjectProgress: SubjectProgress[] = Object.keys(currentScores).map(subject => {
    const scores = assessments
      .map(a => (a.subject_scores as Record<string, number>)?.[subject])
      .filter((s): s is number => s !== undefined && s !== null)

    let trend: 'improving' | 'declining' | 'stable' = 'stable'
    if (scores.length > 1) {
      if (scores[scores.length - 1] > scores[0])      trend = 'improving'
      else if (scores[scores.length - 1] < scores[0]) trend = 'declining'
    }

    let velocity = 0
    if (scores.length > 1) {
      let total = 0
      for (let i = 1; i < scores.length; i++) total += scores[i] - scores[i - 1]
      velocity = total / (scores.length - 1)
    }

    return {
      subject,
      displayName:    formatSubjectName(subject),
      level:          (currentScores[subject] as 1 | 2 | 3 | 4),
      trend,
      velocity:       parseFloat(velocity.toFixed(2)),
      previousScores: scores,
    }
  })

  // ── 4. Build profile ─────────────────────────────────────────────────────────
  const isJunior = student.grade >= 7 && student.grade <= 9
  const profile: StudentProfile = {
    id:      student.id,
    name:    student.name,
    grade:   student.grade,
    level:   isJunior ? 'Junior School' : 'Senior School',
    term:    latestAssessment.term || 1,
    year:    latestAssessment.year || new Date().getFullYear(),
    pathway: student.current_pathway,
    school:  student.school,
  }

  // ── 5. Build report ──────────────────────────────────────────────────────────
  const vitals     = calculateVitals(subjectProgress)
  const actionPlan = generateActionPlan(subjectProgress)
  const guidance   = isJunior ? generateJuniorGuidance(subjectProgress) : undefined

  const report = generateReport(profile, subjectProgress, vitals, actionPlan, assessments, guidance)

  console.log(`\n  Level:          ${report.clinicalOverview.overallCompetencyLevel} — ${report.clinicalOverview.overallCompetencyLabel}`)
  console.log(`  Trajectory:     ${report.clinicalOverview.trajectory}`)
  console.log(`  Status:         ${report.academicStatusLabel}`)
  console.log(`  Subjects:       ${subjectProgress.length}`)
  if (report.pathwayReadinessCards) {
    console.log(`  Pathway cards:`)
    for (const c of report.pathwayReadinessCards) {
      console.log(`    ${c.pathway}: ${c.score}% — ${c.statusLabel}`)
    }
  }
  console.log(`  Roadmap:        ${report.pathwayRoadmap?.targetPathway} — ${report.pathwayRoadmap?.steps.length ?? 0} step(s)`)

  // ── 6. Generate PDF ──────────────────────────────────────────────────────────
  console.log('\nGenerating 3-page PDF…')
  const pdfBlob   = await generateAcademicClinicPDF(report)
  const pdfBuffer = Buffer.from(await pdfBlob.arrayBuffer())

  const outDir  = path.resolve(__dirname, '../generated-reports')
  if (!fs.existsSync(outDir)) fs.mkdirSync(outDir, { recursive: true })

  const filename = `Academic_Clinic_TUCYLA_${new Date().toISOString().slice(0, 10)}.pdf`
  const filepath = path.join(outDir, filename)
  fs.writeFileSync(filepath, pdfBuffer)

  console.log(`\n✅  PDF saved → ${filepath}`)
  console.log(`    Size: ${(pdfBuffer.length / 1024).toFixed(1)} KB`)
}

main().catch(err => { console.error('Fatal:', err); process.exit(1) })
