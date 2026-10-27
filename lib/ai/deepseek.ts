// lib/ai/deepseek.ts
// Shared DeepSeek API helper — import this anywhere you need to call the model

import { GoogleGenerativeAI, type GenerationConfig } from '@google/generative-ai'
import { DEEPSEEK_CONFIG } from '@/lib/config/api'
import { GEMINI_PRIMARY } from '@/lib/ai/models'
import { logger } from '@/lib/observability/logger'
import { repos } from '@/lib/repositories'
import { logAICall } from '@/lib/ai/logger'
import { recordSuccess, recordError } from '@/lib/ai-orchestration/registry'
import type { CompassProvider as StreamProvider } from '@/lib/config/compassProviders'

export type AICostContext = {
  organizationId: string
  feature:        string
}

const TIMEOUT_MS = 25_000
const MAX_HISTORY = 20  // last 10 turns — keeps tokens bounded as session grows

// thinkingConfig is supported by gemini-2.5-flash but not yet in the SDK types
type GeminiGenerationConfig = GenerationConfig & { thinkingConfig?: { thinkingBudget: number } }

type CallOnceResult = { content: string; usageTokens: number | null }

async function callOnce(
  prompt: string,
  systemPrompt: string,
  options: {
    temperature: number
    maxTokens:   number
    history:     { role: 'user' | 'assistant'; content: string }[]
  }
): Promise<CallOnceResult> {
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS)

  // The timer used to be cleared in a `finally` scoped only around `fetch()`
  // itself — so it stopped protecting the call the instant HTTP headers came
  // back, before `response.json()` ever ran. A response that stalls mid-body
  // (slow/large completion, flaky connection) then hung with zero timeout,
  // since the same AbortSignal was still attached to the stream but nothing
  // was left to fire it. Wrapping the whole fetch+parse sequence in one
  // try/finally keeps the abort armed until the call is genuinely done.
  let response: Response
  try {
    response = await fetch(DEEPSEEK_CONFIG.chatCompletionsUrl, {
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
      throw new Error(`DeepSeek API error ${response.status}: ${text}`)
    }

    const data = await response.json() as {
      choices: { message: { content: string } }[]
      usage?: { total_tokens?: number }
    }
    return {
      content:     data.choices[0].message.content,
      // Previously discarded entirely — the response already carries this.
      usageTokens: data.usage?.total_tokens ?? null,
    }
  } catch (err) {
    if ((err as Error).name === 'AbortError') {
      throw new Error('DeepSeek timeout after 25s')
    }
    throw err
  } finally {
    clearTimeout(timer)
  }
}

async function callGeminiNonStreaming(
  prompt: string,
  systemPrompt: string,
  temperature: number,
  maxTokens: number
): Promise<string> {
  const key = process.env.GOOGLE_GEMINI_API_KEY
  if (!key) throw new Error('Missing GOOGLE_GEMINI_API_KEY — cannot fall back to Gemini')

  const genAI = new GoogleGenerativeAI(key)
  const model = genAI.getGenerativeModel({
    model: GEMINI_PRIMARY,
    systemInstruction: systemPrompt,
    generationConfig: {
      temperature,
      maxOutputTokens: maxTokens,
      thinkingConfig: { thinkingBudget: 0 },
    } as GeminiGenerationConfig,
  })

  const GEMINI_TIMEOUT_MS = 20_000
  const result = await new Promise<string>((resolve, reject) => {
    const timer = setTimeout(
      () => reject(new Error('Gemini non-streaming timeout after 20s')),
      GEMINI_TIMEOUT_MS
    )
    model.generateContent(prompt).then(
      r => { clearTimeout(timer); resolve(r.response.text()) },
      e => { clearTimeout(timer); reject(e) }
    )
  })

  return result
}

