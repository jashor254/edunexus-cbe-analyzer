// lib/i18n/formats.ts
// Centralized locale + timezone aware formatting.
// Default to Kenya (en-KE / Africa/Nairobi / KES) — overridable per org.

export type OrgLocaleContext = {
  locale:   string    // e.g. 'en-KE', 'sw-KE'
  timezone: string    // e.g. 'Africa/Nairobi'
  currency: string    // e.g. 'KES'
}

const KENYA: OrgLocaleContext = {
  locale:   'en-KE',
  timezone: 'Africa/Nairobi',
  currency: 'KES',
}

export function formatDate(
  date: string | Date,
  ctx: Partial<OrgLocaleContext> = {},
  options: Intl.DateTimeFormatOptions = { day: 'numeric', month: 'short', year: 'numeric' }
): string {
  const d       = typeof date === 'string' ? new Date(date) : date
  const locale   = ctx.locale   ?? KENYA.locale
  const timeZone = ctx.timezone ?? KENYA.timezone
  return d.toLocaleDateString(locale, { ...options, timeZone })
}

export function formatDateTime(
  date: string | Date,
  ctx: Partial<OrgLocaleContext> = {}
): string {
  const d = typeof date === 'string' ? new Date(date) : date
  return d.toLocaleString(ctx.locale ?? KENYA.locale, {
    timeZone:     ctx.timezone ?? KENYA.timezone,
    day:          'numeric',
    month:        'short',
    year:         'numeric',
    hour:         '2-digit',
    minute:       '2-digit',
    hour12:       false,
  })
}

export function formatCurrency(
  amountCents: number,
  ctx: Partial<OrgLocaleContext> = {}
): string {
  const currency = ctx.currency ?? KENYA.currency
  const locale   = ctx.locale   ?? KENYA.locale
  return new Intl.NumberFormat(locale, {
    style:                 'currency',
    currency,
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(amountCents)
}

export function formatRelative(date: string | Date): string {
  const d    = typeof date === 'string' ? new Date(date) : date
  const diff = Date.now() - d.getTime()
  const mins  = Math.floor(diff / 60_000)
  const hours = Math.floor(diff / 3_600_000)
  const days  = Math.floor(diff / 86_400_000)

  if (mins < 1)   return 'just now'
  if (mins < 60)  return `${mins}m ago`
  if (hours < 24) return `${hours}h ago`
  if (days < 7)   return `${days}d ago`
  return formatDate(d)
}

export function formatNumber(
  n: number,
  ctx: Partial<OrgLocaleContext> = {}
): string {
  return new Intl.NumberFormat(ctx.locale ?? KENYA.locale).format(n)
}

export function startOfDayUTC(date = new Date()): Date {
  const d = new Date(date)
  d.setUTCHours(0, 0, 0, 0)
  return d
}

export function startOfMonthUTC(date = new Date()): Date {
  const d = new Date(date)
  d.setUTCDate(1)
  d.setUTCHours(0, 0, 0, 0)
  return d
}

export function addMonths(date: Date, months: number): Date {
  const d = new Date(date)
  d.setMonth(d.getMonth() + months)
  return d
}

export { KENYA as DEFAULT_LOCALE_CONTEXT }
