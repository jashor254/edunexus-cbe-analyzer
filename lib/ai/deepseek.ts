// lib/ai/deepseek.ts
// Shared DeepSeek API helper — import this anywhere you need to call the model

import { DEEPSEEK_CONFIG } from '@/lib/config/api'

export async function callDeepSeek(prompt: string): Promise<string> {
  const response = await fetch(`${DEEPSEEK_CONFIG.baseURL}/v1/chat/completions`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${DEEPSEEK_CONFIG.getKeyOrThrow()}`,
    },
    body: JSON.stringify({
      model: DEEPSEEK_CONFIG.model,
      messages: [
        {
          role: 'system',
          content:
            'You are a helpful assistant. Always respond with valid JSON only — no markdown, no explanation, just the raw JSON.',
        },
        {
          role: 'user',
          content: prompt,
        },
      ],
      temperature: 0.7,
    }),
  })

  if (!response.ok) {
    const err = await response.text()
    throw new Error(`DeepSeek API error ${response.status}: ${err}`)
  }

  const data = await response.json()
  return data.choices[0].message.content as string
}