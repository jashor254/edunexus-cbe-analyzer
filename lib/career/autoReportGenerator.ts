// lib/career/autoReportGenerator.ts
// Batch clinic report + compass_bridge generator for teacher-triggered class processing.

import type { SupabaseClient } from '@supabase/supabase-js'
import { callDeepSeek } from '@/lib/ai/deepseek'
import { buildClinicReport } from './clinicReportBuilder'

// ── Compass Bridge type (matches what chat route consumes) ────────────────────

export type CompassBridge = {
  sessionGoal: string
  firstSubject: string
  firstConcept: string
  startDifficulty: 1 | 2 | 3
  subjectPriorities: Array<{
    subject: string
    displayName: string
    currentTier: string
    requiredTier: string
    gap: number
    careerReason: string
    actionSteps: string[]
  }>
  weeklyMilestones: Array<{
    week: number
    goal: string
    subject: string
    checkConcept: string
  }>
  parentWhatsAppMessage: string
}

// ── Tier → difficulty mapping ─────────────────────────────────────────────────

function tierToDifficulty(tier: string): 1 | 2 | 3 {
  // Handle both raw DB values (reinforcement/standard/challenge) and mapped form
  if (tier === 'below_expectations' || tier === 'remedial') return 1
  if (tier === 'approaching_expectations' || tier === 'reinforcement') return 2
  if (tier === 'meets_expectations' || tier === 'standard') return 3
  return 3
}

// ── Generate specific compass_bridge via DeepSeek ────────────────────────────

export async function generateCompassBridge(
  studentId: string,
  db: SupabaseClient
): Promise<CompassBridge | null> {
  try {
    const { data: student } = await db
      .from('students')
      .select('id, name, grade, curriculum_type')
      .eq('id', studentId)
      .single()

    if (!student) return null

    const { data: ctx } = await db
      .from('student_learning_context')
      .select('overall_tier, subject_tiers, subject_action_steps, recommended_pathway, top_careers')
      .eq('student_id', studentId)
      .maybeSingle()

    const { data: assessments } = await db
      .from('assessments')
      .select('subject_scores')
      .eq('student_id', studentId)
      .order('created_at', { ascending: false })
      .limit(1)

    const scores: Record<string, number> = assessments?.[0]?.subject_scores ?? {}
    const subjectTiers: Record<string, string> = ctx?.subject_tiers ?? {}
    const actionSteps: Record<string, string[]> = ctx?.subject_action_steps ?? {}
    const overallTier: string = ctx?.overall_tier ?? 'approaching_expectations'
    const targetCareer = ctx?.top_careers?.[0]?.career_title ?? ctx?.recommended_pathway ?? 'their chosen pathway'

    const subjectTable = Object.entries(scores)
      .map(([subj, score]) => `${subj}: ${score}/4 (${subjectTiers[subj] ?? 'approaching'})`)
      .join('\n')

    const stepsTable = Object.entries(actionSteps)
      .map(([subj, steps]) => `${subj}: ${(steps as string[]).slice(0, 2).join('; ')}`)
      .join('\n')

    // Students averaging Level 2 or below → start at difficulty 1 to build confidence
    const allScores = Object.values(scores).filter(v => v > 0)
    const avgScore = allScores.length > 0 ? allScores.reduce((a, b) => a + b, 0) / allScores.length : 0
    const uniformlyLow = avgScore > 0 && avgScore <= 2.2
    const recommendedDifficulty = uniformlyLow ? 1 : tierToDifficulty(overallTier)

    const prompt = `You are generating a personalized Learning Compass briefing for a Kenyan student.

Student: ${student.name as string}, Grade ${student.grade as number}
Curriculum: ${(student.curriculum_type as string) ?? 'cbc'}
Overall Level: ${overallTier}
Career / Pathway Target: ${targetCareer}

Subject Performance (CBC 1-4 scale):
${subjectTable}

Current Action Steps:
${stepsTable}

Generate a compass_bridge JSON. Be SPECIFIC. Never say "improve Mathematics" — say "master fractions and percentages" or "practice linear equations". Use the student's actual weak subjects.

CRITICAL: firstConcept MUST be a specific substrand name from the Kenya CBC curriculum.

Grade 7-9 Mathematics examples:
  'fractions', 'integers', 'algebra_expressions', 'linear_equations',
  'angles', 'area_perimeter', 'data_and_statistics', 'percentages'

Grade 7-9 Science examples:
  'cell_structure', 'photosynthesis', 'human_digestive_system',
  'ecosystems', 'forces_and_motion', 'simple_machines'

Grade 7-9 English examples:
  'essay_writing', 'grammar_tenses', 'reading_comprehension',
  'oral_skills', 'letter_writing', 'vocabulary'

Grade 10-12 Biology examples:
  'cell_biology', 'cell_division', 'genetics', 'ecology',
  'human_physiology', 'photosynthesis_senior', 'classification'

Grade 10-12 Chemistry examples:
  'atomic_structure', 'chemical_bonding', 'stoichiometry',
  'acids_bases', 'periodic_table', 'organic_chemistry_intro'

Grade 10-12 Physics examples:
  'mechanics', 'waves', 'electricity', 'magnetism',
  'optics', 'thermodynamics', 'nuclear_physics'

If scores alone cannot determine the specific substrand, set firstConcept to null.

IMPORTANT: Set startDifficulty to ${recommendedDifficulty}.${uniformlyLow ? ' This student has uniform Level 2 scores — start at 1 to build confidence first before progressing.' : ''}
The UI will then show a curriculum-aligned topic selector pulled from the DB.

NEVER set firstConcept to just a subject name. 'mathematics' is WRONG. 'fractions' is CORRECT.

Return ONLY valid JSON in this exact shape:
{
  "sessionGoal": "One specific sentence naming the subject and concept — e.g. 'Close the gap in fractions and basic algebra — these are blocking the STEM pathway progress'",
  "firstSubject": "the single most urgent subject name (lowercase, e.g. mathematics)",
  "firstConcept": "specific substrand slug e.g. fractions, cell_structure, essay_writing — NOT just the subject name. null if unclear.",
  "startDifficulty": 1 or 2 or 3 based on tier (below=1, approaching=2, meets=3),
  "subjectPriorities": [
    {
      "subject": "mathematics",
      "displayName": "Mathematics",
      "currentTier": "approaching_expectations",
      "requiredTier": "meets_expectations",
      "gap": 1,
      "careerReason": "Biology is critical for Medicine — Level 3 minimum needed for university entry",
      "actionSteps": ["specific step 1", "specific step 2"]
    }
  ],
  "weeklyMilestones": [
    {
      "week": 1,
      "goal": "specific goal e.g. Master fractions — solve 3/4 + 1/2 without help",
      "subject": "mathematics",
      "checkConcept": "fractions"
    },
    {
      "week": 2,
      "goal": "specific week 2 goal",
      "subject": "subject name",
      "checkConcept": "concept"
    }
  ],
  "parentWhatsAppMessage": "Hi! ${student.name as string}'s report is ready. This week Learning Compass will focus on [concept] in [subject] — their biggest gap toward [pathway/career]. Start their first free session here: edunexus.co.ke/chat"
}

Include top 3 subjects in subjectPriorities. Keep parentWhatsAppMessage under 50 words. Be encouraging, not alarming.`

    const raw = await callDeepSeek(prompt, 'You are a Kenyan education AI. Return ONLY valid JSON. No markdown.')
    const cleaned = raw.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim()
    const bridge = JSON.parse(cleaned) as CompassBridge

    // Validate start difficulty is 1-3; enforce 1 for uniformly-low students
    if (![1, 2, 3].includes(bridge.startDifficulty)) {
      bridge.startDifficulty = recommendedDifficulty
    }
    if (uniformlyLow && bridge.startDifficulty > 1) {
      bridge.startDifficulty = 1
    }

    return bridge
  } catch (err) {
    console.error('[autoReportGenerator] compass_bridge generation failed:', err)
    return null
  }
}

