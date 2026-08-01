// The one canonical list of education-level slugs that currently have a
// physical route folder under app/school-concepts/[schoolSlug]/. Each of
// the three page.tsx files (pre-primary/, primary/, junior-school/)
// references this constant instead of re-typing its own literal, so there
// is exactly one place to check a level slug against.
//
// This is a temporary safety net, not the real fix: a school whose levels
// don't match these three exact slugs will still 404 on the level page even
// though it appears correctly in the homepage directory and About page
// (both of which iterate config.levels directly, with no route dependency).
// The real fix — a single dynamic [levelSlug]/page.tsx route that looks up
// the level from config at request time — is deferred until the second
// school actually needs a different level shape (see the Phase 6 audit,
// Part 6: "FIX BEFORE SECOND SCHOOL"). Until then,
// lib/schoolConcepts/levelRouteValidation.test.ts checks every registered
// school's configured levels against this list so drift fails a test
// instead of failing silently as a 404 a visitor finds first.
export const PRE_PRIMARY_ROUTE_SLUG = 'pre-primary'
export const PRIMARY_ROUTE_SLUG = 'primary'
export const JUNIOR_SCHOOL_ROUTE_SLUG = 'junior-school'

export const SUPPORTED_LEVEL_ROUTE_SLUGS = [
  PRE_PRIMARY_ROUTE_SLUG,
  PRIMARY_ROUTE_SLUG,
  JUNIOR_SCHOOL_ROUTE_SLUG,
] as const

export type SupportedLevelRouteSlug = (typeof SUPPORTED_LEVEL_ROUTE_SLUGS)[number]
