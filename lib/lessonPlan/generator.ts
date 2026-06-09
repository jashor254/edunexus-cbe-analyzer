import type { LessonPlanContext, GeneratedLessonPlan } from './types'
import { isKiswahiliSubject, isSocialStudies } from '@/lib/curriculum/subjectUtils'

function parseDeepSeekJSON(raw: string): Record<string, unknown> {
  const cleaned = raw
    .replace(/^```json\s*/i, '')
    .replace(/^```\s*/i, '')
    .replace(/```\s*$/i, '')
    .trim()
  return JSON.parse(cleaned) as Record<string, unknown>
}

async function callDeepSeek(prompt: string): Promise<string> {
  const response = await fetch('https://api.deepseek.com/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${process.env.DEEPSEEK_API_KEY}`,
    },
    body: JSON.stringify({
      model: 'deepseek-chat',
      messages: [
        {
          role: 'system',
          content:
            'You are an experienced Kenyan CBC teacher. ' +
            'Return ONLY valid JSON. No markdown. No explanation. No code blocks. Pure JSON only.',
        },
        { role: 'user', content: prompt },
      ],
      temperature: 0.3,
      max_tokens: 2000,
    }),
  })

  if (!response.ok) {
    throw new Error(`DeepSeek API error: ${response.status} ${response.statusText}`)
  }

  const data = await response.json()
  return data.choices[0].message.content
}

function buildLessonPlanPrompt(ctx: LessonPlanContext): string {
  const outcomes = ctx.learningOutcomes
  const questions = ctx.keyInquiryQuestions

  const languageInstruction = isKiswahiliSubject(ctx.learningArea)
    ? `
LUGHA YA MAUDHUI:
Andika maudhui YOTE ya mpango huu wa somo kwa KISWAHILI SANIFU.
Hii inajumuisha: utangulizi, hatua za mafunzo, hitimisho, shughuli za ziada,
maswali ya uchunguzi, na maelezo ya mpangilio wa kujifunza.
Tumia Kiswahili fasaha na sahihi kinachofaa kwa wanafunzi wa CBC Kenya.
Hata maneno ya kitaalamu yaandikwe kwa Kiswahili katika somo hili.
`
    : `Write all lesson plan content in English.`

  const resourceInstruction = isSocialStudies(ctx.learningArea)
    ? `
RESOURCES — SOCIAL STUDIES RULES:
Suggest ONLY resources immediately available in a typical Kenyan classroom.
ALLOWED: textbooks (e.g. "KLB Social Studies Grade 9"), charts, maps, atlas, globe,
photographs/pictures, newspaper clippings, video clips (if projector available),
flashcards, locally available objects (soil, seeds, coins), whiteboard and markers.
STRICTLY AVOID: field trips to named places, live guest speakers/resource persons,
visits to offices/courts/factories, any activity requiring leaving school or advance booking.
If a concept relates to a place (e.g. Great Rift Valley), use:
"Map of Kenya showing the Rift Valley" or "Photographs of the Great Rift Valley" — NOT "Visit the Rift Valley".
`
    : ''

  const organisationHint = ctx.learningArea.toLowerCase().includes('practical') ||
    ctx.strand?.toLowerCase().includes('practical')
    ? 'practical'
    : ctx.strand?.toLowerCase().includes('discuss') ? 'discussion' : 'standard'

  const reflectionTemplate = organisationHint === 'practical'
    ? `Learners engaged well with the practical activity. The hands-on approach helped clarify ${ctx.subStrand}. Some learners struggled with [specific step] — will provide more guided practice next week.`
    : organisationHint === 'discussion'
    ? `Class discussion was lively and learners demonstrated good understanding of ${ctx.subStrand}. Participation was satisfactory. Will allocate more time to this concept in the upcoming lessons.`
    : `The lesson was taught as planned. Most learners understood the core concepts. A few learners will need additional time to fully grasp ${ctx.subStrand}. Will revisit in the next lesson.`

  return `
You are an experienced Kenyan CBC teacher writing a lesson plan for a TSC inspection.

LESSON CONTEXT (from Scheme of Work):
Learning Area: ${ctx.learningArea}
Grade: ${ctx.grade}
Strand: ${ctx.strand}
Sub-Strand: ${ctx.subStrand}
Term: ${ctx.term}, Year: ${ctx.year}
Week: ${ctx.weekNumber}, Lesson: ${ctx.lessonNumber}

${languageInstruction}
${resourceInstruction}
SPECIFIC LEARNING OUTCOMES (already set):
a) ${outcomes[0] || ''}
b) ${outcomes[1] || ''}
c) ${outcomes[2] || ''}

KEY INQUIRY QUESTIONS (already set):
1. ${questions[0] || ''}
2. ${questions[1] || ''}
3. ${questions[2] || ''}

LEARNING RESOURCES: ${ctx.learningResources.join(', ')}

Generate ONLY these sections as JSON:
{
  "organisationOfLearning": "Brief note on grouping/seating arrangement",
  "introduction": "5-minute set induction. Review previous lesson, connect to new topic. 2-3 specific teacher actions/questions.",
  "step1": "10 minutes. Guided discovery activity. What teacher does, what learners do. Specific and practical for ${ctx.learningArea}.",
  "step2": "10 minutes. Group/pair activity. Learners apply concept. Teacher role during this step.",
  "step3": "10 minutes. Individual application or class discussion. Assessment moment. Links to learning outcomes.",
  "conclusion": "5 minutes. Summarize key points. Brief formative check. Preview next lesson.",
  "extendedActivities": "2-3 activities for fast finishers OR homework tasks that extend learning beyond the classroom.",
  "reflection": "A realistic 2-sentence teacher self-evaluation. Base it on this template but replace bracketed parts with real content from this lesson: ${reflectionTemplate}"
}

RULES:
- CBC learner-centered approach
- Use Kenyan context and local examples
- No Core Competencies section needed
- No Values/PCIs section needed
- Steps must directly address the learning outcomes
- Each step: clear teacher actions + learner actions
- reflection must sound like a real teacher wrote it — specific, not generic
- Return ONLY valid JSON, no markdown
`
}

