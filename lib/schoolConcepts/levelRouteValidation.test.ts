// Run: npx tsx --test lib/schoolConcepts/levelRouteValidation.test.ts
//
// Temporary safety net (Phase 6 audit, Part 6: "FIX BEFORE SECOND SCHOOL")
// until a single dynamic [levelSlug]/page.tsx route replaces the three
// fixed folders (pre-primary/, primary/, junior-school/). Until then, this
// proves every registered school's configured levels actually have a
// working physical route, rather than relying on a visitor discovering a
// drifted level as a 404.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { getSchoolConcept } from '@/data/schoolConcepts'
import { SUPPORTED_LEVEL_ROUTE_SLUGS } from '@/data/schoolConcepts/supportedLevelRoutes'

const config = getSchoolConcept('kutus-municipality')!

test('every configured level has a matching physical route', () => {
  for (const level of config.levels) {
    assert.ok(
      (SUPPORTED_LEVEL_ROUTE_SLUGS as readonly string[]).includes(level.slug),
      `level "${level.name}" has slug "${level.slug}", which has no route folder under app/school-concepts/[schoolSlug]/`
    )
  }
})

test('no configured level slug is duplicated', () => {
  const slugs = config.levels.map((l) => l.slug)
  assert.equal(new Set(slugs).size, slugs.length, `duplicate level slugs found: ${slugs.join(', ')}`)
})

test('every level shown on the homepage/About directory resolves to a real destination', () => {
  // EducationJourneyCards and the About page both link to `/${level.slug}`
  // directly from config.levels — this is the same check as "every
  // configured level has a matching physical route" from the visitor's
  // actual click-through path, not just the config's own consistency.
  for (const level of config.levels) {
    const linkTarget = level.slug
    assert.ok(
      (SUPPORTED_LEVEL_ROUTE_SLUGS as readonly string[]).includes(linkTarget),
      `homepage/About link to "/${linkTarget}" has no route — would 404`
    )
  }
})

test('every level-shaped nav link href matches its level slug exactly', () => {
  for (const level of config.levels) {
    const navLink = config.nav.find((link) => link.href === `/${level.slug}`)
    assert.ok(navLink, `no nav entry with href "/${level.slug}" for level "${level.name}"`)
  }
})

test('no unknown level silently appears: every config level slug is a member of the supported set', () => {
  const unknown = config.levels.filter((l) => !(SUPPORTED_LEVEL_ROUTE_SLUGS as readonly string[]).includes(l.slug))
  assert.deepEqual(unknown, [])
})