// ── Batch class report generator ──────────────────────────────────────────────

export type ClassReportResult = {
  success: number
  failed: number
  results: Array<{
    student_id: string
    student_name: string
    status: 'ok' | 'error'
    error?: string
  }>
}

export async function generateClassReports(
  classId: string,
  assessmentIds: string[],
  db: SupabaseClient
): Promise<ClassReportResult> {
  const { data: links } = await db
    .from('class_students')
    .select('student_id')
    .eq('class_id', classId)

  const studentIds = (links ?? []).map((l: { student_id: string }) => l.student_id)

  if (studentIds.length === 0) {
    return { success: 0, failed: 0, results: [] }
  }

  const { data: students } = await db
    .from('students')
    .select('id, name')
    .in('id', studentIds)

  const results: ClassReportResult['results'] = []

  for (const s of students ?? []) {
    const studentId = s.id as string
    const studentName = s.name as string
    try {
      // 1. Build clinic report (updates learning context)
      await buildClinicReport(studentId, db)

      // 2. Generate specific compass_bridge via DeepSeek
      const bridge = await generateCompassBridge(studentId, db)
      if (bridge) {
        await db
          .from('student_learning_context')
          .update({
            compass_bridge: bridge,
            first_subject: bridge.firstSubject,
            session_goal: bridge.sessionGoal,
            guided_topics: bridge.weeklyMilestones.map(m => m.checkConcept),
          })
          .eq('student_id', studentId)
      }

      // 3. Mark student with last report generation time
      await db
        .from('students')
        .update({ updated_at: new Date().toISOString() })
        .eq('id', studentId)

      results.push({ student_id: studentId, student_name: studentName, status: 'ok' })
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err)
      console.error(`[autoReportGenerator] failed for ${studentName}:`, msg)
      results.push({ student_id: studentId, student_name: studentName, status: 'error', error: msg })
    }
  }

  return {
    success: results.filter(r => r.status === 'ok').length,
    failed: results.filter(r => r.status === 'error').length,
    results,
  }
}
