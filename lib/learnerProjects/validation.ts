// lib/learnerProjects/validation.ts
//
// Field-level validation only. Whether a project is genuinely good work is
// teacher editorial judgment (Phase 6 verification) — never something this
// module scores or gates. No rubric, no scoring engine (Forbidden list).

import { PROJECT_CATEGORIES, type ProjectFields } from './types'

const MAX_TITLE_LENGTH = 200
const MAX_TEXT_LENGTH = 4000

export function validateProjectFields(fields: ProjectFields): void {
  if (!PROJECT_CATEGORIES.includes(fields.category)) {
    throw new Error(`Project: "${fields.category}" is not a canonical Project category.`)
  }
  if (!fields.title || !fields.title.trim()) {
    throw new Error('Project: "title" is required.')
  }
  if (fields.title.length > MAX_TITLE_LENGTH) {
    throw new Error(`Project: "title" exceeds ${MAX_TITLE_LENGTH} characters.`)
  }
  if (fields.description && fields.description.length > MAX_TEXT_LENGTH) {
    throw new Error(`Project: "description" exceeds ${MAX_TEXT_LENGTH} characters.`)
  }
  if (fields.goal && fields.goal.length > MAX_TEXT_LENGTH) {
    throw new Error(`Project: "goal" exceeds ${MAX_TEXT_LENGTH} characters.`)
  }
  if (fields.startDate && Number.isNaN(Date.parse(fields.startDate))) {
    throw new Error('Project: "startDate" must be a valid date.')
  }
  if (fields.completionDate && Number.isNaN(Date.parse(fields.completionDate))) {
    throw new Error('Project: "completionDate" must be a valid date.')
  }
}
