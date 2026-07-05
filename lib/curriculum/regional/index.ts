// lib/curriculum/regional/index.ts
// Public API for the regional curriculum adapter registry.

export type { CurriculumAdapter, GradeRange, GradingDescriptor, TermCalendar, SubjectMap, AssessmentConfig } from './types'
export { KE_CBC }  from './ke-cbc'
export { UG_NCDC } from './ug-ncdc'
export { TZ_NECTA } from './tz-necta'

import { KE_CBC }  from './ke-cbc'
import { UG_NCDC } from './ug-ncdc'
import { TZ_NECTA } from './tz-necta'
import type { CurriculumAdapter } from './types'

// Registry: country+curriculum → adapter
const REGISTRY = new Map<string, CurriculumAdapter>([
  ['KE:CBC',   KE_CBC],
  ['UG:NCDC',  UG_NCDC],
  ['TZ:NECTA', TZ_NECTA],
])

// Default adapter per country
const COUNTRY_DEFAULTS: Record<string, CurriculumAdapter> = {
  KE: KE_CBC,
  UG: UG_NCDC,
  TZ: TZ_NECTA,
}

/**
 * Resolve an adapter by country + curriculum.
 * Falls back to the country default, then to KE_CBC (the canonical baseline).
 */
export function getAdapter(countryCode: string, curriculumId?: string): CurriculumAdapter {
  if (curriculumId) {
    const specific = REGISTRY.get(`${countryCode.toUpperCase()}:${curriculumId.toUpperCase()}`)
    if (specific) return specific
  }
  return COUNTRY_DEFAULTS[countryCode.toUpperCase()] ?? KE_CBC
}

/**
 * List all registered adapters.
 */
export function listAdapters(): CurriculumAdapter[] {
  return Array.from(REGISTRY.values())
}
