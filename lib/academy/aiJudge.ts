import { callDeepSeek } from '@/lib/ai/deepseek'
import { logAICall } from '@/lib/ai/logger'
import type { ReflectionInput, ReflectionFeedback, MissionInput, MissionVerdict, AcademyMission } from './types'

const SYSTEM_PROMPT = `You are an expert teacher professional development coach specialising in Kenya's CBC curriculum and AI integration in education.

Your job is to evaluate teacher reflections submitted after they tried a lesson from the EduNexus AI Academy in their real classroom.

Score the reflection honestly using this rubric:
1 — Generic, no classroom specifics, fewer than 40 words total, or clearly not tried in class
2 — Some classroom detail, mentions a class or subject but lacks depth
3 — Specific class/subject mentioned, at least 3 of the 5 questions addressed thoughtfully, shows genuine attempt
4 — Evidence of real experimentation: describes learner responses, critical self-evaluation, concrete details
5 — Transformative: changed thinking, unexpected learner behaviour documented, proposes a testable next step, deeply reflective

Growth indicators:
- surface: answers are vague, formulaic, or repeat lesson content without personal insight
- developing: shows some personal application but lacks critical reflection
- deep: demonstrates genuine classroom trial with honest assessment of what failed
- transformative: shows evidence that teacher thinking has genuinely shifted

Always respond with valid JSON only — no markdown, no explanation, no code blocks. Exactly this shape:
{
  "quality_score": <1|2|3|4|5>,
  "feedback_text": "<2-3 warm but direct sentences in Kenyan professional register — reference the teacher as Mwalimu, acknowledge specifics from their reflection, be honest about what is missing>",
  "growth_indicator": "<surface|developing|deep|transformative>",
  "suggested_next_action": "<one specific, actionable suggestion tied to an EduNexus tool or CBC practice — not generic advice>"
}`

function countWords(input: ReflectionInput): number {
  const combined = [input.tried, input.worked, input.failed, input.surprised, input.next_action]
    .join(' ')
    .trim()
  return combined.split(/\s+/).filter(Boolean).length
}

function buildPrompt(input: ReflectionInput): string {
  return `A Kenyan CBC teacher has submitted the following reflection after trying an EduNexus AI Academy lesson in their classroom:

What did you try?
${input.tried || '(not answered)'}

What worked?
${input.worked || '(not answered)'}

What failed or was difficult?
${input.failed || '(not answered)'}

What surprised you?
${input.surprised || '(not answered)'}

What will you do differently next time?
${input.next_action || '(not answered)'}

Evaluate this reflection and return JSON feedback.`
}

