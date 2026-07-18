// lib/learnerCompetitions/validation.ts
//
// Field-level validation only. Whether a result is genuinely impressive is
// teacher/organizer judgment recorded as fact (Results/Verification
// phases) — never something this module scores or gates. No AI, no
// ranking engine (Stop Condition).

import { COMPETITION_LEVELS, COMPETITION_CATEGORIES, type CompetitionFields } from './types'

const MAX_NAME_LENGTH = 200
const MAX_TEXT_LENGTH = 4000

export function validateCompetitionFields(fields: CompetitionFields): void {
  if (!COMPETITION_LEVELS.includes(fields.level)) {
    throw new Error(`Competition: "${fields.level}" is not a canonical Competition level.`)
  }
  if (!COMPETITION_CATEGORIES.includes(fields.category)) {
    throw new Error(`Competition: "${fields.category}" is not a canonical Competition category.`)
  }
  if (!fields.name || !fields.name.trim()) {
    throw new Error('Competition: "name" is required.')
  }
  if (fields.name.length > MAX_NAME_LENGTH) {
    throw new Error(`Competition: "name" exceeds ${MAX_NAME_LENGTH} characters.`)
  }
  if (fields.organizingBody && fields.organizingBody.length > MAX_NAME_LENGTH) {
    throw new Error(`Competition: "organizingBody" exceeds ${MAX_NAME_LENGTH} characters.`)
  }
  if (fields.venue && fields.venue.length > MAX_TEXT_LENGTH) {
    throw new Error(`Competition: "venue" exceeds ${MAX_TEXT_LENGTH} characters.`)
  }
  if (fields.eventDate && Number.isNaN(Date.parse(fields.eventDate))) {
    throw new Error('Competition: "eventDate" must be a valid date.')
  }
}
