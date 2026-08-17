// lib/whatsapp/client.test.ts
//
// H4A / OPS-WA-001 — provider failure matrix for the real, unmodified
// WhatsApp send wrapper (lib/whatsapp/client.ts). Mocks only the transport
// (global fetch) — no real network call, no live Meta API. Before this
// file, zero tests existed for this module at all.
//
// Run: npx tsx --experimental-test-module-mocks --test lib/whatsapp/client.test.ts
import { test, before, after } from 'node:test'
import assert from 'node:assert/strict'

let sendWhatsAppTemplate: typeof import('./client').sendWhatsAppTemplate

before(async () => {
  process.env.WHATSAPP_PHONE_NUMBER_ID = 'fixture-phone-id'
  process.env.WHATSAPP_ACCESS_TOKEN = 'fixture-access-token'
  ;({ sendWhatsAppTemplate } = await import('./client'))
})

const originalFetch = globalThis.fetch
after(() => { globalThis.fetch = originalFetch })

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } })
}

const baseOpts = { to: '254712345678', templateName: 'assignment_marked' }

test('OPS-WA-001: a real 2xx success returns success with the Meta message id', async () => {
  globalThis.fetch = (async () => jsonResponse({ messages: [{ id: 'wamid.123' }] })) as typeof fetch
  const result = await sendWhatsAppTemplate(baseOpts)
  assert.deepEqual(result, { success: true, messageId: 'wamid.123' })
})

test('OPS-WA-001: a 200 response carrying a Meta error object is treated as a failure, never a false "sent" status', async () => {
  globalThis.fetch = (async () => jsonResponse({ error: { message: 'Template not approved', code: 132001 } }, 200)) as typeof fetch
  const result = await sendWhatsAppTemplate(baseOpts)
  assert.equal(result.success, false)
  assert.equal(result.error, 'Template not approved')
})

test('OPS-WA-001: a 400 (malformed request) is reported as a failure with the HTTP status surfaced', async () => {
  globalThis.fetch = (async () => jsonResponse({ error: { message: 'Invalid parameter', code: 100 } }, 400)) as typeof fetch
  const result = await sendWhatsAppTemplate(baseOpts)
  assert.equal(result.success, false)
  assert.equal(result.error, 'Invalid parameter')
})

test('OPS-WA-001: a 401 (bad access token) is reported as a failure, not a crash', async () => {
  globalThis.fetch = (async () => jsonResponse({ error: { message: 'Invalid OAuth access token', code: 190 } }, 401)) as typeof fetch
  const result = await sendWhatsAppTemplate(baseOpts)
  assert.equal(result.success, false)
})

test('OPS-WA-001: a 429 (rate limited) is reported as a failure — this wrapper does not retry on its own', async () => {
  let fetchCalls = 0
  globalThis.fetch = (async () => { fetchCalls++; return jsonResponse({ error: { message: 'Too many requests', code: 4 } }, 429) }) as typeof fetch
  const result = await sendWhatsAppTemplate(baseOpts)
  assert.equal(result.success, false)
  assert.equal(fetchCalls, 1, 'documents the real contract: no built-in retry for 429 — a caller wanting retry semantics must add its own')
})

test('OPS-WA-001: a 500 (Meta outage) with a non-JSON-parseable-as-expected body is still reported as a failure, not thrown as an uncaught exception', async () => {
  globalThis.fetch = (async () => jsonResponse({}, 500)) as typeof fetch
  const result = await sendWhatsAppTemplate(baseOpts)
  assert.equal(result.success, false)
  assert.match(result.error ?? '', /HTTP 500/)
})

test('OPS-WA-001 FINDING: a real network failure (fetch throws) is NOT caught inside sendWhatsAppTemplate — it propagates to the caller', async () => {
  globalThis.fetch = (async () => { throw new Error('fetch failed') }) as typeof fetch
  await assert.rejects(() => sendWhatsAppTemplate(baseOpts), /fetch failed/, 'pins the actual current contract: unlike the DeepSeek AI wrapper, this send function has no internal try/catch around its own transport call — every caller must handle a thrown network error itself. See the H4A closeout report.')
})

test('missing WhatsApp credentials fails closed with a clear error, no attempted network call', async () => {
  const originalId = process.env.WHATSAPP_PHONE_NUMBER_ID
  const originalToken = process.env.WHATSAPP_ACCESS_TOKEN
  delete process.env.WHATSAPP_PHONE_NUMBER_ID
  delete process.env.WHATSAPP_ACCESS_TOKEN

  let fetchCalled = false
  globalThis.fetch = (async () => { fetchCalled = true; return jsonResponse({}) }) as typeof fetch

  const result = await sendWhatsAppTemplate(baseOpts)

  process.env.WHATSAPP_PHONE_NUMBER_ID = originalId
  process.env.WHATSAPP_ACCESS_TOKEN = originalToken

  assert.equal(result.success, false)
  assert.equal(fetchCalled, false, 'must never attempt a network call with missing credentials')
})
