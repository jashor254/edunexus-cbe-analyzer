// lib/repositories/analytics.aiCallLog.privacy.test.ts
//
// Stage B1 privacy regression: the ai_call_logs insert row must NOT carry raw
// learner content (prompt/response) by default. Only when the explicit
// AI_LOG_CONTENT=true debug flag is set may content be stored. Operational
// metadata (feature, model, latency, tokens, success, user_id) is always kept
// so the rate-limiter and cost monitoring still work.
//
// Tests the pure buildAICallLogRow() so no DB client is constructed — this stays
// a STANDARD-safe test (no privileged-infrastructure signals). See
// lib/ai/logPolicy.ts and docs/audits/learner-data-privacy-remediation-plan.md.
import { test, afterEach } from 'node:test'
import assert from 'node:assert/strict'
import type { AICallLog } from '@/lib/ai/logger'
import { buildAICallLogRow } from './analytics.repository'

const SENSITIVE_LOG: AICallLog = {
  feature:   'insha',
  model:     'deepseek-chat',
  prompt:    'INSHA YA MWANAFUNZI: Jina langu ni Amina na ninaishi na mama yangu...',
  response:  '{"dimensions":{"utangulizi":{"score":3}}}',
  latencyMs: 1234,
  tokenCount: 567,
  success:   true,
  userId:    '00000000-0000-0000-0000-000000000001',
}

const ORIGINAL_FLAG = process.env.AI_LOG_CONTENT

afterEach(() => {
  if (ORIGINAL_FLAG === undefined) delete process.env.AI_LOG_CONTENT
  else process.env.AI_LOG_CONTENT = ORIGINAL_FLAG
})

test('default: prompt and response are NULL — no learner content at rest', () => {
  delete process.env.AI_LOG_CONTENT
  const row = buildAICallLogRow(SENSITIVE_LOG)
  assert.equal(row.prompt, null, 'prompt must not be persisted by default')
  assert.equal(row.response, null, 'response must not be persisted by default')
})

test('default: operational metadata the rate-limiter needs is still stored', () => {
  delete process.env.AI_LOG_CONTENT
  const row = buildAICallLogRow(SENSITIVE_LOG)
  assert.equal(row.feature, 'insha')
  assert.equal(row.model, 'deepseek-chat')
  assert.equal(row.latency_ms, 1234)
  assert.equal(row.token_count, 567)
  assert.equal(row.success, true)
  assert.equal(row.user_id, '00000000-0000-0000-0000-000000000001')
})

test('AI_LOG_CONTENT=true: content is captured (truncated) for trusted debugging', () => {
  process.env.AI_LOG_CONTENT = 'true'
  const row = buildAICallLogRow(SENSITIVE_LOG)
  assert.equal(row.prompt, SENSITIVE_LOG.prompt.substring(0, 500))
  assert.equal(row.response, SENSITIVE_LOG.response!.substring(0, 500))
})

test('only the exact string "true" enables content logging', () => {
  process.env.AI_LOG_CONTENT = '1'
  const row = buildAICallLogRow(SENSITIVE_LOG)
  assert.equal(row.prompt, null)
  assert.equal(row.response, null)
})
