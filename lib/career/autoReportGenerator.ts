// lib/career/autoReportGenerator.ts
// Batch clinic report + compass_bridge generator for teacher-triggered class processing.

import type { SupabaseClient } from '@supabase/supabase-js'
import { callDeepSeek } from '@/lib/ai/deepseek'
import { buildClinicReport } from './clinicReportBuilder'

// ── compass_bridge ownership ─────────────────────────────────────────────────
//
// `student_learning_context.compass_bridge` is a single per-learner jsonb slot
// with TWO writers, and they own different keys:
//
//   TEACHER / BLUEPRINT OWNED  teacherSuggested, teacherSuggestedAt,
//                              subStrandId, deliveryId, strandName
//     Written only by lib/compass/objective.ts::setTeacherSuggestedTopic
//     (via the canonical merge). This is teacher intent and Blueprint
//     delivery provenance.
//
//   CAREER REPORT OWNED        sessionGoal, startDifficulty,
//                              subjectPriorities, weeklyMilestones,
//                              parentWhatsAppMessage
//     Written only here. Advisory context for a Compass session.
//
//   SHARED                     firstSubject, firstConcept
//     Both writers set them — they name what the session should open on.
//
// This module previously wrote `compass_bridge: bridge` WHOLESALE, so
// generating a class report erased every teacher/Blueprint-owned key. The
// consequences were silent and severe: the intervention lost its top
// priority in getNextSubject(), the session's mastery claim came back
// unanchored (no subStrandId), and the blueprint_compass_deliveries row was
// orphaned — deliveryBinding binds only to the delivery the bridge names, by
// design, so it could never be completed.
//
// Report generation may still update everything it owns. It may not destroy
// a teacher-approved intervention, and it may not grant itself teacher
// authority.

/** Keys owned by the teacher/Blueprint workflow. This path may never write or clear them. */
const TEACHER_OWNED_BRIDGE_KEYS = [
  'teacherSuggested', 'teacherSuggestedAt', 'subStrandId', 'deliveryId', 'strandName',
] as const

/** Shared keys that name the intervention's target — frozen only while one is live. */
const INTERVENTION_TARGET_KEYS = ['firstSubject', 'firstConcept'] as const

/**
 * Merges freshly generated report context into an existing bridge without
 * disturbing teacher intent.
 *
 * Three rules:
 *   1. Report-owned keys update normally.
 *   2. Teacher/Blueprint-owned keys always come from the CURRENT bridge —
 *      restored if present, removed if absent. Written defensively rather
 *      than relying on the generated object not containing them, so no
 *      future change (or stray AI field) can escalate this path into
 *      teacher authority. Report generation can never introduce
 *      `teacherSuggested: true` that a teacher did not set.
 *   3. When a live intervention exists (`teacherSuggested === true`), the
 *      shared targeting keys are frozen too. Otherwise the report could
 *      retarget the session to a different subject while keeping the
 *      teacher's authority flag — which is the same defect wearing a
 *      different hat, and would additionally strand the teacher's
 *      subStrandId against an unrelated subject.
 *
 * With no teacher intervention present, this is exactly the previous
 * behaviour: every generated field is written.
 */
export function mergeBridgePreservingTeacherIntent(
  current: Record<string, unknown>,
  generated: Record<string, unknown>,
): Record<string, unknown> {
  const merged: Record<string, unknown> = { ...current, ...generated }

  for (const key of TEACHER_OWNED_BRIDGE_KEYS) {
    if (key in current) merged[key] = current[key]
    else delete merged[key]
  }

  if (current.teacherSuggested === true) {
    for (const key of INTERVENTION_TARGET_KEYS) {
      if (key in current) merged[key] = current[key]
    }
  }

  return merged
}

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

CRITICAL: firstConcept MUST be a topic from the student's ACTUAL grade curriculum — NEVER a lower-grade topic.

Grade 7 Mathematics (pick from):
  'fractions', 'decimals', 'percentages', 'integers', 'algebra_expressions',
  'angles', 'area_perimeter', 'data_and_statistics'

Grade 8 Mathematics (pick from):
  'integers', 'algebra_linear_equations', 'commercial_arithmetic',
  'area_and_perimeter', 'data_handling', 'matrices_intro'

