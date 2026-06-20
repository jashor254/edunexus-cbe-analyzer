import { createServiceClient } from '@/utils/supabase/service'
import { callGeminiJSON } from '@/lib/ai/gemini'
import { logAICall } from '@/lib/ai/logger'
import { GEMINI_PRIMARY } from '@/lib/ai/models'
import type { QuickCheckContent, RootCauseCode } from './types'

const ROOT_CAUSE_CONTEXT: Record<RootCauseCode, string> = {
  PACE_MISMATCH:    'students need more time to consolidate this concept',
  CONCEPT_LEAP:     'the concept may build on ideas students haven\'t fully grasped yet',
  PREREQUISITE_GAP: 'some foundational knowledge may benefit from reinforcement',
  LANGUAGE_BARRIER: 'language or terminology may be affecting students\' understanding',
  RESOURCE_MISMATCH:'different teaching materials or approaches could support students better',
  TEACHER_STRATEGY: 'trying a different instructional approach may help students connect with this content',
  UNKNOWN:          'students would benefit from revisiting this concept in a different way',
}

type GenerateInput = {
  substrandHealthId: string
  sowId: string
  teachersId: string  // teachers.id — stored in weekly_intelligence
  authUserId: string  // auth user id — stored in remedial_actions (matches substrand_health pattern)
  strand: string
  subStrand: string
  grade: string
  learningArea: string
  struggleCount: number
  rootCause: string | null
}

type GeminiResponse = {
  activity: string
  questions: [string, string, string]
}

export async function generateQuickCheck(input: GenerateInput): Promise<QuickCheckContent> {
  const db = createServiceClient()

  const causeContext =
    ROOT_CAUSE_CONTEXT[input.rootCause as RootCauseCode] ?? ROOT_CAUSE_CONTEXT.UNKNOWN

  const prompt = `You are helping a CBC Kenya teacher quickly support students who need more practice with a concept.

Subject: ${input.learningArea}
Grade: ${input.grade}
Strand: ${input.strand}
Sub-strand: ${input.subStrand}
Context: ${causeContext}
Number of students who needed follow-up: ${input.struggleCount}

Generate:
1. A practical, specific classroom activity that reinforces understanding of "${input.subStrand}" and takes 10 minutes or less
2. Three short diagnostic questions the teacher can ask verbally to check student understanding

Rules:
- Write in plain English a teacher can read directly to a class
- Be specific to "${input.subStrand}" — avoid generic advice
- Do NOT use the words "gap", "critical", "failing", or "weak"
- Each question must be answerable in one sentence
- The activity must work with standard CBC classroom resources
- Frame everything positively — this is about building confidence, not labelling students

Respond ONLY with valid JSON, exactly this shape:
{
  "activity": "string describing the 10-minute activity",
  "questions": ["question 1", "question 2", "question 3"]
}`

  const start = Date.now()
  let rawResponse = ''

  try {
    rawResponse = await callGeminiJSON(prompt)
  } catch (err: unknown) {
    const errMsg = err instanceof Error ? err.message : String(err)
    await logAICall({
      feature:   'tie_quick_check',
      model:     GEMINI_PRIMARY,
      prompt,
      latencyMs: Date.now() - start,
      success:   false,
      error:     errMsg,
      userId:    input.authUserId,
    })
    throw new Error(`Quick check generation failed: ${errMsg}`)
  }

  await logAICall({
    feature:   'tie_quick_check',
    model:     GEMINI_PRIMARY,
    prompt,
    response:  rawResponse,
    latencyMs: Date.now() - start,
    success:   true,
    userId:    input.authUserId,
  })

  let parsed: GeminiResponse
  try {
    parsed = JSON.parse(rawResponse) as GeminiResponse
    if (
      typeof parsed.activity !== 'string' ||
      !Array.isArray(parsed.questions) ||
      parsed.questions.length < 3
    ) {
      throw new Error('Unexpected response shape')
    }
  } catch {
    throw new Error('Quick check response was not valid JSON')
  }

  const generatedAt = new Date().toISOString()

  const { data: inserted, error: insertErr } = await db
    .from('remedial_actions')
    .insert({
      sow_id:               input.sowId,
      teacher_id:           input.authUserId,
      substrand_health_id:  input.substrandHealthId,
      week_of:              new Date().toISOString().slice(0, 10),
      strand:               input.strand,
      sub_strand:           input.subStrand,
      root_cause:           input.rootCause,
      suggested_activity:   parsed.activity,
      questions:            parsed.questions.slice(0, 3),
      generated_at:         generatedAt,
    })
    .select('id')
    .single()

  if (insertErr || !inserted) {
    throw new Error(`Failed to save quick check: ${insertErr?.message ?? 'unknown error'}`)
  }

  return {
    id:                (inserted as { id: string }).id,
    suggested_activity: parsed.activity,
    questions:          parsed.questions.slice(0, 3),
    generated_at:       generatedAt,
  }
}
