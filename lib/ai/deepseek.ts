// lib/ai/deepseek.ts
// Shared DeepSeek / Gemini text-generation helpers — import this anywhere you
// need to call the model.
//
// Request budget (per LOGICAL call — docs/audits/ai-call-efficiency-deep-audit.md §3/§9):
//   callDeepSeek()         DeepSeek ≤2 (one retry, transport failures only) + Gemini ≤1  → max 3
//   callDeepSeekProvider() DeepSeek ≤2, no fallback                                       → max 2
//   callGeminiProvider()   Gemini 1, no retry, no fallback                                → max 1
//   streamDeepSeek()       Gemini 1 + DeepSeek ≤2 (Gemini is PRIMARY for streams)         → max 3
// The router (lib/ai-orchestration/router.ts) composes the single-provider
// functions, so it can never nest one fallback chain inside another.
//
// Fallback eligibility: a DeepSeek timeout/network failure (after its one
// retry), HTTP 429 or HTTP 5xx falls through to Gemini. Any other 4xx and a
// malformed 200 body do not — those are request/contract problems another
// provider would not fix, and retrying them only multiplies spend.
//
// Timeouts abort the underlying request on BOTH providers. (Gemini's used to
// be a promise race that rejected while the HTTP request kept running —
// whether a provider bills an aborted completion is outside our control; an
// abort stops us waiting and reading, it cannot un-send a request.)

import { GoogleGenerativeAI, type GenerationConfig } from '@google/generative-ai'
import { DEEPSEEK_CONFIG } from '@/lib/config/api'
import { GEMINI_PRIMARY } from '@/lib/ai/models'
import { logger } from '@/lib/observability/logger'
import { repos } from '@/lib/repositories'
import { recordSuccess, recordError } from '@/lib/ai-orchestration/registry'
import {
  geminiUsage,
  openAIUsage,
  recordProviderRequest,
  startLogicalCall,
  USAGE_UNAVAILABLE,
  type AIAttribution,
  type LogicalCall,
  type ProviderErrorKind,
  type ProviderUsage,
} from '@/lib/ai/usageTelemetry'

export type AICostContext = {
  organizationId: string
  feature:        string
}

const TIMEOUT_MS = 25_000
const GEMINI_TIMEOUT_MS = 20_000
const GEMINI_STREAM_TTFB_MS = 15_000
// Whole-stream bound, armed once the stream starts (so a turn is bounded by
// time-to-first-byte + STREAM_TOTAL_MS). A reply is capped at 1000
// output tokens and normally finishes well inside 20s; a stream still open at
// this point has stalled, and is aborted (the learner keeps the partial reply)
// instead of holding the request open until the platform kills it.
const STREAM_TOTAL_MS = 90_000

/** Aborts `controller` at the whole-stream deadline. Unref'd so it never keeps a process alive; aborting a finished request is a no-op. */
function armStreamDeadline(controller: AbortController): void {
  const t = setTimeout(() => controller.abort(), STREAM_TOTAL_MS)
  ;(t as { unref?: () => void }).unref?.()
}
const MAX_HISTORY = 20  // last 10 turns — keeps tokens bounded as session grows

// thinkingConfig is supported by gemini-2.5-flash but not yet in the SDK types
type GeminiGenerationConfig = GenerationConfig & { thinkingConfig?: { thinkingBudget: number } }

type ChatMessage = { role: 'user' | 'assistant'; content: string }

export type ProviderCompletion = {
  content:  string
  provider: 'deepseek' | 'gemini'
  model:    string
  usage:    ProviderUsage
}

type CompletionOptions = {
  temperature: number
  maxTokens:   number
  history:     ChatMessage[]
}

/** An HTTP error status from a provider — carries the status so fallback eligibility is decided on it, not on string matching. */
export class ProviderHttpError extends Error {
  constructor(readonly provider: 'deepseek' | 'gemini', readonly status: number, message: string) {
    super(message)
    this.name = 'ProviderHttpError'
  }
}

const DEEPSEEK_TIMEOUT_MESSAGE = 'DeepSeek timeout after 25s'

function isTransportRetryable(err: unknown): boolean {
  const msg = (err as Error)?.message
  return msg === DEEPSEEK_TIMEOUT_MESSAGE || msg === 'fetch failed'
}

/** May a failed DeepSeek call be handed to Gemini? (Transport failures already had their one retry.) */
function isFallbackEligible(err: unknown): boolean {
  if (isTransportRetryable(err)) return true
  return err instanceof ProviderHttpError && (err.status === 429 || err.status >= 500)
}

