// lib/config/countries.ts
// Country configuration registry for global readiness.
// Each entry defines everything needed to operate EduNexus in that country:
// locale, timezone, currency, curriculum system, grading scale, and API extensions.

import type { SupportedLocale } from '@/lib/i18n/config'

export type CurrencyCode = 'KES' | 'UGX' | 'TZS' | 'NGN' | 'GHS' | 'ZAR' | 'XOF' | 'USD'

export type CurriculumSystem =
  | 'CBC'       // Kenya Competency Based Curriculum (Grade 1-12)
  | 'KICD_844'  // Kenya 8-4-4
  | 'NCDC'      // Uganda National Curriculum Development Centre
  | 'NECTA'     // Tanzania National Examinations Council
  | 'NERDC'     // Nigeria Educational Research and Development Council
  | 'GES'       // Ghana Education Service
  | 'CAPS'      // South Africa Curriculum and Assessment Policy Statement
  | 'BFEM'      // West Africa BFEM (Togo/Senegal)
  | 'IGCSE'     // Cambridge IGCSE (used in international schools across Africa)

export type GradingScale = {
  system:    'cbc_4level' | 'percentage' | 'letter' | 'custom'
  levels:    Array<{ label: string; min: number; max: number; meaning: string }>
}

export type CountryConfig = {
  code:            string              // ISO 3166-1 alpha-2
  name:            string
  nativeName:      string
  defaultLocale:   SupportedLocale
  locales:         SupportedLocale[]
  timezone:        string
  currency:        CurrencyCode
  currencySymbol:  string
  curriculumSystems: CurriculumSystem[]
  defaultCurriculum: CurriculumSystem
  gradingScale:    GradingScale
  schoolTerms:     number              // terms per academic year
  termStart:       string[]            // ISO month-day strings, one per term
  phonePrefix:     string              // E.164 prefix
  ministryName:    string              // national education ministry name
  examBodies:      string[]            // national examination bodies
  enabled:         boolean             // whether country is live on the platform
}

const CBC_4_LEVEL: GradingScale = {
  system: 'cbc_4level',
  levels: [
    { label: 'EE', min: 75, max: 100, meaning: 'Exceeding Expectations' },
    { label: 'ME', min: 50, max: 74,  meaning: 'Meeting Expectations' },
    { label: 'AE', min: 25, max: 49,  meaning: 'Approaching Expectations' },
    { label: 'BE', min: 0,  max: 24,  meaning: 'Below Expectations' },
  ],
}

const PERCENTAGE_SCALE: GradingScale = {
  system: 'percentage',
  levels: [
    { label: 'A', min: 75, max: 100, meaning: 'Distinction' },
    { label: 'B', min: 60, max: 74,  meaning: 'Credit' },
    { label: 'C', min: 50, max: 59,  meaning: 'Pass' },
    { label: 'D', min: 40, max: 49,  meaning: 'Near Pass' },
    { label: 'F', min: 0,  max: 39,  meaning: 'Fail' },
  ],
}

export const COUNTRIES: Record<string, CountryConfig> = {
  KE: {
    code:             'KE',
    name:             'Kenya',
    nativeName:       'Kenya',
    defaultLocale:    'en-KE',
    locales:          ['en-KE', 'sw-KE'],
    timezone:         'Africa/Nairobi',
    currency:         'KES',
    currencySymbol:   'KSh',
    curriculumSystems:['CBC', 'KICD_844', 'IGCSE'],
    defaultCurriculum:'CBC',
    gradingScale:     CBC_4_LEVEL,
    schoolTerms:      3,
    termStart:        ['01-06', '05-06', '09-06'],   // Jan, May, Sep (approx)
    phonePrefix:      '+254',
    ministryName:     'Ministry of Education',
    examBodies:       ['KNEC', 'KICD'],
    enabled:          true,
  },

  UG: {
    code:             'UG',
    name:             'Uganda',
    nativeName:       'Uganda',
    defaultLocale:    'en-UG',
    locales:          ['en-UG'],
    timezone:         'Africa/Kampala',
    currency:         'UGX',
    currencySymbol:   'USh',
    curriculumSystems:['NCDC', 'IGCSE'],
    defaultCurriculum:'NCDC',
    gradingScale:     PERCENTAGE_SCALE,
    schoolTerms:      3,
    termStart:        ['02-06', '06-06', '09-06'],
    phonePrefix:      '+256',
    ministryName:     'Ministry of Education and Sports',
    examBodies:       ['UNEB'],
    enabled:          true,
  },

  TZ: {
    code:             'TZ',
    name:             'Tanzania',
    nativeName:       'Tanzania',
    defaultLocale:    'en-TZ',
    locales:          ['en-TZ'],
    timezone:         'Africa/Dar_es_Salaam',
    currency:         'TZS',
    currencySymbol:   'TSh',
    curriculumSystems:['NECTA', 'IGCSE'],
    defaultCurriculum:'NECTA',
    gradingScale:     PERCENTAGE_SCALE,
    schoolTerms:      3,
    termStart:        ['01-06', '05-06', '09-06'],
    phonePrefix:      '+255',
    ministryName:     'Ministry of Education, Science and Technology',
    examBodies:       ['NECTA'],
    enabled:          true,
  },

  NG: {
    code:             'NG',
    name:             'Nigeria',
    nativeName:       'Nigeria',
    defaultLocale:    'en-NG',
    locales:          ['en-NG'],
    timezone:         'Africa/Lagos',
    currency:         'NGN',
    currencySymbol:   '₦',
    curriculumSystems:['NERDC', 'IGCSE'],
    defaultCurriculum:'NERDC',
    gradingScale:     PERCENTAGE_SCALE,
    schoolTerms:      3,
    termStart:        ['09-06', '01-06', '04-06'],
    phonePrefix:      '+234',
    ministryName:     'Federal Ministry of Education',
    examBodies:       ['WAEC', 'NECO', 'NABTEB'],
    enabled:          false,   // planned — not yet live
  },

  GH: {
    code:             'GH',
    name:             'Ghana',
    nativeName:       'Ghana',
    defaultLocale:    'en-KE',   // uses English catalog (closest available)
    locales:          ['en-KE'],
    timezone:         'Africa/Accra',
    currency:         'GHS',
    currencySymbol:   'GH₵',
    curriculumSystems:['GES', 'IGCSE'],
    defaultCurriculum:'GES',
    gradingScale:     PERCENTAGE_SCALE,
    schoolTerms:      3,
    termStart:        ['01-06', '05-06', '09-06'],
    phonePrefix:      '+233',
    ministryName:     'Ghana Education Service',
    examBodies:       ['WAEC', 'BECE'],
    enabled:          false,   // planned
  },
}

export function getCountry(code: string): CountryConfig | null {
  return COUNTRIES[code.toUpperCase()] ?? null
}

export function getEnabledCountries(): CountryConfig[] {
  return Object.values(COUNTRIES).filter(c => c.enabled)
}

export function getAllCountries(): CountryConfig[] {
  return Object.values(COUNTRIES)
}

export function getCountryByLocale(locale: string): CountryConfig | null {
  return Object.values(COUNTRIES).find(c => c.defaultLocale === locale || c.locales.includes(locale as SupportedLocale)) ?? null
}
