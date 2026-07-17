// lib/learnerPortfolio/validation.ts
//
// Field-level validation only — the automated level this domain can
// honestly reach (title required, sensible length limits, category must
// be a canonical value). Whether a submission is genuinely good work is a
// teacher editorial judgment (Phase 10 verification), never something
// this module scores or gates.

import { PORTFOLIO_CATEGORIES, type PortfolioCategory, type PortfolioItemFields } from './types'

const MAX_TITLE_LENGTH = 200
const MAX_TEXT_LENGTH = 4000

export function validateItemFields(fields: PortfolioItemFields): void {
  if (!PORTFOLIO_CATEGORIES.includes(fields.category)) {
    throw new Error(`Portfolio: "${fields.category}" is not a canonical Portfolio category.`)
  }
  if (!fields.title || !fields.title.trim()) {
    throw new Error('Portfolio: "title" is required.')
  }
  if (fields.title.length > MAX_TITLE_LENGTH) {
    throw new Error(`Portfolio: "title" exceeds ${MAX_TITLE_LENGTH} characters.`)
  }
  if (fields.description && fields.description.length > MAX_TEXT_LENGTH) {
    throw new Error(`Portfolio: "description" exceeds ${MAX_TEXT_LENGTH} characters.`)
  }
  if (fields.reflection && fields.reflection.length > MAX_TEXT_LENGTH) {
    throw new Error(`Portfolio: "reflection" exceeds ${MAX_TEXT_LENGTH} characters.`)
  }
}

export function assertCanonicalCategory(category: string): asserts category is PortfolioCategory {
  if (!PORTFOLIO_CATEGORIES.includes(category as PortfolioCategory)) {
    throw new Error(`Portfolio: "${category}" is not a canonical Portfolio category.`)
  }
}
