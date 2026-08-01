// Run: npx tsx --test components/school-concept/CapabilityEntry.test.tsx
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { renderToStaticMarkup } from 'react-dom/server'
import { CapabilityEntry } from './CapabilityEntry'

test('disabled capability renders nothing', () => {
  const html = renderToStaticMarkup(<CapabilityEntry capability={{ state: 'disabled', id: 'parentPortal' }} />)
  assert.equal(html, '')
})

test('enabled capability renders a single entry link with the resolved label and destination', () => {
  const html = renderToStaticMarkup(
    <CapabilityEntry capability={{ state: 'enabled', id: 'parentPortal', label: 'Parent Portal', destination: '/dashboard' }} />
  )
  assert.match(html, /href="\/dashboard"/)
  assert.match(html, />Parent Portal</)
})

test('enabled capability with a school-specific label renders that label, not a hardcoded one', () => {
  const html = renderToStaticMarkup(
    <CapabilityEntry capability={{ state: 'enabled', id: 'parentPortal', label: 'Family Portal', destination: '/dashboard' }} />
  )
  assert.match(html, />Family Portal</)
})
