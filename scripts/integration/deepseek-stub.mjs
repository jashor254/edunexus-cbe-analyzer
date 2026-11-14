// scripts/integration/deepseek-stub.mjs
//
// TEST-ONLY preload for the isolated integration server. Loaded through
// NODE_OPTIONS=--import into the Next server that the teacher-workflow
// integration job starts; nothing in the application imports it.
//
//  - Answers the DeepSeek chat endpoint with one deterministic synthetic
//    lesson (scripts/integration/synthetic-lesson.json). No paid request is
//    ever made. The request must carry the fake key below, so a real key
//    wired in by mistake is rejected instead of silently used.
//  - Fails closed on every other non-local destination: a blocked attempt is
//    logged to STUB_LOG and the integration runner fails the job on it.
//
// This is an application-level guard, not network isolation.
import fs from 'node:fs'
import path from 'node:path'
import http from 'node:http'
import https from 'node:https'
import { fileURLToPath } from 'node:url'

const here = path.dirname(fileURLToPath(import.meta.url))

const LOG = process.env.STUB_LOG
const FAKE_KEY = 'stub-not-a-real-key'
const LOCAL = new Set(['127.0.0.1', 'localhost', '::1'])
const ALLOWED_PORTS = new Set((process.env.STUB_ALLOWED_PORTS || '').split(',').filter(Boolean))
const LESSON = fs.readFileSync(path.join(here, 'synthetic-lesson.json'), 'utf8')

const log = (event) => {
  if (!LOG) return
  try { fs.appendFileSync(LOG, JSON.stringify({ t: Date.now(), ...event }) + '\n') } catch { /* logging must never break the server */ }
}

const isAllowed = (url) => LOCAL.has(url.hostname) && (url.port === '' || ALLOWED_PORTS.has(url.port))

const realFetch = globalThis.fetch
globalThis.fetch = async function stubbedFetch(input, init) {
  const url = new URL(typeof input === 'string' ? input : input.url ?? String(input))

  if (url.hostname === 'api.deepseek.com' && url.pathname === '/v1/chat/completions') {
    const auth = new Headers(init?.headers || {}).get('authorization')
    const authOk = auth === `Bearer ${FAKE_KEY}`
    log({ ev: 'deepseek_stub', authOk })
    if (!authOk) return new Response('{"error":"unexpected key"}', { status: 401 })
    return Response.json({
      model: 'stub-deepseek-synthetic',
      choices: [{ message: { content: LESSON } }],
      usage: {
        prompt_tokens: 1000, completion_tokens: 400, total_tokens: 1400,
        prompt_cache_hit_tokens: 600, prompt_cache_miss_tokens: 400,
        completion_tokens_details: { reasoning_tokens: 0 },
      },
    })
  }

  if (isAllowed(url)) return realFetch(input, init)
  log({ ev: 'egress_blocked', via: 'fetch', host: url.hostname })
  throw new Error(`EGRESS BLOCKED (integration harness): ${url.hostname}`)
}

for (const [name, mod] of [['http', http], ['https', https]]) {
  const original = mod.request
  const guard = (args) => {
    const first = args[0]
    const host = typeof first === 'string'
      ? new URL(first).hostname
      : (first && (first.hostname || first.host || '').split(':')[0]) || ''
    if (!LOCAL.has(host)) {
      log({ ev: 'egress_blocked', via: name, host })
      throw new Error(`EGRESS BLOCKED (integration harness): ${host}`)
    }
  }
  mod.request = function (...args) { guard(args); return original.apply(this, args) }
  mod.get = function (...args) { guard(args); const req = original.apply(this, args); req.end(); return req }
}

log({ ev: 'stub_loaded', pid: process.pid })
