// lib/ai/careerAnalysis.ts
// AI Career Analysis Engine

import { DEEPSEEK_CONFIG } from '@/lib/config/api'
import type { SubjectScores } from '@/lib/pathwayCalculator'

// ---------------------------------------------------------------------------
// Shared helper — single place to call DeepSeek
// ---------------------------------------------------------------------------
async function callDeepSeek(prompt: string): Promise<string> {
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
          content: 'You are a helpful assistant. Always respond with valid JSON only — no markdown, no explanation, just the raw JSON.',
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

// ---------------------------------------------------------------------------
// Types (UPDATED - No salary numbers!)
// ---------------------------------------------------------------------------
export type CareerProfile = {
  studentName: string
  grade: number
  pathway: string
  subjectScores: SubjectScores
  strengths: string[]
  weaknesses: string[]
  pathwayConfidence: 'high' | 'medium' | 'low'
}

export type CareerRecommendation = {
  career: string
  matchScore: number
  reasoning: string
  requiredSubjects: string[]
  currentGaps: string[]
  kenyanUniversities: string[]
  tvetOptions: string[]  // ✅ ADDED
  internationalOptions: string[]
  industryDemand: 'very_high' | 'high' | 'moderate' | 'low'
  earningPotential: 'exceptional' | 'very_lucrative' | 'lucrative' | 'moderate' | 'lower_but_stable'  // ✅ CHANGED
  jobSecurity: 'very_high' | 'high' | 'moderate' | 'low'  // ✅ ADDED
  kenyanMarketReality: string  // ✅ ADDED
  aiDisruptionRisk: 'very_low' | 'low' | 'moderate' | 'high' | 'very_high'  // ✅ ADDED
  careerPath: string[]
}

export type IntegratedLearningPlan = {
  career: string
  subject: string
  currentLevel: number
  targetLevel: number
  whyItMatters: string
  careerSpecificSteps: string[]
  careerSpecificResources: string[]
  successStories: string[]
  milestones: Array<{
    month: number
    goal: string
    careerRelevance: string
  }>
}

// ---------------------------------------------------------------------------
// Career analysis (UPDATED PROMPT - No salary numbers!)
// ---------------------------------------------------------------------------
export async function analyzeCareerOptions(
  profile: CareerProfile
): Promise<CareerRecommendation[]> {
  const prompt = `You are an expert Kenyan education and career counselor specializing in the CBC (Competency-Based Curriculum) system.

STUDENT PROFILE:
- Name: ${profile.studentName}
- Grade: ${profile.grade}
- Current Pathway Affinity: ${profile.pathway}
- Pathway Confidence: ${profile.pathwayConfidence}

PERFORMANCE DATA:
Strengths (Score ≥ 3): ${profile.strengths.join(', ')}
Weaknesses (Score ≤ 2): ${profile.weaknesses.join(', ')}

Subject Scores (1-4 CBC scale):
${Object.entries(profile.subjectScores).map(([subject, score]) => `- ${subject}: ${score}`).join('\n')}

TASK: Provide 5 career recommendations that:
1. Match the student's strengths and pathway
2. Are realistic for Kenya's job market
3. Consider both local and international opportunities
4. Include TVET (Technical and Vocational Education) options where applicable
5. Consider AI disruption and future job security

For EACH career, provide:
- Career name
- Match score (0-100) based on student's profile
- Clear reasoning why this career fits
- Required subject combinations for Kenyan universities
- Current gaps in student's preparation
- Top 3 Kenyan universities offering this path
- TVET/Diploma options (if applicable)
- International university options (if relevant)
- Industry demand in Kenya (very_high/high/moderate/low)
- Earning potential (exceptional/very_lucrative/lucrative/moderate/lower_but_stable)
- Job security level (very_high/high/moderate/low)
- Kenyan market reality (2-3 sentences about the REAL job market in Kenya)
- AI disruption risk (very_low/low/moderate/high/very_high)
- Typical career progression path (3-5 steps)

CRITICAL: 
- DO NOT include specific salary numbers
- Use earning potential categories instead
- Be brutally honest about Kenyan job market realities
- Consider AI impact on each career
- Include both university AND TVET pathways

Return as a JSON array ONLY (no markdown, no extra text):
[
  {
    "career": "Software Engineer",
    "matchScore": 85,
    "reasoning": "Strong mathematics and logical thinking align perfectly with software development. The student's analytical skills show natural aptitude for programming.",
    "requiredSubjects": ["Mathematics", "Physics", "Computer Science"],
    "currentGaps": ["Mathematics needs improvement from level 1 to 3"],
    "kenyanUniversities": ["JKUAT", "UoN", "Strathmore"],
    "tvetOptions": ["Nairobi Technical Training Institute", "NIBS Tech", "Zetech College"],
    "internationalOptions": ["MIT", "Stanford", "Waterloo"],
    "industryDemand": "very_high",
    "earningPotential": "very_lucrative",
    "jobSecurity": "high",
    "kenyanMarketReality": "Tech startups, banks, telcos, and international remote jobs create high demand. Can work from anywhere. Competitive but rewarding field.",
    "aiDisruptionRisk": "moderate",
    "careerPath": ["Junior Developer", "Mid-level Developer", "Senior Developer", "Tech Lead", "CTO/Entrepreneur"]
  }
]

IMPORTANT: 
- Be realistic about gaps and challenges
- Prioritize careers actually available in Kenya
- Consider both traditional and emerging careers
- Focus on CBC-aligned pathways
- Remember: Many students will pursue TVET, not just university
- Be honest about AI impact on each career`

  try {
    const text = await callDeepSeek(prompt)

    const jsonMatch = text.match(/\[[\s\S]*\]/)
    if (!jsonMatch) {
      throw new Error('Failed to parse AI response')
    }

    const careers: CareerRecommendation[] = JSON.parse(jsonMatch[0])
    return careers.slice(0, 5)
  } catch (error) {
    console.error('Career analysis error:', error)
    throw new Error('Failed to generate career recommendations')
  }
}

// ---------------------------------------------------------------------------
// Integrated learning plan (UNCHANGED - This is already great!)
// ---------------------------------------------------------------------------
export async function generateCareerIntegratedLearningPlan(
  career: string,
  subject: string,
  currentLevel: number,
  targetLevel: number,
  studentName: string
): Promise<IntegratedLearningPlan> {
  const prompt = `You are a personalized learning coach for ${studentName}, a Kenyan CBC student.

CONTEXT:
- Career Goal: ${career}
- Subject: ${subject}
- Current CBC Level: ${currentLevel} (1=Below Expectations, 2=Approaching, 3=Meeting, 4=Exceeding)
- Target Level: ${targetLevel}

TASK: Create a personalized learning plan that:
1. Explains WHY this subject matters for their career dream
2. Provides career-specific action steps (not generic)
3. Suggests resources aligned with their career interest
4. Shares inspiring Kenyan success stories
5. Sets monthly milestones with career relevance

Return as a JSON object ONLY (no markdown, no extra text):
{
  "whyItMatters": "As a future ${career}, ${subject} is crucial because...",
  "careerSpecificSteps": [
    "Focus on [specific skill] which is essential for ${career}",
    "Practice [career-related application] using ${subject}",
    "Build a mini-project that demonstrates ${subject} in ${career}"
  ],
  "careerSpecificResources": [
    "Resource 1 (FREE if possible) - how it relates to career",
    "Resource 2 (Kenyan-specific) - career connection",
    "Resource 3 (practical application) - real-world use"
  ],
  "successStories": [
    "Story of a Kenyan who went from similar level to success in ${career}",
    "Kenyan professional in ${career} who excelled in ${subject}"
  ],
  "milestones": [
    {
      "month": 1,
      "goal": "Specific, measurable achievement for month 1",
      "careerRelevance": "How this connects to ${career}"
    },
    {
      "month": 2,
      "goal": "Specific, measurable achievement for month 2",
      "careerRelevance": "How this connects to ${career}"
    },
    {
      "month": 3,
      "goal": "Reach level ${targetLevel}",
      "careerRelevance": "Ready for ${career} pathway"
    }
  ]
}

Make it INSPIRING and SPECIFIC to ${career}. Use Kenyan context where possible. Prioritize FREE or affordable resources.`

  try {
    const text = await callDeepSeek(prompt)

    const jsonMatch = text.match(/\{[\s\S]*\}/)
    if (!jsonMatch) {
      throw new Error('Failed to parse AI response')
    }

    const plan = JSON.parse(jsonMatch[0])

    return {
      career,
      subject,
      currentLevel,
      targetLevel,
      ...plan,
    }
  } catch (error) {
    console.error('Integrated learning plan error:', error)
    throw new Error('Failed to generate integrated learning plan')
  }
}