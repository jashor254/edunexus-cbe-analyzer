// lib/ai/gemini.ts
// Shared Google Gemini API helper — fast chat responses

import { GoogleGenerativeAI } from '@google/generative-ai'

function getModel() {
  const key = process.env.GOOGLE_GEMINI_API_KEY
  if (!key) throw new Error('Missing GOOGLE_GEMINI_API_KEY in environment variables')
  return new GoogleGenerativeAI(key).getGenerativeModel({
    model: 'gemini-2.5-flash',
    generationConfig: { temperature: 0.7, maxOutputTokens: 800 },
  })
}

export async function callGemini(prompt: string): Promise<string> {
  try {
    const result = await getModel().generateContent(prompt)
    return result.response.text()
  } catch (error: unknown) {
    throw new Error(`Gemini API error: ${error instanceof Error ? error.message : String(error)}`)
  }
}

export async function callGeminiJSON(prompt: string): Promise<string> {
  const jsonPrompt = `${prompt}\n\nRespond ONLY with valid JSON. No markdown, no explanation, just raw JSON.`
  return callGemini(jsonPrompt)
}