function errorKindOf(err: unknown): ProviderErrorKind {
  const msg = (err as Error)?.message ?? ''
  if (msg === DEEPSEEK_TIMEOUT_MESSAGE || /timeout|aborted/i.test(msg)) return 'timeout'
  if (msg === 'fetch failed') return 'network'
  if (err instanceof ProviderHttpError) return 'http'
  if (err instanceof TypeError || /no completion|no body/i.test(msg)) return 'malformed'
  return 'other'
}

// ── DeepSeek: one request ─────────────────────────────────────────────────────

async function deepSeekOnce(
  prompt: string,
  systemPrompt: string,
  options: CompletionOptions,
  call: LogicalCall,
): Promise<ProviderCompletion> {
  call.attempts++
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS)
  const start = Date.now()

  // The timer is cleared only after the body has been read — a response that
  // stalls mid-body must still be aborted (it used to hang with no timeout
  // once headers arrived).
  try {
    const response = await fetch(`${DEEPSEEK_CONFIG.baseURL}/v1/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${DEEPSEEK_CONFIG.getKeyOrThrow()}`,
      },
      body: JSON.stringify({
        model: DEEPSEEK_CONFIG.model,
        messages: [
          { role: 'system', content: systemPrompt },
          ...options.history,
          { role: 'user', content: prompt },
        ],
        temperature: options.temperature,
        max_tokens:  options.maxTokens,
      }),
      signal: controller.signal,
    })

    if (!response.ok) {
      const text = await response.text()
      throw new ProviderHttpError('deepseek', response.status, `DeepSeek API error ${response.status}: ${text}`)
    }

    const data = await response.json() as {
      choices?: { message?: { content?: string } }[]
      usage?: { prompt_tokens?: number; completion_tokens?: number; total_tokens?: number }
    }
    const content = data.choices?.[0]?.message?.content
    if (typeof content !== 'string') throw new TypeError('DeepSeek returned no completion')

    const usage = openAIUsage(data.usage)
    const latencyMs = Date.now() - start
    recordSuccess('deepseek', latencyMs)
    recordProviderRequest(call, { provider: 'deepseek', model: DEEPSEEK_CONFIG.model, outcome: 'success', latencyMs, usage })
    return { content, provider: 'deepseek', model: DEEPSEEK_CONFIG.model, usage }
  } catch (rawErr) {
    const err = (rawErr as Error)?.name === 'AbortError' ? new Error(DEEPSEEK_TIMEOUT_MESSAGE) : rawErr
    recordError('deepseek', (err as Error).message)
    recordProviderRequest(call, {
      provider: 'deepseek', model: DEEPSEEK_CONFIG.model, outcome: 'error', latencyMs: Date.now() - start,
      errorKind: errorKindOf(err), httpStatus: err instanceof ProviderHttpError ? err.status : undefined,
    })
    throw err
  } finally {
    clearTimeout(timer)
  }
}

/**
 * DeepSeek alone: one attempt plus exactly one retry on a transport failure
 * (timeout / network). Never falls back. Max 2 provider requests.
 */
export async function callDeepSeekProvider(
  prompt: string,
  systemPrompt: string,
  options: CompletionOptions,
  call: LogicalCall,
): Promise<ProviderCompletion> {
  try {
    return await deepSeekOnce(prompt, systemPrompt, options, call)
  } catch (err) {
    if (!isTransportRetryable(err)) throw err
    logger.warn('DeepSeek retryable error — retrying once', { service: 'deepseek', feature: call.feature, error: (err as Error).message })
    return deepSeekOnce(prompt, systemPrompt, options, call)
  }
}

// ── Gemini: one request ──────────────────────────────────────────────────────

