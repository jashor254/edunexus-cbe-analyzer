// lib/i18n/config.ts
// Supported locales, default locale, and locale metadata.

export type SupportedLocale = 'en-KE' | 'sw-KE' | 'en-UG' | 'en-TZ' | 'en-NG' | 'fr-TG'

export const SUPPORTED_LOCALES: SupportedLocale[] = [
  'en-KE',  // English (Kenya) — default
  'sw-KE',  // Swahili (Kenya)
  'en-UG',  // English (Uganda)
  'en-TZ',  // English (Tanzania)
  'en-NG',  // English (Nigeria)
  'fr-TG',  // French (Togo)
]

export const DEFAULT_LOCALE: SupportedLocale = 'en-KE'

export type LocaleMeta = {
  locale:    SupportedLocale
  label:     string           // native language name
  direction: 'ltr' | 'rtl'
  timezone:  string
  currency:  string
  country:   string
}

export const LOCALE_META: Record<SupportedLocale, LocaleMeta> = {
  'en-KE': { locale: 'en-KE', label: 'English (Kenya)',   direction: 'ltr', timezone: 'Africa/Nairobi',  currency: 'KES', country: 'KE' },
  'sw-KE': { locale: 'sw-KE', label: 'Kiswahili (Kenya)', direction: 'ltr', timezone: 'Africa/Nairobi',  currency: 'KES', country: 'KE' },
  'en-UG': { locale: 'en-UG', label: 'English (Uganda)',  direction: 'ltr', timezone: 'Africa/Kampala',  currency: 'UGX', country: 'UG' },
  'en-TZ': { locale: 'en-TZ', label: 'English (Tanzania)',direction: 'ltr', timezone: 'Africa/Dar_es_Salaam', currency: 'TZS', country: 'TZ' },
  'en-NG': { locale: 'en-NG', label: 'English (Nigeria)', direction: 'ltr', timezone: 'Africa/Lagos',    currency: 'NGN', country: 'NG' },
  'fr-TG': { locale: 'fr-TG', label: 'Français (Togo)',   direction: 'ltr', timezone: 'Africa/Lome',     currency: 'XOF', country: 'TG' },
}

export function isLocale(value: string): value is SupportedLocale {
  return (SUPPORTED_LOCALES as string[]).includes(value)
}