/**
 * costContext is optional and additive — existing callers that don't pass it
 * see zero behavior change (same return type, same signature otherwise).
 * Callers that DO have an organization_id available (e.g. org-scoped
 * features) can opt in to recording real AI token usage into usage_events,
 * which is what the billing/quota system reads. Token usage from DeepSeek's
 * response was previously read and silently discarded; this is now captured
 * and logged unconditionally (for observability) and additionally recorded
 * per-org when costContext is supplied.
 *
 * Deliberately NOT threaded through all 24 existing call sites at once —
 * that would require passing organization context through every feature
 * that generates AI content today, a much larger change than this fix
 * warrants. Threading it through streamDeepSeek() is also out of scope:
 * DeepSeek's streaming response doesn't reliably include a final usage
 * object with stream_options unset, and capturing Gemini SDK usage metadata
 * for the fallback path is a separate, smaller follow-up.
 */
export async function callDeepSeek(
  prompt: string,
  systemPrompt?: string,
  options?: {
    temperature?: number
    maxTokens?:  number
    history?:    { role: 'user' | 'assistant'; content: string }[]
    costContext?: AICostContext
    feature?:    string
  }
): Promise<string> {
  const resolved = {
    temperature: options?.temperature ?? 0.7,
    maxTokens:   options?.maxTokens  ?? 2048,
    history:     options?.history    ?? [],
    systemPrompt: systemPrompt ??
      'You are a helpful Kenyan CBC tutor. Always respond with valid JSON only — no markdown, no explanation, just the raw JSON.',
  }

  // Feature label for ai_call_logs: an explicit `feature` wins, else the
  // costContext's (set by SOW/lesson callers), else a safe default so every
  // call is still counted. Call sites can be labelled incrementally later.
  const logFeature = options?.feature ?? options?.costContext?.feature ?? 'deepseek:uncategorized'

  // Persists one metadata-only row to ai_call_logs per call so AI token/cost
  // usage is actually observable in prod. prompt/response content is stripped
  // by buildAICallLogRow unless AI_LOG_CONTENT=true, so no learner text lands
  // at rest. logAICall never throws (it catches internally).
  async function logFailure(provider: string, err: unknown): Promise<void> {
    await logAICall({
      feature:   logFeature,
      model:     provider === 'gemini' ? GEMINI_PRIMARY : DEEPSEEK_CONFIG.model,
      prompt,
      latencyMs: 0,
      success:   false,
      error:     (err as Error).message,
    })
  }

  async function recordUsage(usageTokens: number | null, provider: string, latencyMs?: number): Promise<void> {
    logger.info('AI call completed', { service: 'deepseek', provider, usage_tokens: usageTokens, latency_ms: latencyMs })
    await logAICall({
      feature:    logFeature,
      model:      provider === 'gemini' ? GEMINI_PRIMARY : DEEPSEEK_CONFIG.model,
      prompt,
      latencyMs:  latencyMs ?? 0,
      tokenCount: usageTokens ?? undefined,
      success:    true,
    })
    if (options?.costContext && usageTokens !== null) {
      try {
        await repos.developers.insertAICostEvent({
          organization_id: options.costContext.organizationId,
          event_type:       'ai.completion',
          resource:         options.costContext.feature,
          quantity:         1,
          cost_tokens:      usageTokens,
        })
      } catch (err) {
        // Never let cost-recording failure break the AI response itself.
        logger.error('Failed to record AI cost event', { service: 'deepseek' }, err)
      }
    }
  }

  try {
    const start = Date.now()
    const result = await callOnce(prompt, resolved.systemPrompt, resolved)
    const latencyMs = Date.now() - start
    recordSuccess('deepseek', latencyMs)
    await recordUsage(result.usageTokens, 'deepseek', latencyMs)
    return result.content
  } catch (err) {
    const msg = (err as Error).message
    recordError('deepseek', msg)
    const isRetryable = msg === 'DeepSeek timeout after 25s' || msg === 'fetch failed'
    if (isRetryable) {
      logger.warn('DeepSeek retryable error — retrying once', { service: 'deepseek', error: msg })
      try {
        const start = Date.now()
        const result = await callOnce(prompt, resolved.systemPrompt, resolved)
        const latencyMs = Date.now() - start
        recordSuccess('deepseek', latencyMs)
        await recordUsage(result.usageTokens, 'deepseek', latencyMs)
        return result.content
      } catch (retryErr) {
        recordError('deepseek', (retryErr as Error).message)
        logger.warn('DeepSeek retry failed — falling back to Gemini', { service: 'deepseek' }, retryErr)
        try {
          const start = Date.now()
          const content = await callGeminiNonStreaming(prompt, resolved.systemPrompt, resolved.temperature, resolved.maxTokens)
          const latencyMs = Date.now() - start
          recordSuccess('gemini', latencyMs)
          await recordUsage(null, 'gemini', latencyMs) // Gemini usage metadata capture is a separate follow-up
          return content
        } catch (geminiErr) {
          recordError('gemini', (geminiErr as Error).message)
          await logFailure('gemini', geminiErr)
          throw geminiErr
        }
      }
    }
    await logFailure('deepseek', err)
    throw err
  }
}

