// scripts/fix-missing-contexts.ts
// Re-runs the learning context pipeline for JOHN MUCHIRI and KAREN WANGARI
// whose contexts were on ghost student records that were cleaned up.

import { config } from 'dotenv'
config({ path: '.env.local' })
import { createServiceClient } from '@/utils/supabase/service'
import { analyzePerformance } from '@/lib/adaptiveLearning'
import { calculateJuniorPathwayAffinity } from '@/lib/pathwayCalculator'
import { generateLearningCompassRec, formatSubjectName } from '@/lib/academicClinic/reportGenerator'
import type { SubjectProgress } from '@/lib/academicClinic/types'

const TEACHER_ID      = '45699ad6-f89c-4376-985f-31730a341801'
const TEACHER_USER_ID = '5cb45b89-0473-40f8-be70-0857424432a7'
const CURRICULUM      = 'cbc'
const GRADE           = 9
const TERM            = 1
const YEAR            = 2026

const SUBJECT_KEYS = [
  'mathematics','english','kiswahili','integrated_science','pre_technical_studies',
  'creative_arts_sports','social_studies','cre','agriculture_nutrition',
] as const

async function main() {
  const db = createServiceClient()

  // Find students missing contexts
  const { data: allStudents } = await db
    .from('students')
    .select('id, name')
    .eq('teacher_id', TEACHER_ID)

  const { data: existingContexts } = await db
    .from('student_learning_context')
    .select('student_id')
    .in('student_id', (allStudents ?? []).map(s => s.id))

  const contextIds = new Set((existingContexts ?? []).map(c => c.student_id))
  const missing = (allStudents ?? []).filter(s => !contextIds.has(s.id))

  if (!missing || missing.length === 0) {
    console.log('All contexts present — nothing to fix.')
    return
  }

  console.log(`Fixing contexts for: ${missing.map(s => s.name).join(', ')}`)

  for (const student of missing) {
    // Load their assessment
    const { data: assessment } = await db
      .from('assessments')
      .select('id, subject_scores')
      .eq('student_id', student.id)
      .eq('term', TERM)
      .eq('year', YEAR)
      .order('created_at')
      .limit(1)
      .single()

    if (!assessment) {
      console.error(`  No assessment found for ${student.name}`)
      continue
    }

    const cbcScores = assessment.subject_scores as Record<string, number>

    const subjects: SubjectProgress[] = SUBJECT_KEYS.map(key => ({
      subject:        key,
      displayName:    formatSubjectName(key),
      level:          (cbcScores[key] ?? 1) as 1 | 2 | 3 | 4,
      trend:          'stable' as const,
      velocity:       0,
      previousScores: [],
    }))

    const analysis   = analyzePerformance(cbcScores)
    const pathway    = calculateJuniorPathwayAffinity(cbcScores)
    const compassRec = generateLearningCompassRec(subjects)

    const subjectTiers: Record<string, string>         = {}
    const subjectActionSteps: Record<string, string[]> = {}
    analysis.recommendations.forEach(rec => {
      subjectTiers[rec.subject]       = rec.tier
      subjectActionSteps[rec.subject] = rec.actionSteps
    })

    const overallLevel = Math.round(
      subjects.reduce((s, sub) => s + sub.level, 0) / subjects.length
    )

    const { error } = await db.from('student_learning_context').upsert({
      student_id:           student.id,
      user_id:              TEACHER_USER_ID,
      overall_tier:         analysis.overallTier,
      subject_tiers:        subjectTiers,
      subject_action_steps: subjectActionSteps,
      recommended_pathway:  pathway.top_pathway ?? null,
      pathway_confidence:   pathway.confidence  ?? null,
      pathway_scores: {
        STEM:              pathway.stem_score,
        'Social Sciences': pathway.social_sciences_score,
        'Arts & Sports':   pathway.arts_sports_score,
      },
      first_subject:       compassRec.firstSessionSubject,
      session_goal:        compassRec.sessionGoal,
      guided_topics:       compassRec.topicsToAsk,
      overall_level:       overallLevel,
      curriculum_type:     CURRICULUM,
      grade:               GRADE,
      last_assessment_id:  assessment.id,
    }, { onConflict: 'student_id' })

    if (error) {
      console.error(`  Error saving context for ${student.name}:`, error.message)
    } else {
      console.log(`  ✓ ${student.name}  tier=${analysis.overallTier}  pathway=${pathway.top_pathway}  level=${overallLevel}`)
    }
  }

  // Final verification
  const { count } = await db
    .from('student_learning_context')
    .select('student_id', { count: 'exact', head: true })
    .in('student_id', (await db.from('students').select('id').eq('teacher_id', TEACHER_ID)).data!.map(s => s.id))

  console.log(`\nLearning contexts: ${count}/71  ${count === 71 ? '✓' : '✗'}`)
}

main().catch(e => { console.error(e); process.exit(1) })