export async function generateLessonPlan(
  ctx: LessonPlanContext
): Promise<GeneratedLessonPlan> {
  const prompt = buildLessonPlanPrompt(ctx)

  let lastError = ''
  for (let attempt = 0; attempt < 3; attempt++) {
    let raw: string
    try {
      raw = await callDeepSeek(prompt)
    } catch (err: unknown) {
      lastError = err instanceof Error ? err.message : 'Unknown AI error'
      continue
    }

    let parsed: Record<string, unknown>
    try {
      parsed = parseDeepSeekJSON(raw)
    } catch {
      lastError = 'Invalid JSON from AI'
      continue
    }

    if (
      parsed.organisationOfLearning &&
      parsed.introduction &&
      parsed.step1 &&
      parsed.step2 &&
      parsed.step3 &&
      parsed.conclusion &&
      parsed.extendedActivities
    ) {
      // reflection is optional in response — fall back to template if missing
      const reflection = typeof parsed.reflection === 'string' && parsed.reflection.trim()
        ? parsed.reflection
        : `The lesson on ${ctx.subStrand} was taught as planned. Most learners achieved the intended outcomes. Will revisit any gaps in the next lesson.`

      return {
        context: ctx,
        organisationOfLearning: String(parsed.organisationOfLearning),
        introduction: String(parsed.introduction),
        step1: String(parsed.step1),
        step2: String(parsed.step2),
        step3: String(parsed.step3),
        conclusion: String(parsed.conclusion),
        extendedActivities: String(parsed.extendedActivities),
        reflection,
        generatedAt: new Date().toISOString(),
      }
    }
    lastError = 'Missing required fields in AI response'
  }

  throw new Error(`Lesson plan generation failed after 3 attempts: ${lastError}`)
}

// ─── Reflection suggestions ──────────────────────────────────────────────────

