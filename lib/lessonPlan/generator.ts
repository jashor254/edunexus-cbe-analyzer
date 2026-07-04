import type { LessonPlanContext, GeneratedLessonPlan } from './types'
import { isKiswahiliSubject, isPlaceBasedSubject, getSubjectContextHint } from '@/lib/curriculum/subjectUtils'

const KENYAN_COUNTIES = [
  'Nairobi', 'Mombasa', 'Kisumu', 'Nakuru', 'Eldoret', 'Kisii', 'Machakos',
  'Nyeri', 'Garissa', 'Turkana', 'Kakamega', 'Meru', 'Embu', 'Kitale',
  'Malindi', 'Lamu', 'Isiolo', 'Nanyuki', 'Kericho', 'Bomet', 'Migori',
  'Homabay', 'Siaya', 'Bungoma', 'Busia', 'Kilifi', 'Kwale', 'Kajiado',
  'Narok', 'Baringo', 'Nandi', 'Uasin Gishu', 'Laikipia', 'Kirinyaga',
  'Murang\'a', 'Kiambu', 'Makueni', 'Kitui', 'Marsabit', 'Wajir', 'Mandera',
]

function pickDistinctCounties(n: number): string[] {
  const shuffled = [...KENYAN_COUNTIES].sort(() => Math.random() - 0.5)
  return shuffled.slice(0, n)
}

function pickTopicCounties(strand: string, learningArea: string): [string, string, string] {
  const text = (strand + ' ' + learningArea).toLowerCase()

  if (/drought|arid|semi.arid|pastoralist|camel|asal/.test(text)) {
    return ['Kitui', 'Marsabit', 'Garissa']
  }
  if (/flood|rain|river|lake|fishing|nyanza|wetland/.test(text)) {
    return ["Budalang'i", 'Kisumu', 'Homa Bay']
  }
  if (/farm|agricult|crop|soil|maize|wheat|tea|coffee|harvest/.test(text)) {
    return ['Uasin Gishu', 'Trans Nzoia', 'Nyeri']
  }
  if (/coast|ocean|marine|mangrove|beach|port|tourism/.test(text)) {
    return ['Mombasa', 'Kilifi', 'Kwale']
  }
  if (/forest|wildlife|conserv|national park|game|biodiversity/.test(text)) {
    return ['Narok', 'Laikipia', "Murang'a"]
  }
  if (/urban|city|trade|market|industry|manufacturing/.test(text)) {
    return ['Nairobi', 'Nakuru', 'Kisumu']
  }

  const [a, b, c] = pickDistinctCounties(3)
  return [a, b, c]
}

function sanitizeResource(resource: string): string {
  return resource
    .replace(/\s*,?\s*pages?\s+on\s+[^,;]*/gi, '')
    .replace(/\s*,?\s*pp\.\s*[\d–-]+\s+on\s+[^,;]*/gi, '')
    .replace(/\s*,?\s*p\.\s*\d+\s+on\s+[^,;]*/gi, '')
    .replace(/,\s*$/, '')
    .replace(/Grade\s+Grade\s+(\d+)/gi, 'Grade $1')
    .trim()
}

function sanitizeResources(resources: string[]): string[] {
  return resources.map(sanitizeResource).filter(r => r.length > 0)
}

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

function deriveLocation(learningArea: string, grade: string, strand = ''): string {
  const area  = learningArea.toLowerCase()
  const topic = strand.toLowerCase()
  const gradeNum = parseInt(grade.replace(/\D/g, ''), 10)
  const isSenior = gradeNum >= 10 && gradeNum <= 12

  if (area.includes('physical education') || area.includes(' pe ') || area === 'pe') {
    return 'School grounds / playing field'
  }

  if (area.includes('agriculture')) {
    const practical = /farm|soil|planting|crop|harvest|compost|irrigation|nursery|garden|pruning|weeding/.test(topic)
    return practical ? 'School farm / garden' : 'Classroom'
  }

  if (area.includes('home science') || area.includes('home economics')) {
    return 'Home Science room'
  }

  if (area.includes('music')) {
    return 'Music room / classroom'
  }

  if (area.includes('art') || area.includes('craft') || area.includes('creative arts')) {
    return 'Art room / classroom'
  }

  if (
    isSenior &&
    (area.includes('biology') || area.includes('chemistry') || area.includes('physics'))
  ) {
    return 'Laboratory'
  }

  if (area.includes('integrated science') && /experiment|practical|lab|dissect|observe|test/.test(topic)) {
    return 'Laboratory / classroom'
  }

  return 'Classroom'
}

function buildLessonPlanPrompt(ctx: LessonPlanContext): string {
  const outcomes = ctx.learningOutcomes
  const questions = ctx.keyInquiryQuestions
  const experiences = ctx.learningExperiences ?? []

  const location = deriveLocation(ctx.learningArea, ctx.grade, ctx.strand)
  const resources = sanitizeResources(ctx.learningResources)
  const placeBased = isPlaceBasedSubject(ctx.learningArea)
  const [county1, county2, county3] = placeBased
    ? pickTopicCounties(ctx.strand, ctx.learningArea)
    : ['', '', '']

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

SPECIFIC LEARNING OUTCOMES (already set):
a) ${outcomes[0] || ''}
b) ${outcomes[1] || ''}
c) ${outcomes[2] || ''}

