// lib/learnerInnovation/validation.ts
//
// Field-level validation only. Whether an idea is genuinely novel is
// teacher/mentor editorial judgment recorded as fact (Validation phase,
// mission Phase 8's "requires teacher approval") — never something this
// module scores or gates. No AI, no novelty classifier, no ranking engine
// (Stop Condition).

import type { InnovationFields } from './types'

const MAX_TEXT_LENGTH = 4000

export function validateInnovationFields(fields: InnovationFields): void {
  if (!fields.problemAddressed || !fields.problemAddressed.trim()) {
    throw new Error('Innovation: "problemAddressed" is required.')
  }
  if (fields.problemAddressed.length > MAX_TEXT_LENGTH) {
    throw new Error(`Innovation: "problemAddressed" exceeds ${MAX_TEXT_LENGTH} characters.`)
  }
  if (!fields.ideaSummary || !fields.ideaSummary.trim()) {
    throw new Error('Innovation: "ideaSummary" is required.')
  }
  if (fields.ideaSummary.length > MAX_TEXT_LENGTH) {
    throw new Error(`Innovation: "ideaSummary" exceeds ${MAX_TEXT_LENGTH} characters.`)
  }
}

export function validateIterationFields(problem: string, hypothesis: string, changeIntroduced: string, evidence: string, outcome: string): void {
  const fields = { problem, hypothesis, changeIntroduced, evidence, outcome }
  for (const [name, value] of Object.entries(fields)) {
    if (!value || !value.trim()) {
      throw new Error(`Innovation iteration: "${name}" is required.`)
    }
    if (value.length > MAX_TEXT_LENGTH) {
      throw new Error(`Innovation iteration: "${name}" exceeds ${MAX_TEXT_LENGTH} characters.`)
    }
  }
}
