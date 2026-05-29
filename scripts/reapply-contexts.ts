// scripts/reapply-contexts.ts
// Re-runs context upsert for all teacher students using the latest algorithm.
// No PDF, no notifications — pure pipeline recalculation.

import { config } from 'dotenv'
config({ path: '.env.local' })
import { createServiceClient } from '@/utils/supabase/service'
import { analyzePerformance } from '@/lib/adaptiveLearning'
import { calculateJuniorPathwayAffinity } from '@/lib/pathwayCalculator'
import { generateLearningCompassRec, formatSubjectName } from '@/lib/academicClinic/reportGenerator'
import type { SubjectProgress } from '@/lib/academicClinic/types'

const TEACHER_ID      = '45699ad6-f89c-4376-985f-31730a341801'
const TEACHER_USER_ID = '5cb45b89-0473-40f8-be70-0857424432a7'
const SUBJECT_KEYS = [
  'mathematics','english','kiswahili','integrated_science','pre_technical_studies',
  'creative_arts_sports','social_studies','cre','agriculture_nutrition',
] as const

async function withRetry<T>(fn: () => Promise<T>, attempts = 5, delayMs = 2000): Promise<T> {
  for (let i = 0; i < attempts; i++) {
    try { return await fn() } catch (err) {
      if (i === attempts - 1) throw err
      await new Promise(r => setTimeout(r, delayMs * (i + 1)))
    }
  }
  throw new Error('unreachable')
}

async function main() {
  const db = createServiceClient()

  const { data: students } = await db
    .from('students').select('id, name, grade, curriculum_type')
    .eq('teacher_id', TEACHER_ID).order('name')

  if (!students?.length) { console.log('No students found'); return }
  console.log(`Processing ${students.length} students…`)

  let ok = 0
  let fail = 0

  for (const student of students) {
    const { data: assessment } = await db
      .from('assessments').select('id, subject_scores, term, year')
      .eq('student_id', student.id)
      .order('created_at', { ascending: false }).limit(1).maybeSingle()

    if (!assessment) { console.log(`  SKIP ${student.name} — no assessment`); fail++; continue }

    const cbcScores = assessment.subject_scores as Record<string, number>
    const subjects: SubjectProgress[] = SUBJECT_KEYS.map(key => ({
      subject: key, displayName: formatSubjectName(key),
      level: (cbcScores[key] ?? 1) as 1|2|3|4, trend: 'stable', velocity: 0, previousScores: [],
    }))

    const analysis   = analyzePerformance(cbcScores)
    const pathway    = calculateJuniorPathwayAffinity(cbcScores)
    const compassRec = generateLearningCompassRec(subjects)

    const subjectTiers: Record<string, string> = {}
    const subjectActionSteps: Record<string, string[]> = {}
    analysis.recommendations.forEach(rec => {
      subjectTiers[rec.subject] = rec.tier
      subjectActionSteps[rec.subject] = rec.actionSteps
    })
    const overallLevel = Math.round(subjects.reduce((s, sub) => s + sub.level, 0) / subjects.length)

    try {
      await withRetry(async () => { await db.from('student_learning_context').upsert({
        student_id:           student.id,
        user_id:              TEACHER_USER_ID,
        overall_tier:         analysis.overallTier,
        subject_tiers:        subjectTiers,
        subject_action_steps: subjectActionSteps,
        recommended_pathway:  pathway.top_pathway,
        pathway_confidence:   pathway.confidence,
        pathway_scores: {
          STEM: pathway.stem_score,
          'Social Sciences': pathway.social_sciences_score,
          'Arts & Sports': pathway.arts_sports_score,
        },
        first_subject:       compassRec.firstSessionSubject,
        session_goal:        compassRec.sessionGoal,
        guided_topics:       compassRec.topicsToAsk,
        overall_level:       overallLevel,
        curriculum_type:     student.curriculum_type ?? 'cbc',
        grade:               student.grade,
        last_assessment_id:  assessment.id,
      }, { onConflict: 'student_id' }) })
      process.stdout.write('.')
      ok++
    } catch (e) {
      console.log(`\n  FAIL ${student.name}: ${e instanceof Error ? e.message : e}`)
      fail++
    }
  }

  console.log(`\nDone: ${ok} updated, ${fail} failed`)

  // Final distribution
  const { data: dist } = await db.from('student_learning_context')
    .select('recommended_pathway')
    .in('student_id', students.map(s => s.id))

  const counts: Record<string, number> = {}
  for (const r of dist ?? []) {
    counts[r.recommended_pathway] = (counts[r.recommended_pathway] ?? 0) + 1
  }
  console.log('\nPathway distribution:')
  for (const [p, c] of Object.entries(counts).sort((a, b) => b[1] - a[1])) {
    const pct = Math.round((c / students.length) * 100)
    console.log(`  ${p.padEnd(25)} ${String(c).padStart(2)} (${pct}%)`)
  }
}

main().catch(e => { console.error(e); process.exit(1) })
