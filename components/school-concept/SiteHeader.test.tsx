// Run: npx tsx --test components/school-concept/SiteHeader.test.tsx
//
// Proves the Phase 4B capability-integration contract on SiteHeader survives
// the Phase 5 visual redesign: the portal prop still renders through
// PortalEntry when capabilities are resolved, still renders nothing when
// they aren't, and the mobile menu toggle button is still present with the
// accessibility attributes the interactive behavior depends on. (Full
// click-driven interaction isn't exercised here — this repo's test
// convention is static-render assertions via renderToStaticMarkup, not a
// browser/jsdom testing library; see the Playwright-based manual browser
// verification in the final report for the actual toggle behavior.)
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { renderToStaticMarkup } from 'react-dom/server'
import { SiteHeader } from './SiteHeader'
import { getSchoolConcept } from '@/data/schoolConcepts'

const config = getSchoolConcept('kutus-municipality')!

test('SiteHeader with no portal capabilities renders no portal entry', () => {
  const html = renderToStaticMarkup(<SiteHeader config={config} />)
  assert.doesNotMatch(html, /portal/i)
})

test('SiteHeader with a resolved capability renders the capability entry link', () => {
  const html = renderToStaticMarkup(
    <SiteHeader
      config={config}
      portalCapabilities={[{ state: 'enabled', id: 'parentPortal', label: 'Parent Portal', destination: '/dashboard' }]}
    />
  )
  assert.match(html, /href="\/dashboard"/)
  assert.match(html, />Parent Portal</)
})

test('the mobile menu toggle button is present with accessible open/close state', () => {
  const html = renderToStaticMarkup(<SiteHeader config={config} />)
  assert.match(html, /aria-label="Open menu"/)
  assert.match(html, /aria-expanded="false"/)
})

test('the school name renders exactly once in the header, in full (no truncation class)', () => {
  const html = renderToStaticMarkup(<SiteHeader config={config} />)
  assert.doesNotMatch(html, /class="[^"]*\btruncate\b/)
  assert.match(html, new RegExp(config.schoolName))
})
