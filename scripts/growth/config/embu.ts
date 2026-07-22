import type { CountyConfig } from './types'
import { DEFAULT_SEARCH_TERMS } from './defaults'

export const embuConfig: CountyConfig = {
  county: 'Embu',
  slug: 'embu',
  towns: ['Embu', 'Runyenjes', 'Siakago', 'Manyatta', 'Kiritiri', 'Ishiara', 'Kyeni'],
  searchTerms: DEFAULT_SEARCH_TERMS,
}
