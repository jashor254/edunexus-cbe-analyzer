import type { CountyConfig } from './types'
import { DEFAULT_SEARCH_TERMS } from './defaults'

export const nyeriConfig: CountyConfig = {
  county: 'Nyeri',
  slug: 'nyeri',
  towns: ['Nyeri', 'Karatina', 'Othaya', "Mukurwe-ini", 'Naro Moru', 'Mweiga', 'Kiganjo'],
  searchTerms: DEFAULT_SEARCH_TERMS,
}