/** Gemini alone: exactly one request, aborted at 20s. Max 1 provider request. */
export async function callGeminiProvider(
  prompt: string,
  systemPrompt: string,
  options: CompletionOptions,
  call: LogicalCall,
): Promise<ProviderCompletion> {
  const key = process.env.GOOGLE_GEMINI_API_KEY
  if (!key) throw new Error('Missing GOOGLE_GEMINI_API_KEY — cannot fall back to Gemini')

  call.attempts++
  const model = new GoogleGenerativeAI(key).getGenerativeModel({
    model: GEMINI_PRIMARY,
    systemInstruction: systemPrompt,
    generationConfig: {
      temperature: options.temperature,
      maxOutputTokens: options.maxTokens,
      thinkingConfig: { thinkingBudget: 0 },
    } as GeminiGenerationConfig,
  })

  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), GEMINI_TIMEOUT_MS)
  const start = Date.now()
  try {
    const contents = [
      ...options.history.map(m => ({ role: m.role === 'assistant' ? 'model' : 'user', parts: [{ text: m.content }] })),
      { role: 'user', parts: [{ text: prompt }] },
    ]
    const result = await model.generateContent({ contents }, { signal: controller.signal })
    const content = result.response.text()
    const usage = geminiUsage(result.response.usageMetadata)
    const latencyMs = Date.now() - start
    recordSuccess('gemini', latencyMs)
    recordProviderRequest(call, { provider: 'gemini', model: GEMINI_PRIMARY, outcome: 'success', latencyMs, usage })
    return { content, provider: 'gemini', model: GEMINI_PRIMARY, usage }
  } catch (rawErr) {
    const err = controller.signal.aborted ? new Error('Gemini timeout after 20s') : rawErr
    recordError('gemini', (err as Error).message)
    recordProviderRequest(call, { provider: 'gemini', model: GEMINI_PRIMARY, outcome: 'error', latencyMs: Date.now() - start, errorKind: errorKindOf(err) })
    throw err
  } finally {
    clearTimeout(timer)
  }
}

/**
 * costContext is optional and additive — existing callers that don't pass it
 * see zero behavior change (same return type, same signature otherwise).
 * Callers that DO have an organization_id available can opt in to recording
 * real AI token usage into usage_events. No production caller supplies one
 * today (organization_members does not exist in production); per-feature
 * usage is recorded instead by the per-request telemetry in
 * lib/ai/usageTelemetry.ts, keyed by `feature`.
 *
 * `feature` / `callSite` / `correlationId` say what the call is for — pass
 * them from every caller so spend can be attributed (calls without one are
 * logged as 'unattributed').
 */
export async function callDeepSeek(
  prompt: string,
  systemPrompt?: string,
  options?: {
    temperature?: number
    maxTokens?:  number
    history?:    ChatMessage[]
    costContext?: AICostContext
  } & AIAttribution
): Promise<string> {
  const resolved = {
    temperature: options?.temperature ?? 0.7,
    maxTokens:   options?.maxTokens  ?? 2048,
    history:     options?.history    ?? [],
  }
  const system = systemPrompt ??
    'You are a helpful Kenyan CBC tutor. Always respond with valid JSON only — no markdown, no explanation, just the raw JSON.'
  const call = startLogicalCall(options)

  async function recordUsage(completion: ProviderCompletion, latencyMs: number): Promise<void> {
    logger.info('AI call completed', {
      service: 'deepseek',
      feature: call.feature,
      provider: completion.provider,
      usage_tokens: completion.usage.totalTokens,
      usage_source: completion.usage.source,
      latency_ms: latencyMs,
      provider_requests: call.attempts,
    })
    if (options?.costContext && completion.usage.totalTokens !== null) {
      try {
        await repos.developers.insertAICostEvent({
          organization_id: options.costContext.organizationId,
          event_type:       'ai.completion',
          resource:         options.costContext.feature,
          quantity:         1,
          cost_tokens:      completion.usage.totalTokens,
        })
      } catch (err) {
        // Never let cost-recording failure break the AI response itself.
        logger.error('Failed to record AI cost event', { service: 'deepseek' }, err)
      }
    }
  }

  const start = Date.now()
  let completion: ProviderCompletion
  try {
    completion = await callDeepSeekProvider(prompt, system, resolved, call)
  } catch (err) {
    if (!isFallbackEligible(err)) throw err
    logger.warn('DeepSeek failed — falling back to Gemini', { service: 'deepseek', feature: call.feature, error: (err as Error).message })
    completion = await callGeminiProvider(prompt, system, resolved, call)
  }
  await recordUsage(completion, Date.now() - start)
  return completion.content
}

// ── Streaming helpers ─────────────────────────────────────────────────────────

/**
 * Passes DeepSeek's SSE bytes through untouched while sniffing the final
 * `usage` object (requested with stream_options.include_usage), so the
 * DeepSeek stream path is no longer a blind spot in usage telemetry.
 */
function withDeepSeekStreamUsage(
  body: ReadableStream<Uint8Array>,
  onDone: (usage: ProviderUsage) => void,
): ReadableStream<Uint8Array> {
  const decoder = new TextDecoder()
  let buffer = ''
  let usage: ProviderUsage = USAGE_UNAVAILABLE
  const scan = (line: string): void => {
    if (!line.startsWith('data: ')) return
    const data = line.slice(6).trim()
    if (!data || data === '[DONE]' || !data.includes('"usage"')) return
    try {
      const parsed = JSON.parse(data) as { usage?: { prompt_tokens?: number; completion_tokens?: number; total_tokens?: number } | null }
      if (parsed.usage) usage = openAIUsage(parsed.usage)
    } catch { /* not a usage line */ }
  }
  return body.pipeThrough(new TransformStream<Uint8Array, Uint8Array>({
    transform(chunk, controller) {
      controller.enqueue(chunk)
      buffer += decoder.decode(chunk, { stream: true })
      const lines = buffer.split('\n')
      buffer = lines.pop() ?? ''
      lines.forEach(scan)
    },
    flush() {
      scan(buffer)
      onDone(usage)
    },
  }))
}

