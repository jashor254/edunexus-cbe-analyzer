// Run: npx tsx --test components/school-concept/PortalEntry.test.tsx
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { renderToStaticMarkup } from 'react-dom/server'
import { PortalEntry } from './PortalEntry'

test('zero resolved capabilities renders nothing', () => {
  const html = renderToStaticMarkup(<PortalEntry capabilities={[]} />)
  assert.equal(html, '')
})

test('one resolved capability renders one entry link', () => {
  const html = renderToStaticMarkup(
    <PortalEntry capabilities={[{ state: 'enabled', id: 'parentPortal', label: 'Parent Portal', destination: '/dashboard' }]} />
  )
  assert.match(html, /href="\/dashboard"/)
  assert.match(html, />Parent Portal</)
  // Exactly one entry link, not a launcher — this counts anchor tags.
  assert.equal((html.match(/<a /g) ?? []).length, 1)
})

test('multiple resolved capabilities render one link per capability, no generic launcher wrapper', () => {
  const html = renderToStaticMarkup(
    <PortalEntry
      capabilities={[
        { state: 'enabled', id: 'parentPortal', label: 'Parent Portal', destination: '/dashboard' },
        // Second entry uses the same registered id only because parentPortal
        // is the only capability that exists yet — this proves the
        // component handles length > 1 generically, not that a second real
        // capability has been registered.
        { state: 'enabled', id: 'parentPortal', label: 'Second Entry', destination: '/dashboard' },
      ]}
    />
  )
  assert.equal((html.match(/<a /g) ?? []).length, 2)
  assert.match(html, />Parent Portal</)
  assert.match(html, />Second Entry</)
})

test('PortalEntry source contains no hardcoded capability id — it consumes only the generic contract', () => {
  const source = readFileSync(join(dirname(fileURLToPath(import.meta.url)), 'PortalEntry.tsx'), 'utf8')
  assert.doesNotMatch(source, /parentPortal/, 'PortalEntry must not reference any specific capability id by name')
})
