// lib/ai/deepseek.ts
// Shared DeepSeek API helper — import this anywhere you need to call the model

import { DEEPSEEK_CONFIG } from '@/lib/config/api'

const TIMEOUT_MS = 25_000

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