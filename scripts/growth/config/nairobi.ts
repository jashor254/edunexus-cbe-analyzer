import type { CountyConfig } from './types'
import { DEFAULT_SEARCH_TERMS } from './defaults'

/**
 * Nairobi is a special case (PE-4 assumption of "towns" doesn't hold for a
 * city) — areas/estates stand in for towns, and international-curriculum
 * schools are excluded on the founder's explicit call: Nairobi outreach
 * starts local-curriculum only, international schools wait until EduNexus
 * has more traction.
 */
export const nairobiConfig: CountyConfig = {
  county: 'Nairobi',
  slug: 'nairobi',
  towns: [
    'Westlands',
    'Kilimani',
    'Karen',
    'Lavington',
    'Kileleshwa',
    'Langata',
    'Embakasi',
    'Kasarani',
    'Dagoretti',
  ],
  searchTerms: DEFAULT_SEARCH_TERMS,
  exclusions: [
    'international',
    'british school',
    'american school',
    'igcse',
    'french school',
    'german school',
    'swedish school',
    'japanese school',
    'chinese school',
  ],
}