// ── Streaming helpers ─────────────────────────────────────────────────────────

async function fetchDeepSeekStream(
  systemPrompt: string,
  userMessage: string,
  history: { role: 'user' | 'assistant'; content: string }[],
  options?: { temperature?: number }
): Promise<ReadableStream<Uint8Array>> {
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS)

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
  })

  const headers = {
    'Content-Type': 'application/json',
    Authorization: `Bearer ${DEEPSEEK_CONFIG.getKeyOrThrow()}`,
  }

  let response: Response
  try {
    response = await fetch(DEEPSEEK_CONFIG.chatCompletionsUrl, {
      method: 'POST', headers, body, signal: controller.signal,
    })
  } catch (err) {
    clearTimeout(timer)
    const msg = (err as Error).name === 'AbortError'
      ? 'DeepSeek stream timeout after 25s'
      : (err as Error).message
    const isRetryable = (err as Error).name === 'AbortError' || msg === 'fetch failed'
    if (isRetryable) {
      logger.warn('DeepSeek stream retryable error — retrying once', { service: 'deepseek.stream', error: msg })
      const controller2 = new AbortController()
      const timer2 = setTimeout(() => controller2.abort(), TIMEOUT_MS)
      try {
        response = await fetch(DEEPSEEK_CONFIG.chatCompletionsUrl, {
          method: 'POST', headers, body, signal: controller2.signal,
        })
      } catch (err2) {
        throw (err2 as Error).name === 'AbortError'
          ? new Error('DeepSeek stream timeout after 25s (retry)')
          : err2
      } finally {
        clearTimeout(timer2)
      }
    } else {
      throw err
    }
  } finally {
    clearTimeout(timer)
  }

  if (!response.ok) {
    const text = await response.text()
    throw new Error(`DeepSeek API error ${response.status}: ${text}`)
  }

  if (!response.body) {
    throw new Error('DeepSeek stream returned no body')
  }

  return response.body
}

// Records real streamed usage the same way callDeepSeek's recordUsage does —
// unconditionally logged for observability, additionally recorded per-org
// when costContext is supplied. Never throws — a cost-recording failure
// must not break a learner's Compass session.
async function recordStreamUsage(
  usageTokens: number | null,
  provider: string,
  costContext?: AICostContext
): Promise<void> {
  logger.info('AI stream completed', { service: 'deepseek.stream', provider, usage_tokens: usageTokens })
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
async function streamGeminiFallback(
  systemPrompt: string,
  userMessage: string,
  history: { role: 'user' | 'assistant'; content: string }[],
  temperature: number,
  costContext?: AICostContext
): Promise<ReadableStream<Uint8Array>> {
  const key = process.env.GOOGLE_GEMINI_API_KEY
  if (!key) throw new Error('Missing GOOGLE_GEMINI_API_KEY — cannot fall back to Gemini')

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

  // 15s timeout on Gemini TTFB — if no stream starts, fall through to DeepSeek
  const GEMINI_TIMEOUT_MS = 15_000
  const result = await new Promise<Awaited<ReturnType<typeof chat.sendMessageStream>>>(
    (resolve, reject) => {
      const timer = setTimeout(
        () => reject(new Error('Gemini stream timeout after 15s')),
        GEMINI_TIMEOUT_MS
      )
      void chat.sendMessageStream(userMessage).then(
        r => { clearTimeout(timer); resolve(r) },
        e => { clearTimeout(timer); reject(e) }
      )
    }
  )

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
        try {
          const final = await result.response
          const totalTokens = final.usageMetadata?.totalTokenCount ?? null
          await recordStreamUsage(totalTokens, 'gemini', costContext)
        } catch (usageErr) {
          logger.warn('Could not read Gemini stream usage metadata', { service: 'deepseek.stream' }, usageErr)
        }
      } finally {
        controller.close()
      }
    },
  })
}

