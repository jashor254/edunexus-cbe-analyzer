// lib/compass/providerPayload.ts
//
// The single place that decides what a Compass turn sends to the external
// model provider (Gemini primary, DeepSeek fallback — lib/ai/deepseek.ts).
// app/api/learn/route.ts passes the result straight to streamDeepSeek, so the
// tests on this function inspect exactly the text that leaves our
// infrastructure.
//
// Privacy (Stage B2): the learner's own name parts are removed from every
// learner-derived, free-text input BEFORE the prompt is built — the prompt's
// own instruction text is never scrubbed, so a name that is also an ordinary
// word cannot rewrite our instructions. Fields scrubbed here, and why:
//   - message, history       learner-typed; history also carries assistant
//                            turns the client shows with the real name restored
//   - lastSessionSummary     persisted with the real name restored (route), and
//                            pre-fix rows were written with the real name
//   - holidayFocus, knowledgeContext.*
//                            written from AI output with the name restored
//                            (assessment pipeline, career auto-report)
//   - subject, subtopic      client-supplied (lockedSubject / lockedSubstrand)
//   - teacherRecommendation, persistentIntelligence.riskFactors,
//     activePedagogy.concept free text from teachers / earlier model output
// Enum-like fields (mode, levelSource, pathway, …) are left alone.
//
// This removes direct name identifiers only. Grade, levels, learning gaps and
// the learner's own words are still sent — they are what the model tutors on —
// so the payload is pseudonymised, not anonymised.

import { LEARNER_NAME_TOKEN } from '@/lib/ai/learnerPseudonym'
import { buildCompassPrompt, type CompassPromptParams } from './prompt'
import { scrubLearnerIdentity, type LearnerIdentity } from './namePseudonym'

export type CompassChatTurn = { role: 'user' | 'assistant'; content: string }

export type CompassProviderPayload = {
  systemPrompt: string
  message: string
  history: CompassChatTurn[]
}

export function buildCompassProviderPayload(input: {
  promptParams: Omit<CompassPromptParams, 'firstName'>
  identity: LearnerIdentity
  message: string
  history: CompassChatTurn[]
}): CompassProviderPayload {
  const scrub = (text: string): string => scrubLearnerIdentity(text, input.identity)
  const scrubNullable = (text: string | null): string | null => (text === null ? null : scrub(text))
  const scrubOptional = (text: string | undefined): string | undefined => (text === undefined ? undefined : scrub(text))

  const p = input.promptParams
  const kc = p.knowledgeContext
  const params: CompassPromptParams = {
    ...p,
    firstName: LEARNER_NAME_TOKEN,
    subject: scrub(p.subject),
    subtopic: scrub(p.subtopic),
    lastSessionSummary: scrubOptional(p.lastSessionSummary),
    teacherRecommendation: scrubOptional(p.teacherRecommendation),
    holidayFocus: scrubOptional(p.holidayFocus),
    knowledgeContext: kc && {
      ...kc,
      sessionGoal: scrubNullable(kc.sessionGoal),
      guidedTopics: kc.guidedTopics.map(scrub),
      rootCauseSummary: scrubNullable(kc.rootCauseSummary),
      subjectActionSteps: kc.subjectActionSteps.map(scrub),
      rootCauseTopic: scrubNullable(kc.rootCauseTopic),
      failingTopic: scrubNullable(kc.failingTopic),
    },
    persistentIntelligence: p.persistentIntelligence && {
      ...p.persistentIntelligence,
      riskFactors: p.persistentIntelligence.riskFactors.map(scrub),
    },
    activePedagogy: p.activePedagogy && {
      ...p.activePedagogy,
      concept: scrubNullable(p.activePedagogy.concept),
    },
  }

  return {
    systemPrompt: buildCompassPrompt(params),
    message: scrub(input.message),
    history: input.history.map(turn => ({ role: turn.role, content: scrub(turn.content) })),
  }
}
