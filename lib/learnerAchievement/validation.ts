// lib/learnerAchievement/validation.ts
//
// Field-level validation only. Whether a claimed achievement is genuinely
// real is Phase 5's evidence-requirement rule (enforced in achievement.ts
// at the verify() transition, not here) plus teacher editorial judgment —
// never something this module scores or gates.

import { ACHIEVEMENT_TYPES, ACHIEVEMENT_CATEGORIES, type AchievementFields } from './types'

const MAX_TITLE_LENGTH = 200
const MAX_TEXT_LENGTH = 4000

export function validateAchievementFields(fields: AchievementFields): void {
  if (!ACHIEVEMENT_TYPES.includes(fields.achievementType)) {
    throw new Error(`Achievement: "${fields.achievementType}" is not a canonical achievement type.`)
  }
  if (!ACHIEVEMENT_CATEGORIES.includes(fields.category)) {
    throw new Error(`Achievement: "${fields.category}" is not a canonical achievement category.`)
  }
  if (!fields.title || !fields.title.trim()) {
    throw new Error('Achievement: "title" is required.')
  }
  if (fields.title.length > MAX_TITLE_LENGTH) {
    throw new Error(`Achievement: "title" exceeds ${MAX_TITLE_LENGTH} characters.`)
  }
  if (fields.description && fields.description.length > MAX_TEXT_LENGTH) {
    throw new Error(`Achievement: "description" exceeds ${MAX_TEXT_LENGTH} characters.`)
  }
  if (!fields.awardDate || Number.isNaN(Date.parse(fields.awardDate))) {
    throw new Error('Achievement: "awardDate" is required and must be a valid date.')
  }
  if (fields.expiresAt && Number.isNaN(Date.parse(fields.expiresAt))) {
    throw new Error('Achievement: "expiresAt" must be a valid date.')
  }
}
