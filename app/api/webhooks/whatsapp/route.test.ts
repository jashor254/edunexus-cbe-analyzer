import { test } from 'node:test'
import assert from 'node:assert/strict'
import { createHmac } from 'node:crypto'
import { NextRequest } from 'next/server'
import { GET, POST } from './route'

const VERIFY_TOKEN = 'test-verify-token'
const APP_SECRET = 'test-app-secret'

async function withEnv<T>(env: Record<string, string | undefined>, fn: () => Promise<T>): Promise<T> {
  const original: Record<string, string | undefined> = {}
  for (const key of Object.keys(env)) {
    original[key] = process.env[key]
    if (env[key] === undefined) delete process.env[key]
    else process.env[key] = env[key]
  }
  try {
    return await fn()
  } finally {
    for (const key of Object.keys(original)) {
      if (original[key] === undefined) delete process.env[key]
      else process.env[key] = original[key]
    }
  }
}

function getReq(params: Record<string, string>): NextRequest {
  const url = new URL('https://app.example.com/api/webhooks/whatsapp')
  for (const [key, value] of Object.entries(params)) url.searchParams.set(key, value)
  return new NextRequest(url)
}

function postReq(rawBody: string, signature?: string): NextRequest {
  const headers: Record<string, string> = { 'content-type': 'application/json' }
  if (signature !== undefined) headers['x-hub-signature-256'] = signature
  return new NextRequest('https://app.example.com/api/webhooks/whatsapp', {
    method: 'POST',
    headers,
    body: rawBody,
  })
}

function sign(body: string, secret: string): string {
  return 'sha256=' + createHmac('sha256', secret).update(body).digest('hex')
}

test('GET returns 200 with the challenge when mode/token/challenge are valid', async () => {
  await withEnv({ WHATSAPP_WEBHOOK_VERIFY_TOKEN: VERIFY_TOKEN }, async () => {
    const res = await GET(getReq({ 'hub.mode': 'subscribe', 'hub.verify_token': VERIFY_TOKEN, 'hub.challenge': 'abc123' }))
    assert.equal(res.status, 200)
    assert.equal(await res.text(), 'abc123')
  })
})

test('GET returns 403 when the token does not match', async () => {
  await withEnv({ WHATSAPP_WEBHOOK_VERIFY_TOKEN: VERIFY_TOKEN }, async () => {
    const res = await GET(getReq({ 'hub.mode': 'subscribe', 'hub.verify_token': 'wrong', 'hub.challenge': 'abc123' }))
    assert.equal(res.status, 403)
  })
})

test('GET returns 403 when mode is not subscribe', async () => {
  await withEnv({ WHATSAPP_WEBHOOK_VERIFY_TOKEN: VERIFY_TOKEN }, async () => {
    const res = await GET(getReq({ 'hub.mode': 'unsubscribe', 'hub.verify_token': VERIFY_TOKEN, 'hub.challenge': 'abc123' }))
    assert.equal(res.status, 403)
  })
})

test('GET returns 403 when challenge is missing', async () => {
  await withEnv({ WHATSAPP_WEBHOOK_VERIFY_TOKEN: VERIFY_TOKEN }, async () => {
    const res = await GET(getReq({ 'hub.mode': 'subscribe', 'hub.verify_token': VERIFY_TOKEN }))
    assert.equal(res.status, 403)
  })
})

test('GET returns 403 when the verify token env var is not configured', async () => {
  await withEnv({ WHATSAPP_WEBHOOK_VERIFY_TOKEN: undefined }, async () => {
    const res = await GET(getReq({ 'hub.mode': 'subscribe', 'hub.verify_token': '', 'hub.challenge': 'abc123' }))
    assert.equal(res.status, 403)
  })
})

test('POST returns 200 for a valid signature and valid JSON', async () => {
  await withEnv({ WHATSAPP_APP_SECRET: APP_SECRET }, async () => {
    const body = JSON.stringify({ object: 'whatsapp_business_account', entry: [] })
    const res = await POST(postReq(body, sign(body, APP_SECRET)))
    assert.equal(res.status, 200)
    assert.deepEqual(await res.json(), { ok: true })
  })
})

test('POST returns 401 when the signature header is missing', async () => {
  await withEnv({ WHATSAPP_APP_SECRET: APP_SECRET }, async () => {
    const body = JSON.stringify({ object: 'whatsapp_business_account', entry: [] })
    const res = await POST(postReq(body))
    assert.equal(res.status, 401)
  })
})

test('POST returns 401 when the signature does not match', async () => {
  await withEnv({ WHATSAPP_APP_SECRET: APP_SECRET }, async () => {
    const body = JSON.stringify({ object: 'whatsapp_business_account', entry: [] })
    const res = await POST(postReq(body, sign(body, 'wrong-secret')))
    assert.equal(res.status, 401)
  })
})

test('POST returns 401 when the app secret env var is not configured', async () => {
  await withEnv({ WHATSAPP_APP_SECRET: undefined }, async () => {
    const body = JSON.stringify({ object: 'whatsapp_business_account', entry: [] })
    const res = await POST(postReq(body, sign(body, APP_SECRET)))
    assert.equal(res.status, 401)
  })
})

test('POST returns 400 for malformed JSON with a valid signature', async () => {
  await withEnv({ WHATSAPP_APP_SECRET: APP_SECRET }, async () => {
    const body = '{not valid json'
    const res = await POST(postReq(body, sign(body, APP_SECRET)))
    assert.equal(res.status, 400)
  })
})
