// lib/ai/logPolicy.ts
// Single source of truth for whether raw AI prompt/response CONTENT may be
// recorded (persisted to ai_call_logs or printed to the dev console).
//
// Default is FALSE: learner content (essays, tutoring chat, reflections) must
// NOT be captured by default — only operational metadata (feature, model,
// token count, latency, success) is. Set AI_LOG_CONTENT=true in a trusted
// dev/staging environment when you genuinely need to inspect prompt text for
// debugging. Never set it in production. See
// docs/audits/learner-data-privacy-remediation-plan.md Stage B1.
//
// Kept in its own module (not logger.ts) because logger.ts imports the
// repositories layer, and analytics.repository.ts needs this gate too — a
// shared import here avoids a circular dependency.

export function shouldLogAIContent(): boolean {
  return process.env.AI_LOG_CONTENT === 'true'
}
