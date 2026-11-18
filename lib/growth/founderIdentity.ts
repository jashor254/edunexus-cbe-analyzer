/**
 * Pure comparison behind requirePlatformAdmin() (lib/growth/auth.ts), kept in its
 * own module so it is unit-testable without constructing the repositories.
 * Both sides are trimmed and lower-cased; an empty or missing value on either
 * side never matches (fail closed: with GROWTH_FOUNDER_EMAIL unset, nobody is
 * a platform admin).
 */
export function isFounderIdentity(callerEmail: string | null | undefined, founderEmail: string | null | undefined): boolean {
  const caller = callerEmail?.trim().toLowerCase()
  const founder = founderEmail?.trim().toLowerCase()
  return !!caller && !!founder && caller === founder
}
