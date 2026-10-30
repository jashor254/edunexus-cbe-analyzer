// lib/compass/providerPayload.ts
// Every text channel a Compass turn sends to an AI provider, with the
// learner's first name replaced by LEARNER_NAME_TOKEN. The same payload goes
// to whichever provider answers — Gemini primary or the DeepSeek fallback,
// including retries — so all of them receive identical, pseudonymised content.
//
// Two channels:
//
// 1. pseudonymiseCompassProviderText — the learner's own message and the
//    session's stored history (assistant turns are stored with the name
//    restored, since the learner reads them live).
//
// 2. pseudonymiseCompassSystemPrompt — the ASSEMBLED system prompt.
//    buildCompassPrompt (lib/compass/prompt.ts) takes no name parameter, but
//    it interpolates persisted learner-state fields — session_goal /
//    holidayFocus, guided_topics, subject_action_steps, the knowledge-graph
//    block, the teacher recommendation, the subtopic and the last-session
//    summary. The class-report path (lib/career/autoReportGenerator.ts)
//    generates some of those with the LLM and restoreLearnerName() writes the
//    real first name back into them before they are persisted, so the name
//    can re-enter a later turn's prompt through stored state (R-1,
//    docs/audits/ai-call-efficiency-remediation.md phase 3). Pseudonymising
//    the finished prompt string catches that regardless of which field
//    carried the name or how it got there.
//
// Both are deterministic and never log the real name.

import { pseudonymiseLearnerName } from '@/lib/ai/learnerPseudonym'

type ChatMessage = { role: 'user' | 'assistant'; content: string }

export type CompassProviderText = {
  message:            string
  history:            ChatMessage[]
  lastSessionSummary: string | undefined
}

/**
 * `firstName` is null when the learner has no stored name (nothing to
 * replace). Never pass a display fallback like "there" — it is not a name.
 */
export function pseudonymiseCompassProviderText(
  input: CompassProviderText,
  firstName: string | null,
): CompassProviderText {
  return {
    message:            pseudonymiseLearnerName(input.message, firstName),
    history:            input.history.map(m => ({ role: m.role, content: pseudonymiseLearnerName(m.content, firstName) })),
    lastSessionSummary: input.lastSessionSummary === undefined
      ? undefined
      : pseudonymiseLearnerName(input.lastSessionSummary, firstName),
  }
}

/**
 * The final provider boundary for the assembled Compass system prompt. Call
 * it on the string buildCompassPrompt() returns, immediately before handing
 * it to the model — after all prompt construction and context enrichment, so
 * no interpolated field can smuggle the learner's name past it.
 *
 * `firstName` is null when the learner has no stored name (nothing to
 * replace). Never pass a display fallback like "there" — it is not a name.
 * The prompt's own LEARNER_NAME_TOKEN placeholders are left intact; only the
 * real name is replaced (lib/ai/learnerPseudonym.ts).
 */
export function pseudonymiseCompassSystemPrompt(systemPrompt: string, firstName: string | null): string {
  return pseudonymiseLearnerName(systemPrompt, firstName)
}
