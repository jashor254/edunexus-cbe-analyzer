import type { SubstrandHealthRow, RootCauseCode } from './types'
import { callGemini } from '@/lib/ai/gemini'
import { logAICall } from '@/lib/ai/logger'
import { GEMINI_PRIMARY } from '@/lib/ai/models'

const VALID_CODES: RootCauseCode[] = [
  'PACE_MISMATCH',
  'CONCEPT_LEAP',
  'PREREQUISITE_GAP',
  'LANGUAGE_BARRIER',
  'RESOURCE_MISMATCH',
  'TEACHER_STRATEGY',
  'UNKNOWN',
]

// Rule-based pass — no AI cost, runs synchronously
export function classifyRuleBased(row: SubstrandHealthRow): RootCauseCode | null {
  // Taught multiple times, still flagged, teacher hasn't remediated — pacing issue
  if (row.struggle_count >= 2 && !row.remediated) {
    return 'PACE_MISMATCH'
  }
  // First time this sub-strand was ever taught and already flagged — curriculum jumped too fast
  if (row.lessons_covered === 1 && row.struggle_count >= 1) {
    return 'CONCEPT_LEAP'
  }
  return null // ambiguous — escalate to AI
}

// AI fallback — only called when rule-based returns null
async function classifyWithAI(
  row: SubstrandHealthRow,
  context: { grade: string; learningArea: string }
): Promise<RootCauseCode> {
  const prompt = `You are an education diagnostic assistant for Kenyan CBC schools.

A teacher flagged a learning difficulty in ${context.learningArea}, ${context.grade}.

Sub-strand: "${row.sub_strand}" (Strand: "${row.strand}")
Lessons taught on this sub-strand: ${row.lessons_covered}
Times teacher flagged a follow-up: ${row.struggle_count}
Already attempted remediation: ${row.remediated ? 'Yes' : 'No'}

Choose the single most likely root cause from this exact list:
PREREQUISITE_GAP - learners lack foundational knowledge from earlier topics
LANGUAGE_BARRIER - learners struggle to follow instruction due to language comprehension
RESOURCE_MISMATCH - teaching materials were insufficient for this concept
TEACHER_STRATEGY - the teaching approach did not suit how this concept is best learned
UNKNOWN - not enough information to determine

Reply with ONLY the code, nothing else.`

  const start = Date.now()
  let result: RootCauseCode = 'UNKNOWN'
  let success = true
  let errMsg: string | undefined

  try {
    const raw = (await callGemini(prompt)).trim().toUpperCase()
    result = (VALID_CODES.includes(raw as RootCauseCode) ? raw : 'UNKNOWN') as RootCauseCode
  } catch (err) {
    success = false
    errMsg = err instanceof Error ? err.message : String(err)
    result = 'UNKNOWN'
  }

  await logAICall({
    feature: 'tie_root_cause',
    model: GEMINI_PRIMARY,
    prompt: prompt.substring(0, 500),
    response: result,
    latencyMs: Date.now() - start,
    success,
    error: errMsg,
  })

  return result
}

export async function classifyRootCause(
  row: SubstrandHealthRow,
  context: { grade: string; learningArea: string }
): Promise<RootCauseCode> {
  const ruleResult = classifyRuleBased(row)
  if (ruleResult) return ruleResult
  return classifyWithAI(row, context)
}