export async function scoreReflection(
  input: ReflectionInput,
  userId?: string
): Promise<ReflectionFeedback> {
  const prompt = buildPrompt(input)
  const wordCount = countWords(input)
  const start = Date.now()

  // Very short reflections get scored 1 without an AI call — saves tokens.
  // This is a heuristic, not an AI judgement — flagged as such.
  if (wordCount < 15) {
    return {
      quality_score: 1,
      feedback_text:
        'Mwalimu, asante kwa kuanza! Tafadhali rudi baada ya kujaribu somo darasani na uandike kwa undani zaidi — sisi tunataka kujua kilichotokea kweli kweli.',
      growth_indicator: 'surface',
      suggested_next_action:
        'Try the classroom application task from this lesson with one of your classes this week, then come back and describe what actually happened.',
      isFallback: true,
    }
  }

  let raw = ''
  let success = false

  try {
    raw = await callDeepSeek(prompt, SYSTEM_PROMPT, {
      temperature: 0.3,
      maxTokens: 400,
    })
    success = true
  } catch (err) {
    await logAICall({
      feature: 'academy-reflection-judge',
      model: 'deepseek',
      prompt: prompt.substring(0, 500),
      latencyMs: Date.now() - start,
      success: false,
      error: (err as Error).message,
      userId,
    })
    // Graceful fallback — never block a teacher from submitting
    return fallbackFeedback(wordCount)
  }

  await logAICall({
    feature: 'academy-reflection-judge',
    model: 'deepseek',
    prompt: prompt.substring(0, 500),
    response: raw.substring(0, 500),
    latencyMs: Date.now() - start,
    success,
    userId,
  })

  try {
    const parsed = JSON.parse(raw) as ReflectionFeedback
    // Validate the shape before trusting it
    if (
      typeof parsed.quality_score === 'number' &&
      parsed.quality_score >= 1 &&
      parsed.quality_score <= 5 &&
      typeof parsed.feedback_text === 'string' &&
      typeof parsed.growth_indicator === 'string' &&
      typeof parsed.suggested_next_action === 'string'
    ) {
      return {
        quality_score: parsed.quality_score as ReflectionFeedback['quality_score'],
        feedback_text: parsed.feedback_text,
        growth_indicator: parsed.growth_indicator as ReflectionFeedback['growth_indicator'],
        suggested_next_action: parsed.suggested_next_action,
        isFallback: false,
      }
    }
    await logAICall({
      feature: 'academy-reflection-judge',
      model: 'deepseek',
      prompt: prompt.substring(0, 500),
      response: raw.substring(0, 500),
      latencyMs: Date.now() - start,
      success: false,
      error: 'AI response failed shape validation',
      userId,
    })
    return fallbackFeedback(wordCount)
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : String(e)
    console.error('[aiJudge:judgeReflection] JSON parse failed:', message)
    await logAICall({
      feature: 'academy-reflection-judge',
      model: 'deepseek',
      prompt: prompt.substring(0, 500),
      response: raw.substring(0, 500),
      latencyMs: Date.now() - start,
      success: false,
      error: `JSON parse failed: ${message}`,
      userId,
    })
    return fallbackFeedback(wordCount)
  }
}

function fallbackFeedback(wordCount: number): ReflectionFeedback {
  const score: ReflectionFeedback['quality_score'] = wordCount >= 80 ? 3 : wordCount >= 40 ? 2 : 1
  return {
    quality_score: score,
    feedback_text:
      'Asante, Mwalimu — tumepokea tafakari yako. Endelea kujaribu masomo darasani na kurudi kuandika mawazo yako.',
    growth_indicator: score >= 3 ? 'developing' : 'surface',
    suggested_next_action:
      'Open the EduNexus lesson planner and generate a lesson for the topic you just reflected on. Compare the AI output with what you actually taught.',
    isFallback: true,
  }
}

// ── Mission comparison scoring ────────────────────────────────────────────────

const MISSION_SYSTEM_PROMPT = `You are an expert CBC curriculum coach and AI literacy evaluator for Kenyan teachers.

A teacher has completed an EduNexus AI Academy mission. They have compared two AI tools or documented their classroom application. Your job is to evaluate the quality of their comparison and insights.

Score their submission 1-5:
1 — Superficial: no real comparison, vague observations, shows no critical thinking
2 — Basic: some observations but surface-level, missing the key differences
3 — Solid: notices meaningful differences, references specific details from both outputs
4 — Sharp: critically identifies why EduNexus outperforms or where it falls short, CBC-specific insights
5 — Expert: demonstrates genuine AI judgement, connects observations to learner outcomes, proposes testable improvements

Always respond with valid JSON only. Exactly this shape:
{
  "ai_score": <1|2|3|4|5>,
  "ai_verdict": "<3-4 sentences evaluating their comparison — warm but honest, reference specific things they noticed or missed, use Kenyan educational context>",
  "key_insight": "<The single most important thing this teacher's comparison reveals about AI in CBC education — one sentence>",
  "suggested_next_action": "<One specific next step that builds on what they just discovered — reference a concrete EduNexus tool or CBC practice>"
}`

function buildMissionPrompt(
  mission: Pick<AcademyMission, 'title' | 'mission_type' | 'description'>,
  input: MissionInput
): string {
  const parts: string[] = [
    `Mission: ${mission.title}`,
    `Type: ${mission.mission_type}`,
    `Description: ${mission.description}`,
    '',
  ]

  if (input.tool_a_output?.trim()) {
    parts.push(`Tool A output (what teacher got from external tool):\n${input.tool_a_output.slice(0, 800)}`)
    parts.push('')
  }
  if (input.tool_b_output?.trim()) {
    parts.push(`Tool B output (what teacher got from EduNexus or classroom):\n${input.tool_b_output.slice(0, 800)}`)
    parts.push('')
  }
  if (input.comparison_notes?.trim()) {
    parts.push(`Teacher's comparison notes:\n${input.comparison_notes}`)
    parts.push('')
  }
  if (input.self_scores && Object.keys(input.self_scores).length > 0) {
    const scoreLines = Object.entries(input.self_scores)
      .map(([k, v]) => `  ${k}: ${v}/5`)
      .join('\n')
    parts.push(`Teacher's self-scores:\n${scoreLines}`)
  }

  parts.push('\nEvaluate this mission submission and return JSON.')
  return parts.join('\n')
}

