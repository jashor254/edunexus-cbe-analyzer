// lib/career/matchEngine.ts
// AI-powered career matching via DeepSeek
// Takes student assessment scores + interests → returns top 5 career matches with honest reasoning

import { callDeepSeek } from '@/lib/ai/deepseek'
import { getAllCareers, saveCareerMatches } from './careerEngine'
import type { MatchEngineInput, MatchEngineResult, SubjectGap } from './types'

export async function generateCareerMatches(input: MatchEngineInput): Promise<MatchEngineResult> {
  const careers = await getAllCareers()

  if (careers.length === 0) {
    throw new Error('No careers in database. Run the seed first.')
  }

  // Narrow to cluster candidates when provided — prevents cross-cluster mismatches
  const filteredCareers = input.candidate_slugs?.length
    ? careers.filter(c => input.candidate_slugs!.includes(c.slug))
    : careers

  const careerList = filteredCareers.map((c) => ({
    slug: c.slug,
    title: c.title,
    category: c.category,
    required_subjects: c.required_subjects,
    ai_impact_level: c.ai_impact.level,
  }))

  const subjectSummary = Object.entries(input.subject_scores)
    .map(([subject, score]) => `${subject}: ${score}/4`)
    .join(', ')

  const prompt = `You are a Kenyan career guidance counsellor with deep knowledge of the CBC curriculum,
Kenyan job market realities, and AI's impact on future careers.

STUDENT PROFILE:
- Name: ${input.student_name}
- Grade: ${input.grade}
- Age: ${input.age} years old
- Current subject scores (CBC scale 1–4): ${subjectSummary || 'Not yet assessed'}
- Personal interests: ${input.interests.join(', ') || 'None specified'}
- Dream career: ${input.dream_career || 'Not specified'}

AVAILABLE CAREERS:
${JSON.stringify(careerList, null, 2)}

TASK: Analyze this student's profile and select the TOP 5 most suitable careers from the list above.

For each career, provide:
1. match_score: 0–100 (honest, not inflated — a student with no maths scores should not get 90% match for engineering)
2. reasoning: 2–3 sentences. Be HONEST about gaps. "Your Mathematics score of 2 is a concern for engineering — you would need to strengthen this significantly" is more useful than empty praise.
3. subject_gaps: Array of subjects where current score is below typical requirement. Include current score, required score, and specific advice.
4. skill_gaps: Array of 2–3 skills the student currently lacks for this career path.

IMPORTANT: If the student has not been assessed yet (no scores), generate reasonable matches based on their interests and dream career, with match scores in the 40–65 range and note that scores are estimates pending assessment.

Return ONLY valid JSON in this exact format:
{
  "top_matches": [
    {
      "career_slug": "software-engineer",
      "career_title": "Software Engineer",
      "match_score": 72,
      "reasoning": "Your strong Mathematics performance (3/4) is a solid foundation. However, you have not studied Physics, which is important for university entry into Computer Science. Your interest in technology is a great motivator.",
      "subject_gaps": [
        {
          "subject": "Physics",
          "current_score": 0,
          "required_score": 3,
          "gap": 3,
          "advice": "Start taking Physics seriously in Grade 9 — it is required for BSc Computer Science at UoN and JKUAT."
        }
      ],
      "skill_gaps": ["Programming fundamentals", "Logical problem decomposition"]
    }
  ]
}`

  const raw = await callDeepSeek(
    prompt,
    'You are a Kenyan career counsellor. Return only valid JSON. No markdown. No explanation. Just JSON.'
  )

  let parsed: MatchEngineResult
  try {
    const cleaned = raw.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim()
    const obj = JSON.parse(cleaned) as { top_matches: MatchEngineResult['top_matches'] }
    parsed = {
      top_matches: obj.top_matches.slice(0, 5),
      generated_at: new Date().toISOString(),
    }
  } catch {
    throw new Error('AI returned invalid JSON for career matching. Please retry.')
  }

  // Save to DB — map reasoning → match_reasoning for the DB layer
  await saveCareerMatches(
    input.student_id,
    parsed.top_matches.map(m => ({
      career_slug: m.career_slug,
      match_score: m.match_score,
      match_reasoning: m.reasoning,
      subject_gaps: m.subject_gaps,
      skill_gaps: m.skill_gaps,
    }))
  )

  return parsed
}

export async function generateSingleCareerFit(
  input: MatchEngineInput,
  careerSlug: string
): Promise<{
  match_score: number
  reasoning: string
  subject_gaps: SubjectGap[]
  skill_gaps: string[]
  encouragement: string
}> {
  const subjectSummary = Object.entries(input.subject_scores)
    .map(([subject, score]) => `${subject}: ${score}/4`)
    .join(', ')

  const prompt = `You are a Kenyan career counsellor analyzing fit for ONE specific career.

STUDENT:
- Name: ${input.student_name}
- Grade: ${input.grade}, Age: ${input.age}
- Subject scores: ${subjectSummary || 'Not yet assessed'}
- Interests: ${input.interests.join(', ') || 'None specified'}

TARGET CAREER: ${careerSlug.replace(/-/g, ' ')}

Analyze whether this student is on track for this career. Be honest about gaps but frame advice constructively.
Include a specific encouragement sentence relevant to a Kenyan student.

Return ONLY valid JSON:
{
  "match_score": 68,
  "reasoning": "2-3 honest sentences about fit",
  "subject_gaps": [{"subject": "Mathematics", "current_score": 2, "required_score": 3, "gap": 1, "advice": "specific advice"}],
  "skill_gaps": ["skill1", "skill2"],
  "encouragement": "One specific, genuine encouragement sentence for a Kenyan student pursuing this career"
}`

  const raw = await callDeepSeek(
    prompt,
    'You are a Kenyan career counsellor. Return only valid JSON.'
  )

  try {
    const cleaned = raw.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim()
    return JSON.parse(cleaned)
  } catch {
    throw new Error('AI returned invalid JSON for single career fit. Please retry.')
  }
}
