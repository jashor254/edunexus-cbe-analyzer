// Run: npx tsx --test "app/school-concepts/[schoolSlug]/homepageStructure.test.tsx"
//
// Renders the real Kutus homepage sections, in the same order page.tsx
// composes them, and checks structural properties the Phase 5 institutional
// redesign is required to preserve: one H1, no skipped heading levels, and
// no accidental portal/capability claim on a page for a school with none
// enabled.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { renderToStaticMarkup } from 'react-dom/server'
import { getSchoolConcept } from '@/data/schoolConcepts'
import { Hero } from '@/components/school-concept/Hero'
import { EducationJourneyCards } from '@/components/school-concept/EducationJourneyCards'
import { NewsPreview } from '@/components/school-concept/NewsPreview'
import { ParentInfoSection } from '@/components/school-concept/ParentInfoSection'
import { WebsiteFunctionsSection } from '@/components/school-concept/WebsiteFunctionsSection'
import { BeyondWebsiteSection } from '@/components/school-concept/BeyondWebsiteSection'

const config = getSchoolConcept('kutus-municipality')!

function renderHomepage(): string {
  return [
    renderToStaticMarkup(<Hero config={config} />),
    renderToStaticMarkup(<EducationJourneyCards config={config} />),
    renderToStaticMarkup(<NewsPreview config={config} />),
    renderToStaticMarkup(<ParentInfoSection config={config} />),
    renderToStaticMarkup(<WebsiteFunctionsSection config={config} />),
    renderToStaticMarkup(<BeyondWebsiteSection />),
  ].join('\n')
}

test('the real Kutus config exists', () => {
  assert.ok(config)
})

test('the homepage has exactly one H1', () => {
  const html = renderHomepage()
  const h1Count = (html.match(/<h1[ >]/g) ?? []).length
  assert.equal(h1Count, 1)
})

test('heading levels never skip from H1 straight to H3+ without an H2 in between', () => {
  const html = renderHomepage()
  const levels = [...html.matchAll(/<h([1-6])[ >]/g)].map((m) => Number(m[1]))
  for (let i = 1; i < levels.length; i++) {
    assert.ok(levels[i] <= levels[i - 1] + 1, `heading jumped from H${levels[i - 1]} to H${levels[i]}`)
  }
})

test('no homepage section renders a portal, sign-in, or capability claim for Kutus', () => {
  const html = renderHomepage()
  assert.doesNotMatch(html, /portal/i)
  assert.doesNotMatch(html, /sign in/i)
})