function generateFallbackReflection(ctx: LessonPlanContext, variant: number): string {
  const subject = ctx.learningArea.toLowerCase()
  const subStrand = ctx.subStrand
  const outcome = ctx.learningOutcomes[0] || 'the lesson objective'

  const variants: Record<string, string[]> = {
    kiswahili: [
      `Wanafunzi wengi walifaulu ${outcome} wakati wa somo. Baadhi ya wanafunzi walihitaji msaada zaidi katika ${subStrand} — nitawapa msaada wa ziada katika somo lijalo.`,
      `Somo la ${subStrand} lilifanyika vizuri. Wanafunzi walishiriki kikamilifu katika mazungumzo. Mazoezi zaidi ya uandishi yanahitajika katika somo lijalo.`,
      `Ushiriki wa wanafunzi ulikuwa mzuri katika somo la ${subStrand}. Wanafunzi wachache walihitaji msaada zaidi — nitawapanga vikundi ili wanafunzi wazuri wawasaidie wenzao.`,
    ],
    agriculture: [
      `Most learners were able to ${outcome} with reasonable accuracy during the practical session. A few learners needed additional guidance on the hands-on activity — will provide follow-up support in the next lesson.`,
      `The lesson on ${subStrand} was well received. Learners demonstrated understanding through group discussions and practical work. Recommend more practice on application to real farm situations.`,
      `Learner participation was high during the ${subStrand} activity. Mixed outcomes noted — stronger learners grasped the concept quickly while others require remediation. Peer teaching to be used next lesson.`,
    ],
    mathematics: [
      `Majority of learners were able to ${outcome} independently by end of lesson. Some learners still struggling with procedural steps — will assign extra practice problems for reinforcement.`,
      `The lesson objective on ${subStrand} was largely achieved. Learners engaged well with the problem-solving activities. More practice needed on application to word problems.`,
      `Good engagement during ${subStrand} lesson. About one-third of the class requires additional support with calculations. Will revisit key steps in the next lesson introduction.`,
    ],
    english: [
      `Learners demonstrated ability to ${outcome} with growing confidence. Reading fluency varied across the class — will continue to support weaker readers through paired reading activities.`,
      `The ${subStrand} lesson was productive. Most learners participated actively in discussion. Written expression still needs improvement — will incorporate more writing practice next lesson.`,
      `Engaging lesson on ${subStrand}. Stronger learners excelled in comprehension tasks while some struggled with vocabulary. Vocabulary wall to be updated and reviewed regularly.`,
    ],
  }

  const subjectKey = Object.keys(variants).find(k => subject.includes(k))

  if (!subjectKey) {
    const defaults = [
      `The lesson on ${subStrand} was successfully delivered. Most learners achieved the intended outcomes. A few learners need follow-up support — to be addressed in the next lesson.`,
      `Learners engaged well with ${subStrand}. The lesson objective was largely met. Additional practice recommended to consolidate understanding of key concepts.`,
      `Good participation noted during the ${subStrand} lesson. Mixed outcomes across ability groups. Stronger learners to assist weaker ones through peer learning next session.`,
    ]
    return defaults[variant - 1] || defaults[0]
  }

  return variants[subjectKey][variant - 1] || variants[subjectKey][0]
}

export async function generateReflectionSuggestions(
  context: LessonPlanContext,
  taughtDate: string
): Promise<string[]> {
  const fallback = [
    generateFallbackReflection(context, 1),
    generateFallbackReflection(context, 2),
    generateFallbackReflection(context, 3),
  ]

  const reflectionLanguage = isKiswahiliSubject(context.learningArea)
    ? 'Write all 3 reflection options in Kiswahili (Kiswahili sanifu).'
    : 'Write all 3 reflection options in English.'

  const prompt = `
You are a Kenyan CBC teacher writing lesson reflection notes for a TSC inspection.

LESSON TAUGHT:
Learning Area: ${context.learningArea}
Grade: ${context.grade}
Strand: ${context.strand}
Sub-strand: ${context.subStrand}
Learning Outcomes:
  a) ${context.learningOutcomes[0] || ''}
  b) ${context.learningOutcomes[1] || ''}
  c) ${context.learningOutcomes[2] || ''}

${reflectionLanguage}

Generate 3 DIFFERENT reflection options.
Each should be 2-3 sentences.
Each must be DIFFERENT in tone and content.
All must be subject-specific to ${context.learningArea}.

REFLECTION TYPES:
Option 1 — Mostly successful with minor gap:
  Mention what went well + one area needing follow-up

Option 2 — Objective achieved, practice needed:
  Lesson completed + recommend more practice on specific concept

Option 3 — Engaged learners, mixed outcomes:
  Learner engagement + some struggled + remediation plan

RULES:
- Never say just "Done" or "Lesson completed"
- Use subject-specific language:
  Agriculture → crops, practical, farm, soil, pests
  Mathematics → calculations, problem-solving, equations
  English → comprehension, expression, vocabulary
  Biology → organisms, experiments, specimens
  Chemistry → reactions, experiments, lab work
  Physics → experiments, measurements, practical
  History → events, analysis, discussion
  Geography → mapping, fieldwork, environment
  Kiswahili → mazungumzo, uandishi, usomaji
- Mention specific learning outcomes achieved
- Mention learner responses/challenges
- Sound like a real teacher — not AI generated
- Each option MUST be different from the others

Return JSON only:
{
  "suggestions": [
    "Option 1 text here...",
    "Option 2 text here...",
    "Option 3 text here..."
  ]
}
`

  let raw: string
  try {
    raw = await callDeepSeek(prompt)
  } catch {
    return fallback
  }

  try {
    const parsed = parseDeepSeekJSON(raw)
    const suggestions = parsed.suggestions
    if (Array.isArray(suggestions) && suggestions.length === 3) {
      return suggestions as string[]
    }
  } catch {
    // fall through to fallback
  }

  return fallback
}
