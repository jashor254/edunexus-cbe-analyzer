import type { Confidence, SourceType } from './types'

/**
 * Sprint PE-5v2 — confidence rules, applied uniformly across every field
 * type. Deliberately simple and explainable (a founder can restate the
 * rule from memory), not a scored/weighted model:
 *
 *   Verified — found on the school's own site/Facebook AND matches a value
 *               already on file from a different source (cross-confirmed)
 *   High     — found on a dedicated contact page (/contact, /contact-us)
 *   Medium   — found on the homepage or an /about page
 *   Low      — found only via the school's public Facebook page
 *   Unknown  — nothing found (never assigned to an actual value)
 */
export function computeFieldConfidence(sourceType: SourceType, crossConfirmed: boolean): Confidence {
  if (crossConfirmed) return 'Verified'
  if (sourceType === 'contact_page') return 'High'
  if (sourceType === 'official_website') return 'Medium'
  if (sourceType === 'facebook') return 'Low'
  return 'Unknown'
}

const CONFIDENCE_RANK: Record<Confidence, number> = { Verified: 0, High: 1, Medium: 2, Low: 3, Unknown: 4 }

/** The single `contact_confidence` column is the best (lowest-rank) confidence among whichever fields were actually found this run. */
export function bestConfidence(confidences: Confidence[]): Confidence {
  const found = confidences.filter((c) => c !== 'Unknown')
  if (found.length === 0) return 'Unknown'
  return found.reduce((best, c) => (CONFIDENCE_RANK[c] < CONFIDENCE_RANK[best] ? c : best))
}