export async function scoreMissionComparison(
  mission: Pick<AcademyMission, 'title' | 'mission_type' | 'description'>,
  input: MissionInput,
  userId?: string
): Promise<MissionVerdict> {
  const totalWords = [input.tool_a_output, input.tool_b_output, input.comparison_notes]
    .join(' ')
    .trim()
    .split(/\s+/)
    .filter(Boolean).length

  // Too short to evaluate meaningfully — heuristic, not an AI judgement
  if (totalWords < 20) {
    return fallbackVerdict(1)
  }

  const prompt = buildMissionPrompt(mission, input)
  const start = Date.now()
  let raw = ''
  let success = false

  try {
    raw = await callDeepSeek(prompt, MISSION_SYSTEM_PROMPT, {
      temperature: 0.3,
      maxTokens: 400,
    })
    success = true
  } catch (err) {
    await logAICall({
      feature: 'academy-mission-judge',
      model: 'deepseek',
      prompt: prompt.substring(0, 500),
      latencyMs: Date.now() - start,
      success: false,
      error: (err as Error).message,
      userId,
    })
    return fallbackVerdict(totalWords >= 100 ? 3 : 2)
  }

  await logAICall({
    feature: 'academy-mission-judge',
    model: 'deepseek',
    prompt: prompt.substring(0, 500),
    response: raw.substring(0, 500),
    latencyMs: Date.now() - start,
    success,
    userId,
  })

  try {
    const parsed = JSON.parse(raw) as MissionVerdict
    if (
      typeof parsed.ai_score === 'number' &&
      parsed.ai_score >= 1 &&
      parsed.ai_score <= 5 &&
      typeof parsed.ai_verdict === 'string' &&
      typeof parsed.key_insight === 'string' &&
      typeof parsed.suggested_next_action === 'string'
    ) {
      return {
        ai_score: parsed.ai_score as MissionVerdict['ai_score'],
        ai_verdict: parsed.ai_verdict,
        key_insight: parsed.key_insight,
        suggested_next_action: parsed.suggested_next_action,
        isFallback: false,
      }
    }
    await logAICall({
      feature: 'academy-mission-judge',
      model: 'deepseek',
      prompt: prompt.substring(0, 500),
      response: raw.substring(0, 500),
      latencyMs: Date.now() - start,
      success: false,
      error: 'AI response failed shape validation',
      userId,
    })
    return fallbackVerdict(totalWords >= 100 ? 3 : 2)
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : String(e)
    console.error('[aiJudge:judgeMission] JSON parse failed:', message)
    await logAICall({
      feature: 'academy-mission-judge',
      model: 'deepseek',
      prompt: prompt.substring(0, 500),
      response: raw.substring(0, 500),
      latencyMs: Date.now() - start,
      success: false,
      error: `JSON parse failed: ${message}`,
      userId,
    })
    return fallbackVerdict(totalWords >= 100 ? 3 : 2)
  }
}

function fallbackVerdict(score: 1 | 2 | 3 | 4 | 5): MissionVerdict {
  return {
    ai_score: score,
    ai_verdict:
      'Asante, Mwalimu — mission imerekodiwa. Tunaendelea kukagua maoni yako na tutakupa maoni ya kina hivi karibuni.',
    key_insight:
      'Comparing AI tools helps teachers build independent judgement about which outputs are genuinely CBC-aligned.',
    suggested_next_action:
      'Open the EduNexus lesson planner and generate a lesson for the topic you compared. Check if it scores higher on CBC alignment than the generic AI output.',
    isFallback: true,
  }
}
