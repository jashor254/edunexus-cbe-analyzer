import type { CountyConfig } from './types'
import { kirinyagaConfig } from './kirinyaga'
import { embuConfig } from './embu'
import { nyeriConfig } from './nyeri'
import { murangaConfig } from './muranga'
import { nairobiConfig } from './nairobi'

export type { CountyConfig } from './types'

/** Sprint PE-4 — the whole registry. Expanding to a new county is "add a file + one line here," never a discover-schools.ts edit. */
export const COUNTY_CONFIGS: CountyConfig[] = [kirinyagaConfig, embuConfig, nyeriConfig, murangaConfig, nairobiConfig]

export function findCountyConfig(slug: string): CountyConfig | undefined {
  const normalized = slug.trim().toLowerCase()
  return COUNTY_CONFIGS.find((c) => c.slug === normalized)
}

export function availableSlugs(): string[] {
  return COUNTY_CONFIGS.map((c) => c.slug)
}
