// lib/ai/gemini.ts
// Shared Google Gemini API helper — fast single-shot responses.
//
// One provider request per call: no retry, no fallback. Every request is
// aborted at GEMINI_CALL_TIMEOUT_MS (it previously had no timeout at all,
// so one hung request could consume a whole cron's time budget) and is
// recorded in per-request usage telemetry (lib/ai/usageTelemetry.ts).

import { GoogleGenerativeAI, type GenerateContentResult, type GenerativeModel } from '@google/generative-ai'
import { GEMINI_PRIMARY } from '@/lib/ai/models'
import {
  geminiUsage,
  recordProviderRequest,
  startLogicalCall,
  type AIAttribution,
  type LogicalCall,
} from '@/lib/ai/usageTelemetry'

const GEMINI_CALL_TIMEOUT_MS = 20_000

function getModel(json: boolean) {
  const key = process.env.GOOGLE_GEMINI_API_KEY
  if (!key) throw new Error('Missing GOOGLE_GEMINI_API_KEY in environment variables')
  return new GoogleGenerativeAI(key).getGenerativeModel({
    model: GEMINI_PRIMARY,
    generationConfig: {
      temperature: 0.7,
      maxOutputTokens: 800,
      // Native JSON mode — the model returns bare JSON instead of a
      // ```json fenced block that JSON.parse rejects.
      ...(json ? { responseMimeType: 'application/json' } : {}),
    },
  })
}

async function generate(prompt: string, json: boolean, attribution?: AIAttribution): Promise<string> {
  const call = startLogicalCall(attribution)
  call.attempts++
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), GEMINI_CALL_TIMEOUT_MS)
  const start = Date.now()
  try {
    const result = await getModel(json).generateContent(prompt, { signal: controller.signal })
    const text = result.response.text()
    recordProviderRequest(call, {
      provider: 'gemini', model: GEMINI_PRIMARY, outcome: 'success',
      latencyMs: Date.now() - start, usage: geminiUsage(result.response.usageMetadata),
    })
    return text
  } catch (error: unknown) {
    const timedOut = controller.signal.aborted
    recordProviderRequest(call, {
      provider: 'gemini', model: GEMINI_PRIMARY, outcome: 'error',
      latencyMs: Date.now() - start, errorKind: timedOut ? 'timeout' : 'other',
    })
    const message = timedOut
      ? `timeout after ${GEMINI_CALL_TIMEOUT_MS / 1000}s`
      : error instanceof Error ? error.message : String(error)
    throw new Error(`Gemini API error: ${message}`)
  } finally {
    clearTimeout(timer)
  }
}

export async function callGemini(prompt: string, attribution?: AIAttribution): Promise<string> {
  return generate(prompt, false, attribution)
}

export async function callGeminiJSON(prompt: string, attribution?: AIAttribution): Promise<string> {
  const jsonPrompt = `${prompt}\n\nRespond ONLY with valid JSON. No markdown, no explanation, just raw JSON.`
  return generate(jsonPrompt, true, attribution)
}

/**
 * For callers that build their own Gemini model (Paper Intelligence's
 * multimodal + structured-output calls): one generateContent() request with
 * a real abort at `timeoutMs` and a per-request telemetry line. Pass the same
 * `call` (from startLogicalCall) across a caller's own retries so they share
 * one logical_call_id.
 */
export async function generateGeminiWithTimeout(
  model: GenerativeModel,
  request: Parameters<GenerativeModel['generateContent']>[0],
  opts: { timeoutMs: number; modelName: string; call: LogicalCall },
): Promise<GenerateContentResult> {
  opts.call.attempts++
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), opts.timeoutMs)
  const start = Date.now()
  try {
    const result = await model.generateContent(request, { signal: controller.signal })
    recordProviderRequest(opts.call, {
      provider: 'gemini', model: opts.modelName, outcome: 'success',
      latencyMs: Date.now() - start, usage: geminiUsage(result.response.usageMetadata),
    })
    return result
  } catch (error: unknown) {
    const timedOut = controller.signal.aborted
    recordProviderRequest(opts.call, {
      provider: 'gemini', model: opts.modelName, outcome: 'error',
      latencyMs: Date.now() - start, errorKind: timedOut ? 'timeout' : 'other',
    })
    if (timedOut) throw new Error(`Gemini request timed out after ${Math.round(opts.timeoutMs / 1000)}s`)
    throw error
  } finally {
    clearTimeout(timer)
  }
}
