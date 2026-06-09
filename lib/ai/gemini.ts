// lib/ai/gemini.ts
// Shared Google Gemini API helper — fast chat responses

import { GoogleGenerativeAI } from '@google/generative-ai'

const GEMINI_API_KEY = process.env.GOOGLE_API_KEY

if (!GEMINI_API_KEY) {
  throw new Error('Missing GOOGLE_GEMINI_API_KEY in environment variables')
}

const genAI = new GoogleGenerativeAI(GEMINI_API_KEY)
const model = genAI.getGenerativeModel({ 
  model: 'gemini-1.5-flash',
  generationConfig: {
    temperature: 0.7,
    maxOutputTokens: 800,
  }
})

export async function callGemini(prompt: string): Promise<string> {
  try {
    const result = await model.generateContent(prompt)
    const response = result.response
    return response.text()
  } catch (error: unknown) {
    throw new Error(`Gemini API error: ${error instanceof Error ? error.message : String(error)}`)
  }
}

// For structured JSON responses
export async function callGeminiJSON(prompt: string): Promise<string> {
  const jsonPrompt = `${prompt}\n\nRespond ONLY with valid JSON. No markdown, no explanation, just raw JSON.`
  return callGemini(jsonPrompt)
}