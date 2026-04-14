import { NextRequest } from 'next/server'
import { createClient } from '@/utils/supabase/server'
import { apiSuccess, apiError } from '@/lib/api/response'

export const dynamic = 'force-dynamic'

async function analyzePathway(
  studentName: string,
  grade: number,
  grades: Record<string, number>
) {
  const prompt = `
You are a Kenya CBC curriculum expert.
Analyze this student's pathway for Senior School.

Student: ${studentName}
Grade: ${grade}
Subject scores (1-4 scale):
${JSON.stringify(grades, null, 2)}

Return ONLY valid JSON:
{
  "recommendedPathway": "STEM" | "Arts and Sports" | "Social Sciences",
  "confidence": 85,
  "reasoning": "explanation here",
  "strengthAreas": ["subject1", "subject2"],
  "improvementAreas": ["subject3"],
  "actionPlan": [
    "Step 1 to improve",
    "Step 2 to improve"
  ],
  "careerMatches": [
    "Career 1",
    "Career 2",
    "Career 3"
  ]
}
  `

  const response = await fetch(
    'https://api.deepseek.com/chat/completions',
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${process.env.DEEPSEEK_AI_API_KEY}`
      },
      body: JSON.stringify({
        model: 'deepseek-chat',
        messages: [
          {
            role: 'system',
            content: 'Kenya CBC curriculum expert. Return ONLY valid JSON. No markdown.'
          },
          { role: 'user', content: prompt }
        ],
        temperature: 0.3,
        max_tokens: 1000
      })
    }
  )

  const data = await response.json()
  const content = data.choices[0].message.content
  const cleaned = content
    .replace(/```json/g, '')
    .replace(/```/g, '')
    .trim()
  return JSON.parse(cleaned)
}

export async function POST(request: NextRequest) {
  try {
    const { studentId, grades } = await request.json()
    if (!studentId || !grades) return apiError('Missing required fields', 400)

    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return apiError('Unauthorized', 401)

    const { data: profile } = await supabase
      .from('profiles')
      .select('plan_type, tokens')
      .eq('id', user.id)
      .single()
    if (!profile) return apiError('Profile not found', 404)

    const planType = profile.plan_type || 'trial'
    const tokens = profile.tokens || 0
    if (planType === 'trial' && tokens < 1) {
      return apiError('No tokens', 403)
    }

    const { data: student } = await supabase
      .from('students')
      .select('name, grade')
      .eq('id', studentId)
      .single()
    if (!student) return apiError('Student not found', 404)

    const analysis = await analyzePathway(
      student.name,
      student.grade,
      grades
    )

    await supabase.from('pathway_analyses').insert({
      student_id: studentId,
      user_id: user.id,
      recommended_pathway: analysis.recommendedPathway,
      career_matches: analysis.careerMatches
    })

    return apiSuccess({ analysis })
  } catch (error) {
    console.error('Pathway analysis error:', error)
    return apiError('Failed to analyze pathway', 500)
  }
}