/**
 * Bounds history to MAX_HISTORY turns AND guarantees it starts with a user turn.
 *
 * Gemini's SDK rejects a chat history whose first entry is not 'user' ("First
 * content should be with role 'user'"). Compass sends [user, assistant, …,
 * user] — odd length — so a bare slice(-MAX_HISTORY) starts with an assistant
 * turn once a session passes ~10 learner messages, and every later turn
 * silently fell back from Gemini to DeepSeek's own API. Dropping the leading
 * assistant turn(s) keeps the primary provider in use.
 */
export function trimHistoryForProvider(
  history: { role: 'user' | 'assistant'; content: string }[],
): { role: 'user' | 'assistant'; content: string }[] {
  const recent = history.slice(-MAX_HISTORY)
  const firstUser = recent.findIndex(turn => turn.role === 'user')
  return firstUser === -1 ? [] : recent.slice(firstUser)
}

export class NoAllowedProviderError extends Error {
  constructor() {
    super('No AI provider is allowed for this stream')
    this.name = 'NoAllowedProviderError'
  }
}

/**
 * Streams a chat completion from the providers the caller explicitly allows, in
 * order (first = primary, later = fallback). `providers` is required and is
 * never defaulted: a provider that is not listed is never contacted, so a
 * failure of the primary cannot silently send learner text somewhere that was
 * not approved. An empty list throws before any network call.
 */
export async function streamDeepSeek(
  systemPrompt: string,
  userMessage: string,
  history: { role: 'user' | 'assistant'; content: string }[],
  options: { providers: readonly StreamProvider[]; temperature?: number; costContext?: AICostContext }
): Promise<ReadableStream<Uint8Array>> {
  const temperature = options.temperature ?? 0.7
  const trimmedHistory = trimHistoryForProvider(history)
  if (options.providers.length === 0) throw new NoAllowedProviderError()

  let lastErr: unknown = null
  for (const [i, provider] of options.providers.entries()) {
    const isFallback = i > 0
    try {
      if (provider === 'gemini') {
        logger.info(isFallback ? 'Attempting Gemini stream (fallback)' : 'Attempting Gemini stream', { service: 'ai.stream' })
        return await streamGeminiFallback(systemPrompt, userMessage, trimmedHistory, temperature, options.costContext)
      }
      logger.info(isFallback ? 'Attempting DeepSeek stream (fallback)' : 'Attempting DeepSeek stream', { service: 'ai.stream' })
      // KNOWN GAP: the DeepSeek stream path does not yet capture usage — it
      // passes the raw SSE stream straight through to the caller. Logged
      // explicitly (not silently dropped) so cost data has a visible,
      // countable hole. Capturing it requires tee-ing a live stream without
      // disrupting what reaches the client — deliberately not rushed.
      if (options.costContext) {
        logger.warn('AI stream cost NOT recorded — DeepSeek stream path has no usage capture yet', {
          service: 'deepseek.stream',
          organization_id: options.costContext.organizationId,
          resource: options.costContext.feature,
        })
      }
      return await fetchDeepSeekStream(systemPrompt, userMessage, trimmedHistory, options)
    } catch (err) {
      lastErr = err
      const next = options.providers[i + 1]
      logger.warn(
        next ? `${provider} stream failed — trying ${next}` : `${provider} stream failed — no further provider allowed`,
        { service: 'ai.stream' },
        err,
      )
    }
  }
  throw lastErr
}