Grade 9 Mathematics (pick from — DO NOT use 'fractions' or 'percentages', those are Grade 7):
  'integers', 'cubes_and_cube_roots', 'indices_and_logarithms',
  'compound_proportions', 'linear_equations', 'matrices',
  'area_perimeter_volume', 'coordinates_and_graphs', 'data_handling_probability'

Grade 7 Science: 'cell_structure', 'photosynthesis', 'ecosystems', 'forces_and_motion', 'simple_machines'
Grade 8 Science: 'nutrition', 'reproduction', 'electricity', 'waves'
Grade 9 Science: 'genetics', 'evolution', 'acids_bases', 'organic_chemistry_intro', 'energy_transformations'

Grade 7-9 English: 'essay_writing', 'grammar_tenses', 'reading_comprehension', 'oral_skills', 'letter_writing'
Grade 7-9 Social Studies: 'map_skills', 'population', 'governance', 'economic_activities', 'history_kenya'

Grade 10-12 Biology: 'cell_biology', 'cell_division', 'genetics', 'ecology', 'human_physiology', 'classification'
Grade 10-12 Chemistry: 'atomic_structure', 'chemical_bonding', 'stoichiometry', 'acids_bases', 'organic_chemistry_intro'
Grade 10-12 Physics: 'mechanics', 'waves', 'electricity', 'magnetism', 'optics', 'thermodynamics'
Grade 10-12 Core Mathematics: 'matrices', 'linear_programming', 'differentiation', 'integration', 'statistics'

If scores alone cannot determine the specific substrand, set firstConcept to null.

IMPORTANT: Set startDifficulty to ${recommendedDifficulty}.${uniformlyLow ? ' This student has uniform Level 2 scores — start at 1 to build confidence first before progressing.' : ''}
The UI shows a curriculum-aligned topic selector from the DB after this.

NEVER set firstConcept to just a subject name ('mathematics' is WRONG).
NEVER assign a lower-grade topic to an older student — fractions belong to Grade 7, NOT Grade 9.

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
  "parentWhatsAppMessage": "Hi! ${student.name as string}'s report is ready. This week Learning Compass will focus on [concept] in [subject] — their biggest gap toward [pathway/career]. Start their first free session here: edunexus.co.ke/learn"
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

export type ClassReportProgress = {
  total:              number
  completed:          number
  currentStudentName: string
}

export async function generateClassReports(
  classId: string,
  assessmentIds: string[],
  db: SupabaseClient,
  onProgress?: (event: ClassReportProgress) => void | Promise<void>,
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
  const total = (students ?? []).length
  let completed = 0

  for (const s of students ?? []) {
    const studentId = s.id as string
    const studentName = s.name as string
    await onProgress?.({ total, completed, currentStudentName: studentName })
    try {
      // 1. Build clinic report (updates learning context)
      await buildClinicReport(studentId, db)

      // 2. Generate specific compass_bridge via DeepSeek
      const bridge = await generateCompassBridge(studentId, db)
      if (bridge) {
        // Never clobber a teacher-queued Blueprint intervention. This path
        // used to write `compass_bridge: bridge` wholesale, which silently
        // destroyed teacherSuggested / subStrandId / deliveryId — see
        // mergeBridgePreservingTeacherIntent for the full reasoning.
        const { data: contextRow } = await db
          .from('student_learning_context')
          .select('compass_bridge')
          .eq('student_id', studentId)
          .maybeSingle()

        const mergedBridge = mergeBridgePreservingTeacherIntent(
          (contextRow?.compass_bridge as Record<string, unknown> | null) ?? {},
          bridge,
        )

        await db
          .from('student_learning_context')
          .update({
            compass_bridge: mergedBridge,
            // Report-owned columns, unchanged. `first_subject` follows the
            // MERGED bridge rather than the freshly generated one, so the
            // column can never disagree with the subject Compass will
            // actually steer to.
            first_subject: mergedBridge.firstSubject ?? bridge.firstSubject,
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
    completed++
  }

  return {
    success: results.filter(r => r.status === 'ok').length,
    failed: results.filter(r => r.status === 'error').length,
    results,
  }
}
