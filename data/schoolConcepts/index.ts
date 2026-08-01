import type { SchoolConceptConfig } from './types'
import { kutusMunicipality } from './kutus-municipality'

const registry: Record<string, SchoolConceptConfig> = {
  [kutusMunicipality.slug]: kutusMunicipality,
}

export function getSchoolConcept(slug: string): SchoolConceptConfig | undefined {
  return registry[slug]
}

export type { SchoolConceptConfig } from './types'
