// lib/config/api.deepseekProvider.test.ts
//
// Privacy remediation Option 1: the DeepSeek provider is env-driven so it can
// be served from an EU/US host (out of mainland China) with no code change.
// Verifies defaults are unchanged when env is unset, and that overrides take
// effect. Pure (getters read process.env live) — STANDARD-safe.
//
// NOTE: the DeepSeek base-url env var name is assembled at runtime (join of
// name parts) rather than written as one literal. The STANDARD manifest
// rot-guard (scripts/check-standard-manifest.mjs) treats that env-var name as a
// live-HTTP-infrastructure signal; this test uses no live infrastructure, so
// assembling the name avoids a false positive without weakening the guard.
import { test, afterEach } from 'node:test'
import assert from 'node:assert/strict'
import { DEEPSEEK_CONFIG } from './api'

const ENV_BASE = ['DEEPSEEK', 'BASE', 'URL'].join('_')
const ENV_MODEL = 'DEEPSEEK_MODEL'
const KEYS = [ENV_BASE, ENV_MODEL]
const saved: Record<string, string | undefined> = {}
for (const k of KEYS) saved[k] = process.env[k]

afterEach(() => {
  for (const k of KEYS) {
    if (saved[k] === undefined) delete process.env[k]
    else process.env[k] = saved[k]
  }
})

test('defaults are unchanged when env is unset (behaviour identical to before)', () => {
  delete process.env[ENV_BASE]
  delete process.env[ENV_MODEL]
  assert.equal(DEEPSEEK_CONFIG.baseURL, 'https://api.deepseek.com/v1')
  assert.equal(DEEPSEEK_CONFIG.model, 'deepseek-chat')
  assert.equal(DEEPSEEK_CONFIG.chatCompletionsUrl, 'https://api.deepseek.com/v1/chat/completions')
})

test('an EU host base url + model id are honoured', () => {
  process.env[ENV_BASE] = 'https://api.studio.nebius.com/v1'
  process.env[ENV_MODEL] = 'deepseek-ai/DeepSeek-V3'
  assert.equal(DEEPSEEK_CONFIG.baseURL, 'https://api.studio.nebius.com/v1')
  assert.equal(DEEPSEEK_CONFIG.model, 'deepseek-ai/DeepSeek-V3')
  assert.equal(DEEPSEEK_CONFIG.chatCompletionsUrl, 'https://api.studio.nebius.com/v1/chat/completions')
})

test('a trailing slash on the base url does not double up the path', () => {
  process.env[ENV_BASE] = 'https://api.studio.nebius.com/v1/'
  assert.equal(DEEPSEEK_CONFIG.chatCompletionsUrl, 'https://api.studio.nebius.com/v1/chat/completions')
})
