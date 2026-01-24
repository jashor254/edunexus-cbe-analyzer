// lib/ai/gemini.ts
// Google AI Client Setup

import { GoogleGenerativeAI } from '@google/generative-ai'

if (!process.env.GOOGLE_AI_API_KEY) {
  throw new Error('GOOGLE_AI_API_KEY is not set in environment variables')
}

const genAI = new GoogleGenerativeAI(process.env.GOOGLE_AI_API_KEY)

// Use Flash for most operations (free tier, fast)
const flashModel = genAI.getGenerativeModel({ 
  model: 'gemini-1.5-flash',
  generationConfig: {
    temperature: 0.7,
    topP: 0.8,
    topK: 40,
    maxOutputTokens: 2048,
  }
})

// Use Pro for complex career analysis (higher quality)
const proModel = genAI.getGenerativeModel({ 
  model: 'gemini-1.5-pro',
  generationConfig: {
    temperature: 0.8,
    topP: 0.9,
    topK: 40,
    maxOutputTokens: 4096,
  }
})

// Export everything
export { genAI, flashModel, proModel }