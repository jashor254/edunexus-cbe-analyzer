// lib/slides/aiSlideGenerator.ts
// Calls DeepSeek to generate structured slide content for a given lesson topic.
import { callDeepSeek } from '@/lib/ai/deepseek'

const TEMPERATURE = 0.7
const MAX_TOKENS  = 4000

export type SlideType = 'title' | 'agenda' | 'content' | 'activity' | 'key_concepts' | 'discussion' | 'summary'

export type SlideContent =
  | { type: 'title';        title: string; subtitle: string; notes: string }
  | { type: 'agenda';       title: string; items: string[]; notes: string }
  | { type: 'content';      title: string; bullets: string[]; detail?: string; notes: string }
  | { type: 'activity';     title: string; instructions: string[]; time_minutes: number; notes: string }
  | { type: 'key_concepts'; title: string; concepts: { term: string; definition: string }[]; notes: string }
  | { type: 'discussion';   title: string; questions: string[]; notes: string }
  | { type: 'summary';      title: string; key_takeaways: string[]; homework?: string; notes: string }

export type GeneratedSlides = {
  presentation_title: string
  subject:            string
  grade:              string
  topic:              string
  slides:             SlideContent[]
}

const SYSTEM_PROMPT = `You are a Kenya CBC curriculum expert and master teacher who creates world-class classroom presentation slides.

Your slides must be:
- Deeply rooted in the Kenya CBC competency-based curriculum
- Age-appropriate and contextually relevant for Kenyan learners
- Engaging, practical, and classroom-ready
- Structured for a 40-minute lesson flow

Return ONLY valid JSON. No markdown. No code blocks. No explanation. Pure JSON only.

SLIDE STRUCTURE RULES:
1. Always start with a title slide
2. Always include an agenda slide (2nd slide)
3. Include 2–4 content slides with clear, concise bullet points (max 5 bullets per slide)
4. Include exactly 1 activity slide with step-by-step instructions
5. Include 1 key concepts slide for vocabulary/definitions
6. Include 1 discussion slide with thought-provoking questions
7. Always end with a summary slide that has homework

CONTENT QUALITY RULES:
- Every bullet point must be a complete, meaningful sentence
- Activity instructions must be practical with classroom materials only
- Key concepts must have clear, student-friendly definitions
- Discussion questions must provoke critical thinking
- Homework must be achievable without internet access
- Embed Kenyan context (local examples, names, places) where natural

SPEAKER NOTES: Every slide must have detailed speaker notes (2–3 sentences) guiding the teacher.`

export async function generateSlideContent(
  subject: string,
  grade: string,
  topic: string,
  slideCount: number,
): Promise<GeneratedSlides> {
  const contentSlideCount = Math.max(2, Math.min(slideCount - 5, 6))

  const prompt = `Generate a complete classroom presentation for:
Subject: ${subject}
Grade: ${grade}
Topic: ${topic}
Total slides: ${slideCount} (fixed structure: 1 title + 1 agenda + ${contentSlideCount} content + 1 activity + 1 key concepts + 1 discussion + 1 summary)

Return this exact JSON structure:
{
  "presentation_title": "string",
  "subject": "${subject}",
  "grade": "${grade}",
  "topic": "${topic}",
  "slides": [
    { "type": "title", "title": "string", "subtitle": "string", "notes": "string" },
    { "type": "agenda", "title": "string", "items": ["string", ...], "notes": "string" },
    // ${contentSlideCount} content slides:
    { "type": "content", "title": "string", "bullets": ["string", ...], "detail": "optional string", "notes": "string" },
    { "type": "activity", "title": "string", "instructions": ["string", ...], "time_minutes": number, "notes": "string" },
    { "type": "key_concepts", "title": "string", "concepts": [{ "term": "string", "definition": "string" }, ...], "notes": "string" },
    { "type": "discussion", "title": "string", "questions": ["string", ...], "notes": "string" },
    { "type": "summary", "title": "string", "key_takeaways": ["string", ...], "homework": "string", "notes": "string" }
  ]
}`

  const raw = await callDeepSeek(prompt, SYSTEM_PROMPT, { temperature: TEMPERATURE, maxTokens: MAX_TOKENS })
  if (!raw) throw new Error('Empty response from AI')

  // Strip any accidental markdown code fences
  const cleaned = raw.replace(/^```(?:json)?\n?/i, '').replace(/\n?```$/i, '').trim()

  const parsed = JSON.parse(cleaned) as GeneratedSlides
  if (!parsed.slides || !Array.isArray(parsed.slides) || parsed.slides.length === 0) {
    throw new Error('AI returned invalid slide structure')
  }

  return parsed
}
