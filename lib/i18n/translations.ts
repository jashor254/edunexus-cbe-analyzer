// lib/i18n/translations.ts
// Lightweight translation function. No external i18n library dependency.
// Pattern: import { t } from '@/lib/i18n/translations'
//          t('common.save', locale)

import type { SupportedLocale } from './config'
import { DEFAULT_LOCALE } from './config'
import en, { type Messages } from './locales/en'
import sw from './locales/sw'

const CATALOGS: Record<SupportedLocale, Messages> = {
  'en-KE': en,
  'sw-KE': sw,
  'en-UG': en,   // Uganda uses English catalog
  'en-TZ': en,   // Tanzania uses English catalog
  'en-NG': en,   // Nigeria uses English catalog
  'fr-TG': en,   // French Togo falls back to English until fr catalog is added
}

/**
 * Dot-notation path lookup into a nested object.
 * t('common.save', 'sw-KE') → 'Hifadhi'
 * t('org.roles.owner', 'en-KE') → 'Owner'
 */
export function t(
  key: string,
  locale: SupportedLocale | string = DEFAULT_LOCALE,
  variables?: Record<string, string>
): string {
  const catalog = (CATALOGS[locale as SupportedLocale] ?? en) as Record<string, unknown>
  const parts   = key.split('.')

  let current: unknown = catalog
  for (const part of parts) {
    if (current == null || typeof current !== 'object') {
      current = null
      break
    }
    current = (current as Record<string, unknown>)[part]
  }

  // Fall back to English if key missing in locale catalog
  if (typeof current !== 'string') {
    let fallback: unknown = en as Record<string, unknown>
    for (const part of parts) {
      if (fallback == null || typeof fallback !== 'object') { fallback = null; break }
      fallback = (fallback as Record<string, unknown>)[part]
    }
    current = typeof fallback === 'string' ? fallback : key
  }

  let result = current as string

  // Replace {{variable}} placeholders
  if (variables) {
    for (const [k, v] of Object.entries(variables)) {
      result = result.replace(new RegExp(`\\{\\{${k}\\}\\}`, 'g'), v)
    }
  }

  return result
}

/**
 * Create a scoped translator bound to a namespace prefix.
 * const tc = scoped('common', 'sw-KE')
 * tc('save') → 'Hifadhi'
 */
export function scoped(
  namespace: string,
  locale: SupportedLocale | string = DEFAULT_LOCALE
): (key: string, variables?: Record<string, string>) => string {
  return (key, variables) => t(`${namespace}.${key}`, locale, variables)
}

/**
 * Get the full message catalog for a locale.
 * Useful for server-rendering a full page without calling t() repeatedly.
 */
export function getCatalog(locale: SupportedLocale | string): Messages {
  return CATALOGS[locale as SupportedLocale] ?? en
}

export type { Messages }
export { en as defaultMessages }
