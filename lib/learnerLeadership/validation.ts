// lib/learnerLeadership/validation.ts
//
// Field-level validation only. Whether a nomination is deserved is
// teacher/school judgment recorded as fact (Selection/Review/Completion
// phases) — never something this module scores, ranks, or gates. No
// election, no vote tally, no AI (Stop Condition).

import type { LeadershipFields } from './types'

const MAX_TITLE_LENGTH = 200
const MAX_TEXT_LENGTH = 4000

export function validateLeadershipFields(fields: LeadershipFields): void {
  if (!fields.positionTitle || !fields.positionTitle.trim()) {
    throw new Error('Leadership: "positionTitle" is required.')
  }
  if (fields.positionTitle.length > MAX_TITLE_LENGTH) {
    throw new Error(`Leadership: "positionTitle" exceeds ${MAX_TITLE_LENGTH} characters.`)
  }
  if (fields.scope && fields.scope.length > MAX_TITLE_LENGTH) {
    throw new Error(`Leadership: "scope" exceeds ${MAX_TITLE_LENGTH} characters.`)
  }
  if (fields.body && fields.body.length > MAX_TITLE_LENGTH) {
    throw new Error(`Leadership: "body" exceeds ${MAX_TITLE_LENGTH} characters.`)
  }
  if (fields.responsibilities && fields.responsibilities.length > MAX_TEXT_LENGTH) {
    throw new Error(`Leadership: "responsibilities" exceeds ${MAX_TEXT_LENGTH} characters.`)
  }
}