KEY INQUIRY QUESTIONS (already set):
1. ${questions[0] || ''}
2. ${questions[1] || ''}
3. ${questions[2] || ''}

SOW LEARNING EXPERIENCES (steps MUST be built from these — do not invent new activities):
Step 1 activity: ${experiences[0] || ''}
Step 2 activity: ${experiences[1] || ''}
Step 3 activity: ${experiences[2] || ''}

LEARNING RESOURCES: ${resources.join(', ')}

LEARNER-CENTERED RULE — READ THIS FIRST, APPLIES TO EVERY FIELD:
CBC is LEARNER-CENTERED. Learners are ALWAYS the subject of every sentence.
The teacher ONLY guides, prompts, or facilitates — never the main actor.

BANNED phrases (never use these as a sentence subject):
  ✗ "The teacher reads..."
  ✗ "The teacher demonstrates..."
  ✗ "The teacher distributes..."
  ✗ "The teacher explains..."
  ✗ "The teacher writes..."
  ✗ "The teacher asks..."

CORRECT pattern — learners act, teacher supports:
  ✓ "Learners read a printed case study in pairs and identify key triggers."
  ✓ "Learners share their findings as the teacher records key points on the board."
  ✓ "Learners work through a sample problem and explain each step aloud."
  ✓ "Learners discuss in groups then present one trigger to the class."
  ✓ "Learners respond to the prompt: 'Have you ever seen a land dispute?'"

Generate ONLY these sections as JSON:
{
  "organisationOfLearning": "${location} — [brief note on grouping: pairs, groups of 4, whole class]",
  "introduction": "5-minute set induction. Learners respond to an opening question linked to prior learning, then predict or share ideas about the new topic. The teacher only poses the question and guides — learners speak and act.",
  "step1": "10 minutes. Learners carry out the SOW activity: '${experiences[0] || ''}'. Write ONLY what LEARNERS do. Keep the same activity type and Kenyan context. Teacher role: prompt questions only.",
  "step2": "10 minutes. Learners carry out the SOW activity: '${experiences[1] || ''}'. Write ONLY what LEARNERS do. Keep the same activity type and Kenyan context. Teacher role: circulate and guide only.",
  "step3": "10 minutes. Learners carry out the SOW activity: '${experiences[2] || ''}'. Write ONLY what LEARNERS do. Keep the same activity type and Kenyan context. Teacher role: facilitate sharing only.",
  "conclusion": "5 minutes. Learners summarize the key lesson points. Learners answer 1-2 quick oral questions to check understanding. Teacher previews the next lesson.",
  "extendedActivities": "EXACTLY 3 bullet points. Each bullet is one standalone activity a learner can do at home independently. Start each with a verb: Draw, Write, Interview, Research, Observe, Create, Ask, Find. Never use numbered lists. Never write as a paragraph. Format as: '- [verb] [activity]\\n- [verb] [activity]\\n- [verb] [activity]'",
  "reflection": "Were learners able to ${outcomes[0] || '[outcome a]'}? Were learners able to ${outcomes[1] || '[outcome b]'}? Were learners able to ${outcomes[2] || '[outcome c]'}? If not, how will you assist them in the next lesson?"
}

ADDITIONAL RULES:
- Steps 1, 2, 3 MUST use the same activity type from the SOW experiences above — do not substitute or invent new ones
- The reflection field must be output exactly as the guiding questions shown above — do not rewrite it
- Return ONLY valid JSON, no markdown

${placeBased ? `KENYAN CONTEXT — MANDATORY:
Each step is pre-assigned a DIFFERENT specific Kenyan location. Use ONLY these — no swaps, no extras, no repeats:
- step1: "${county1}"
- step2: "${county2}"
- step3: "${county3}"
Reference counties, towns, rivers, forests, or landmarks a Kenyan learner would recognize.
Match the place to the topic — drought topics use ASAL counties (Kitui, Marsabit, Garissa), flood topics use western Kenya (Budalang'i, Kisumu, Homa Bay), farming topics use highlands (Nyeri, Uasin Gishu, Trans Nzoia).
Never use generic "a community" or "a county in Kenya" — always use the assigned name above.
Do NOT mention any other Kenyan location in any step. Each step uses exactly one location: the one assigned above.` : `CONTEXT GUIDANCE:
${getSubjectContextHint(ctx.learningArea)}
Do NOT force place names or county references into this subject — use subject-relevant real-world examples instead.`}
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
      const reflectionFallback = `Were learners able to ${ctx.learningOutcomes[0] || '[outcome a]'}? Were learners able to ${ctx.learningOutcomes[1] || '[outcome b]'}? Were learners able to ${ctx.learningOutcomes[2] || '[outcome c]'}? If not, how will you assist them in the next lesson?`
      const reflection = typeof parsed.reflection === 'string' && parsed.reflection.trim()
        ? parsed.reflection
        : reflectionFallback

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
