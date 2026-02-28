// lib/ai/hybrid-system.ts
import { GoogleGenerativeAI } from '@google/generative-ai'

// Fallback for build safety
const geminiKey = process.env.GOOGLE_API_KEY || 'build_dummy_key'
const deepseekKey = process.env.DEEPSEEK_API_KEY || 'build_dummy_key'

// ==================== GEMINI: LEARNING COMPASS ====================
const genAI = new GoogleGenerativeAI(geminiKey)
const geminiModel = genAI.getGenerativeModel({ 
  model: 'gemini-1.5-flash',
  generationConfig: {
    temperature: 0.7,
    maxOutputTokens: 500,
  }
})

export async function learningCompassChat(
  studentName: string,
  grade: number,
  question: string,
  conversationHistory: Array<{role: string, content: string}> = []
) {
  const systemPrompt = `
You are Mwalimu - Kenya's most patient and encouraging CBC tutor. 
You're chatting with ${studentName}, a Grade ${grade} student.
KENYAN CONTEXT: Use Kenyan examples (matatu, ugali). Mix English with Swahili ("Sawa!", "Vizuri!").
Never say "wrong" - say "almost!" or "let's try again".
RESPONSE FORMAT:
1. Warm greeting
2. Clear answer
3. Check understanding
4. Swahili encouragement
5. [Parent tip: one actionable tip]
`.trim()

  const prompt = `${systemPrompt}\n\nPREVIOUS: ${JSON.stringify(conversationHistory.slice(-4))}\n\nQUESTION: ${question}`

  try {
    const result = await geminiModel.generateContent(prompt)
    const rawResponse = result.response.text()
    const parentMatch = rawResponse.match(/\[Parent tip:?\]?\s*(.+?)(?:\n|$)/i)
    const parentInsight = parentMatch?.[1] || 'Encourage them to explain what they learned today.'
    const cleanMessage = rawResponse.replace(/\[Parent tip:?\].+$/i, '').trim()
    
    return {
      message: cleanMessage,
      encouragement: 'Vizuri sana! Keep going! 💪',
      nextSteps: ['Try one more problem', 'Explain your thinking'],
      parentInsight
    }
  } catch (error) {
    console.error('Gemini error:', error)
    return {
      message: `Hi ${studentName}! Let's try that again.`,
      encouragement: 'Great question!',
      nextSteps: ['Tell me which part is confusing'],
      parentInsight: 'System fallback triggered.'
    }
  }
}

// ==================== DEEPSEEK: PATHWAY ANALYSIS ====================
export async function analyzePathway(input: any) {
  const prompt = `Analyze CBC pathway for ${input.studentName}, Grade ${input.grade}. Grades: ${JSON.stringify(input.grades)}. Respond ONLY with valid JSON.`
  
  try {
    const response = await fetch('https://api.deepseek.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${deepseekKey}`
      },
      body: JSON.stringify({
        model: 'deepseek-chat',
        messages: [{ role: 'user', content: prompt }],
        temperature: 0.3
      })
    })
    const data = await response.json()
    return JSON.parse(data.choices[0].message.content)
  } catch (error) {
    console.error('DeepSeek error:', error)
    return { recommendedPathway: 'STEM', confidence: 70, reasoning: 'Fallback analysis triggered.', strengthAreas: [], improvementAreas: [], actionPlan: [], careerMatches: [] }
  }
}

// ==================== DEEPSEEK: CAREERS ====================
export async function recommendCareers(input: any) {
  // Similar fetch logic to analyzePathway...
  return { topCareers: [], pathwayInsight: "Consult your teacher for more details." }
}

// ✅ EXPORT AI OBJECT FOR ROUTES
export const AI = {
  chat: learningCompassChat,
  analyzePathway,
  recommendCareers,
}