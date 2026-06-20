// lib/ai/deepseek.ts
// Shared DeepSeek API helper — import this anywhere you need to call the model

import { GoogleGenerativeAI, type GenerationConfig } from '@google/generative-ai'
import { DEEPSEEK_CONFIG } from '@/lib/config/api'
import { GEMINI_PRIMARY } from '@/lib/ai/models'

const TIMEOUT_MS = 25_000
const MAX_HISTORY = 20  // last 10 turns — keeps tokens bounded as session grows

// thinkingConfig is supported by gemini-2.5-flash but not yet in the SDK types
type GeminiGenerationConfig = GenerationConfig & { thinkingConfig?: { thinkingBudget: number } }

async function callOnce(
  prompt: string,
  systemPrompt: string,
  options: {
    temperature: number
    maxTokens:   number
    history:     { role: 'user' | 'assistant'; content: string }[]
  }
): Promise<string> {
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS)

  let response: Response
  try {
    response = await fetch(`${DEEPSEEK_CONFIG.baseURL}/v1/chat/completions`, {
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
  } catch (err) {
    if ((err as Error).name === 'AbortError') {
      throw new Error('DeepSeek timeout after 25s')
    }
    throw err
  } finally {
    clearTimeout(timer)
  }

  if (!response.ok) {
    const text = await response.text()
    throw new Error(`DeepSeek API error ${response.status}: ${text}`)
  }

  const data = await response.json() as { choices: { message: { content: string } }[] }
  return data.choices[0].message.content
}

export async function callDeepSeek(
  prompt: string,
  systemPrompt?: string,
  options?: {
    temperature?: number
    maxTokens?:  number
    history?:    { role: 'user' | 'assistant'; content: string }[]
  }
): Promise<string> {
  const resolved = {
    temperature: options?.temperature ?? 0.7,
    maxTokens:   options?.maxTokens  ?? 2048,
    history:     options?.history    ?? [],
    systemPrompt: systemPrompt ??
      'You are a helpful Kenyan CBC tutor. Always respond with valid JSON only — no markdown, no explanation, just the raw JSON.',
  }

  try {
    return await callOnce(prompt, resolved.systemPrompt, resolved)
  } catch (err) {
    const msg = (err as Error).message
    const isRetryable = msg === 'DeepSeek timeout after 25s' || msg === 'fetch failed'
    if (isRetryable) {
      console.warn(`[deepseek] retryable error on first attempt (${msg}) — retrying once`)
      return await callOnce(prompt, resolved.systemPrompt, resolved)
    }
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
    response = await fetch(`${DEEPSEEK_CONFIG.baseURL}/v1/chat/completions`, {
      method: 'POST', headers, body, signal: controller.signal,
    })
  } catch (err) {
    clearTimeout(timer)
    const msg = (err as Error).name === 'AbortError'
      ? 'DeepSeek stream timeout after 25s'
      : (err as Error).message
    const isRetryable = (err as Error).name === 'AbortError' || msg === 'fetch failed'
    if (isRetryable) {
      console.warn(`[deepseek] stream retryable error (${msg}) — retrying once`)
      const controller2 = new AbortController()
      const timer2 = setTimeout(() => controller2.abort(), TIMEOUT_MS)
      try {
        response = await fetch(`${DEEPSEEK_CONFIG.baseURL}/v1/chat/completions`, {
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

// Emits DeepSeek-compatible SSE so the route's TransformStream needs no changes.
async function streamGeminiFallback(
  systemPrompt: string,
  userMessage: string,
  history: { role: 'user' | 'assistant'; content: string }[],
  temperature: number
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
      } finally {
        controller.close()
      }
    },
  })
}

export async function streamDeepSeek(
  systemPrompt: string,
  userMessage: string,
  history: { role: 'user' | 'assistant'; content: string }[],
  options?: { temperature?: number }
): Promise<ReadableStream<Uint8Array>> {
  const temperature = options?.temperature ?? 0.7
  const trimmedHistory = history.slice(-MAX_HISTORY)
  try {
    console.log('[ai] trying Gemini first')
    return await streamGeminiFallback(systemPrompt, userMessage, trimmedHistory, temperature)
  } catch (geminiErr) {
    console.warn('[ai] Gemini failed — falling back to DeepSeek:', (geminiErr as Error).message)
    return fetchDeepSeekStream(systemPrompt, userMessage, trimmedHistory, options)
  }
}