async function fetchDeepSeekStreamOnce(
  body: string,
  call: LogicalCall,
): Promise<ReadableStream<Uint8Array>> {
  call.attempts++
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS)
  const start = Date.now()
  try {
    const response = await fetch(`${DEEPSEEK_CONFIG.baseURL}/v1/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${DEEPSEEK_CONFIG.getKeyOrThrow()}`,
      },
      body,
      signal: controller.signal,
    })
    if (!response.ok) {
      const text = await response.text()
      throw new ProviderHttpError('deepseek', response.status, `DeepSeek API error ${response.status}: ${text}`)
    }
    if (!response.body) throw new Error('DeepSeek stream returned no body')

    armStreamDeadline(controller)
    return withDeepSeekStreamUsage(response.body, usage => {
      recordProviderRequest(call, {
        provider: 'deepseek', model: DEEPSEEK_CONFIG.model, outcome: 'success',
        latencyMs: Date.now() - start, usage, streamed: true,
      })
    })
  } catch (rawErr) {
    const err = (rawErr as Error)?.name === 'AbortError' ? new Error(DEEPSEEK_TIMEOUT_MESSAGE) : rawErr
    recordProviderRequest(call, {
      provider: 'deepseek', model: DEEPSEEK_CONFIG.model, outcome: 'error', latencyMs: Date.now() - start,
      errorKind: errorKindOf(err), httpStatus: err instanceof ProviderHttpError ? err.status : undefined, streamed: true,
    })
    throw err
  } finally {
    // Time-to-first-byte bound ends here; from now on the whole-stream
    // deadline (armStreamDeadline) bounds the body.
    clearTimeout(timer)
  }
}

async function fetchDeepSeekStream(
  systemPrompt: string,
  userMessage: string,
  history: ChatMessage[],
  call: LogicalCall,
  options?: { temperature?: number }
): Promise<ReadableStream<Uint8Array>> {
  const body = JSON.stringify({
    model: DEEPSEEK_CONFIG.model,
    messages: [
      { role: 'system', content: systemPrompt },
      ...history,
      { role: 'user', content: userMessage },
    ],
    temperature: options?.temperature ?? 0.7,
    max_tokens:  1000,
    stream:      true,
    stream_options: { include_usage: true },
  })

  try {
    return await fetchDeepSeekStreamOnce(body, call)
  } catch (err) {
    if (!isTransportRetryable(err)) throw err
    logger.warn('DeepSeek stream retryable error — retrying once', { service: 'deepseek.stream', feature: call.feature, error: (err as Error).message })
    return fetchDeepSeekStreamOnce(body, call)
  }
}

// Records real streamed usage the same way callDeepSeek's recordUsage does —
// unconditionally logged for observability, additionally recorded per-org
// when costContext is supplied. Never throws — a cost-recording failure
// must not break a learner's Compass session.
async function recordStreamUsage(
  usageTokens: number | null,
  provider: string,
  call: LogicalCall,
  costContext?: AICostContext
): Promise<void> {
  logger.info('AI stream completed', { service: 'deepseek.stream', feature: call.feature, provider, usage_tokens: usageTokens })
  if (costContext && usageTokens !== null) {
    try {
      await repos.developers.insertAICostEvent({
        organization_id: costContext.organizationId,
        event_type:       'ai.completion',
        resource:         costContext.feature,
        quantity:         1,
        cost_tokens:      usageTokens,
      })
    } catch (err) {
      logger.error('Failed to record AI stream cost event', { service: 'deepseek.stream' }, err)
    }
  }
}

// Emits DeepSeek-compatible SSE so the route's TransformStream needs no changes.
async function streamGemini(
  systemPrompt: string,
  userMessage: string,
  history: ChatMessage[],
  temperature: number,
  call: LogicalCall,
  costContext?: AICostContext
): Promise<ReadableStream<Uint8Array>> {
  const key = process.env.GOOGLE_GEMINI_API_KEY
  if (!key) throw new Error('Missing GOOGLE_GEMINI_API_KEY — cannot stream from Gemini')

  call.attempts++
  const genAI = new GoogleGenerativeAI(key)
  const model = genAI.getGenerativeModel({
    model: GEMINI_PRIMARY,
    systemInstruction: systemPrompt,
    generationConfig: {
      temperature,
      maxOutputTokens: 1000,
      thinkingConfig: { thinkingBudget: 0 },  // disable thinking — shaves 2-5s off TTFT
    } as GeminiGenerationConfig,
  })

  const geminiHistory = history.map(m => ({
    role: m.role === 'assistant' ? 'model' : 'user',
    parts: [{ text: m.content }],
  }))

  const chat = model.startChat({ history: geminiHistory })

  // 15s bound on Gemini time-to-first-byte. The abort cancels the real HTTP
  // request (the previous promise race left it running in the background
  // while DeepSeek was also called). Once the stream has started, only the
  // whole-stream deadline (armStreamDeadline) can end it — a stalled answer
  // is cut off there and the learner keeps what had arrived.
  const ttfb = new AbortController()
  const timer = setTimeout(() => ttfb.abort(), GEMINI_STREAM_TTFB_MS)
  const start = Date.now()
  let result: Awaited<ReturnType<typeof chat.sendMessageStream>>
  try {
    result = await chat.sendMessageStream(userMessage, { signal: ttfb.signal })
    armStreamDeadline(ttfb)
  } catch (rawErr) {
    const err = ttfb.signal.aborted ? new Error('Gemini stream timeout after 15s') : rawErr
    recordError('gemini', (err as Error).message)
    recordProviderRequest(call, { provider: 'gemini', model: GEMINI_PRIMARY, outcome: 'error', latencyMs: Date.now() - start, errorKind: errorKindOf(err), streamed: true })
    throw err
  } finally {
    clearTimeout(timer)
  }

  const encoder = new TextEncoder()
  return new ReadableStream<Uint8Array>({
    async start(controller) {
      try {
        for await (const chunk of result.stream) {
          const text = chunk.text()
          if (text) {
            const sseChunk = `data: ${JSON.stringify({ choices: [{ delta: { content: text } }] })}\n\n`
            controller.enqueue(encoder.encode(sseChunk))
          }
        }
        controller.enqueue(encoder.encode('data: [DONE]\n\n'))
        // Stream is fully drained — result.response now resolves with the
        // aggregated response, including real usage metadata.
        let usage: ProviderUsage = USAGE_UNAVAILABLE
        try {
          const final = await result.response
          usage = geminiUsage(final.usageMetadata)
        } catch (usageErr) {
          logger.warn('Could not read Gemini stream usage metadata', { service: 'deepseek.stream' }, usageErr)
        }
        recordSuccess('gemini', Date.now() - start)
        recordProviderRequest(call, { provider: 'gemini', model: GEMINI_PRIMARY, outcome: 'success', latencyMs: Date.now() - start, usage, streamed: true })
        await recordStreamUsage(usage.totalTokens, 'gemini', call, costContext)
      } catch (streamErr) {
        // Failed mid-answer — the learner has a partial reply. Recorded so a
        // truncated turn is countable, not invisible.
        recordError('gemini', (streamErr as Error).message)
        recordProviderRequest(call, { provider: 'gemini', model: GEMINI_PRIMARY, outcome: 'error', latencyMs: Date.now() - start, errorKind: 'other', streamed: true })
        logger.warn('Gemini stream failed mid-answer', { service: 'ai.stream', feature: call.feature }, streamErr)
      } finally {
        controller.close()
      }
    },
  })
}

/**
 * Streams a tutoring reply. Gemini is the PRIMARY provider for streams
 * (despite this function's historical name); DeepSeek is the fallback.
 * Max 3 provider requests: Gemini 1 + DeepSeek ≤2.
 */
export async function streamDeepSeek(
  systemPrompt: string,
  userMessage: string,
  history: ChatMessage[],
  options?: { temperature?: number; costContext?: AICostContext } & AIAttribution
): Promise<ReadableStream<Uint8Array>> {
  const temperature = options?.temperature ?? 0.7
  const trimmedHistory = history.slice(-MAX_HISTORY)
  const call = startLogicalCall(options)
  try {
    return await streamGemini(systemPrompt, userMessage, trimmedHistory, temperature, call, options?.costContext)
  } catch (geminiErr) {
    logger.warn('Gemini stream failed — falling back to DeepSeek', { service: 'ai.stream', feature: call.feature }, geminiErr)
    return fetchDeepSeekStream(systemPrompt, userMessage, trimmedHistory, call, options)
  }
}
