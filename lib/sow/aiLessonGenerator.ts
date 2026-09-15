// lib/sow/aiLessonGenerator.ts
// Generates and validates one lesson at a time via DeepSeek AI.
// Diversity at 5 levels is enforced by injecting DiversitySeed per call.

import { validateLesson } from './validators'
import { isKiswahiliSubject } from '@/lib/curriculum/subjectUtils'
import { callDeepSeek as callAI, type AICostContext } from '@/lib/ai/deepseek'
import type { CurriculumMode } from './types'
import type { DiversitySeed } from './diversityEngine'

const MAX_RETRIES   = 5
const MAX_CONFIDENCE = 0.92
const TEMPERATURE   = 0.65  // raised from 0.2 — low temp was the primary driver of repetition

// ─── Diversity system instruction ─────────────────────────────────────────────

const KISWAHILI_LANGUAGE_RULE = `
LUGHA YA LAZIMA — KISWAHILI SANIFU:
Andika maudhui YOTE ya somo hili kwa Kiswahili Sanifu tu.
Hii inajumuisha: shabaha, shughuli za ufunzaji, maswali dadisi,
mbinu za tathmini, maadili, uwezo wa msingi, na viungo vya PCI.
USITUMIE Kingereza katika sehemu yoyote ya JSON isipokuwa majina ya vitabu.
Maneno ya kitaalamu ya sarufi, fasihi, au lugha yaandikwe kwa Kiswahili.
`

// Kiswahili rules deliberately translate every list the model could echo
// verbatim into JSON output (verb alternatives, assessment method names,
// example sentences) — not just labels. RULE 1's English verb list was
// previously unconditional even when isKiswahili was true, and being
// marked "NON-NEGOTIABLE" it outweighed the Kiswahili-language instruction
// above it, so the model kept producing English verbs regardless.
function getDiversitySystemRulesKiswahili(): string {
  return `Wewe ni mtaalamu wa mtaala wa Kenya unayetayarisha SOMO MOJA kwa ajili ya Mpango wa Kazi (Scheme of Work).
${KISWAHILI_LANGUAGE_RULE}
Rudisha JSON SAHIHI PEKEE. Hakuna markdown. Hakuna maelezo. Hakuna vizuizi vya msimbo. JSON safi pekee.

KANUNI ZA UTOFAUTI — SI ZA KUJADILIWA:

KANUNI 1 — UTOFAUTI WA VITENZI
Usitumie kitenzi kile kile cha kuanzia katika masomo mfululizo.
Mbadala wa Kiwango 1: taja, angalia, eleza, fahamia, jaza, kamilisha, orodhesha, panga,
  soma, tambua, tazama, toa, weka, zungumza, andika, onyesha
Mbadala wa Kiwango 2: changanya, eleza kwa kina, fafanua, fuatilia, hakiki, husisha,
  iga, panga upya, rekebisha, tafsiri, tathmini, tunga sentensi, tunga aya, uchanganue,
  wasiliana, linganisha, chambua
Mbadala wa Kiwango 3: buni, linda, onyesha heshima, pendekeza, sisitiza, tathmini umuhimu,
  tetea, thibitisha, thamini, uendeleze, ukuzishe, unga mkono, heshimu urithi, onyesha thamani

KANUNI 2 — UTOFAUTI WA MUUNDO WA MATOKEO
Tumia muundo TOFAUTI wa sentensi kwa kila matokeo ya kujifunza.
Usiandike matokeo matatu yote kwa muundo ule ule.
Zungusha kati ya: Kitendo+Kitu, Kitendo+Jinsi, Kitendo+Ulinganishi, Kitendo+Kusudi,
  Kitendo+Sharti, Kitendo+Hadhira, Kitendo+Kiwango, Thamani/Mtazamo

KANUNI 3 — UTOFAUTI WA MASWALI DADISI
Tumia mianzo TOFAUTI ya maswali kila somo.
Usitumie "Ni nini kingetokea kama..." au "Kwa nini..." katika zaidi ya somo 1 kati ya 4.
Zungusha kati ya: Sababu, Ulinganishi, Tathmini, Kudhania, Uhusiano wa Kibinafsi, Utabiri,
  Uchunguzi, Kihakiki, Kiunganishi, Matumizi, Huria

KANUNI 4 — UTOFAUTI WA SHUGHULI ZA UFUNZAJI
Usianzishe zaidi ya shughuli 1 kati ya 3 mfululizo kwa "Wanafunzi wanafanya kazi kwa vikundi kuangalia na..."
Shughuli ZOTE lazima zifanyike NDANI ya darasa. Hakuna safari za nje, hakuna wageni wa nje,
  hakuna kwenda sehemu nyingine. Hakuna kualika watu wa jamii darasani.
Zungusha miundo ya shughuli: Onyesho, Utatuzi wa matatizo, Uchunguzi kifani, Uigaji,
  Matembezi ya maonyesho, Mdahalo, Jigsaw, Igizo dhima, Fikiri-Jozi-Shiriki,
  Maswali na Majibu, Majadiliano, Kutoa mawazo, Kupanga, Kufundishana wenzao

KANUNI YA URefu — SI YA KUJADILIWA:
Kila shughuli ya ufunzaji = SENTENSI MOJA tu. Maneno 20 kiwango cha juu.
Sentensi wazi pekee — HAKUNA lebo za aina ya shughuli au utangulizi.
MBAYA: "Fikiri-Jozi-Shiriki: Wanafunzi watambue chanzo cha mgogoro wa mpaka Kisumu."
NZURI: "Wanafunzi watambue chanzo cha mgogoro wa mpaka kwa kutumia uchunguzi kifani wa Kisumu."

KANUNI YA RAMANI — SI YA KUJADILIWA:
Usitaje ramani mahususi ya jiji ambayo mwalimu hawezi kupata (mfano "ramani ya Kisumu", "ramani ya Nairobi").
Tumia maneno ya jumla pekee: "ramani ya mfano ya topografia", "ramani iliyochapishwa", "mchoro wa ramani ubaoni".

KANUNI 5 — UTOFAUTI WA TATHMINI — MUHIMU
Masomo mawili mfululizo hayapaswi kutumia mchanganyiko ule ule wa mbinu za tathmini.
Kila somo lazima litumie mbinu TATU HASA. Zungusha kutoka kwenye orodha hii:
  - Tiketi ya kutoka (swali moja lililolengwa linalojibiwa binafsi kabla ya kutoka)
  - Tathmini ya wenzao (wanafunzi wanatathmini kazi za wenzao kwa vigezo walivyopewa)
  - Kiwango cha kujitathmini (kiwango cha 1-4 kwenye uwezo muhimu)
  - Kipengele cha kwenye jalada (mwanafunzi anaongeza ushahidi wa ujifunzaji kwenye jalada)
  - Maswali ya mdomo yenye mawazo ya kina
  - Onyesho la vitendo linalotathminiwa kwa rubric
  - Jaribio fupi (maswali 3-5) kuhusu dhana kuu
  - Tafakari ya maandishi (nilichojifunza + swali moja bado ninalotaka kujibiwa)
  - Orodha ya uchunguzi (mwalimu anaangalia tabia mahususi wakati wa shughuli)
  - Uwasilishaji wa kikundi unaotathminiwa na darasa
  - Tathmini ya mdahalo (hoja iliyopangwa kuhusu mada)
  - Zoezi la maandishi (kazi binafsi ya kuimarisha maudhui ya somo)
KAMWE usirudie mbinu ile ile moja katika masomo mfululizo.
Sambaza mbinu zote 12 katika mpango mzima. Hakuna mbinu inayopaswa kutokea zaidi ya mara moja kila masomo 4.

KANUNI YA MUKTADHA WA KIKENYA:
Kila shughuli ya ufunzaji LAZIMA utaje angalau sehemu, zao, jamii, au desturi mahususi ya Kenya —
lakini kama mifano ya MAJADILIANO darasani pekee, si kama mahali linalotembelewa kimwili.
Sahihi: "Wanafunzi wanajadili jinsi wakulima wa mahindi katika Bonde la Ufa wanavyodhibiti mmomonyoko wa udongo"
Sahihi: "Wanafunzi wanachanganua desturi za biashara sokoni Gikomba kwa kutumia kadi za uchunguzi kifani"
MBAYA: "Wanafunzi wanatembelea soko la Gikomba" / "Mwalike mzee wa jamii darasani"

KANUNI YA NYENZO — SI YA KUJADILIWA:
Toa nyenzo TATU HASA. Si zaidi, si pungufu.
Mfumo: jina safi pekee — hakuna nambari za ukurasa, hakuna maelezo, hakuna mistari, hakuna maandishi ya ziada.
1. "[Jina la kitabu]"
2. "Mwongozo wa Mwalimu wa [Somo] [Nambari ya Gredi pekee — mfano 8, si Gredi 8]"
3. "[Kitu kimoja cha darasani: chati / mchoro ubaoni / kipande cha gazeti / kifaa halisi]"
KAMWE: nambari za ukurasa, maelezo baada ya jina, watu rasilimali wa jamii,
  matembezi shambani, kanda za redio, ramani za serikali, vifaa vilivyonunuliwa, rasilimali za mtandaoni.`
}

function getDiversitySystemRules(isKiswahili: boolean): string {
  if (isKiswahili) return getDiversitySystemRulesKiswahili()

  return `You are a Kenya curriculum expert producing ONE lesson for a Scheme of Work.
Return ONLY valid JSON. No markdown. No explanation. No code blocks. Pure JSON only.

DIVERSITY RULES — NON-NEGOTIABLE:

RULE 1 — VERB DIVERSITY
Never use the same opening verb in consecutive lessons.
Level 1 alternatives: classify, locate, select, match, recall, name, label, record,
  collect, observe, count, trace, outline, give, read, sort, copy, mark, find, show,
  detect, measure, sketch, note, draw, examine, list, describe, identify, state
Level 2 alternatives: analyze, compare, contrast, apply, calculate, construct, convert,
  deduce, determine, differentiate, discuss, estimate, experiment, formulate, illustrate,
  infer, interpret, investigate, justify, measure, model, predict, relate, research,
  review, sequence, simulate, solve, summarize, test, verify, explain, demonstrate
Level 3 alternatives: advocate, assess, collaborate, compose, create, critique, design,
  develop, evaluate, generalize, implement, integrate, organize, plan, produce, promote,
  propose, protect, reflect, synthesize, validate, value, defend, generate, appreciate

RULE 2 — OUTCOME STRUCTURE DIVERSITY
Use a DIFFERENT sentence structure for each learning outcome.
Never write all three outcomes with the same shape.
Rotate through: Action+Object, Action+How, Action+Comparison, Action+Purpose,
  Action+Condition, Action+Audience, Action+Standard, Value/Attitude

RULE 3 — INQUIRY QUESTION DIVERSITY
Use DIFFERENT question starters each lesson.
Never use "What would happen if..." or "Why is..." in more than 1 of every 4 lessons.
Rotate: Causal, Comparative, Evaluative, Hypothetical, Personal, Predictive,
  Investigative, Critical, Connective, Application, Open

RULE 4 — LEARNING EXPERIENCE DIVERSITY
Never start more than 1 in 3 consecutive experiences with "Learners work in groups to observe and..."
ALL activities MUST happen INSIDE the classroom. No field trips, no external visitors,
  no going to other locations. No inviting community members to class.
Rotate activity structures: Demonstration, Problem-solving, Case study, Simulation,
  Gallery walk, Debate, Jigsaw, Role play, Think-Pair-Share, Question and Answer,
  Discussion, Brainstorming, Sorting, Peer teaching

LENGTH RULE — NON-NEGOTIABLE:
Each learning experience = ONE sentence only. Maximum 20 words.
Plain sentence only — NO activity-type labels or prefixes.
WRONG: "Think-Pair-Share: Learners identify conflict triggers from a Kisumu boundary dispute."
RIGHT: "Learners identify conflict triggers from a boundary dispute case study in Kisumu."

MAP RULE — NON-NEGOTIABLE:
Never reference a specific city map a teacher cannot access (e.g. "map of Kisumu", "Nairobi map", "map of Mombasa").
Use generic terms only: "a sample topographical map", "a printed map", "a hand-drawn map", "a blackboard sketch map".

RULE 5 — ASSESSMENT DIVERSITY — CRITICAL
No two consecutive lessons may use the same assessment method combination.
Each lesson must use EXACTLY 3 methods. Rotate continuously from this list:
  - Exit ticket (one targeted question answered individually before leaving)
  - Peer assessment (learners evaluate each other using given criteria)
  - Self-assessment rating scale (1–4 scale on key competencies)
  - Portfolio entry (learner adds evidence of learning to their portfolio)
  - Oral questioning using higher-order prompts
  - Practical demonstration assessed against rubric
  - Short quiz (3–5 questions on key concepts)
  - Written reflection (what I learned + one question I still have)
  - Observation checklist (teacher observes specific behaviors during activity)
  - Group presentation scored by class
  - Debate assessment (structured argument on topic)
  - Written exercise (individual task consolidating lesson content)
NEVER repeat the same single method in back-to-back lessons.
Distribute all 12 methods across the full scheme. No method should appear more than once every 4 lessons.

KENYAN CONTEXT RULE:
Every learning experience MUST reference at least one specific Kenyan location, crop,
community, or practice — but as classroom DISCUSSION EXAMPLES only, never as physical visits.
Correct: "Learners discuss how maize farmers in the Rift Valley manage soil erosion"
Correct: "Learners analyse trade practices at Gikomba market using case study cards"
WRONG:   "Learners visit Gikomba market" / "Invite a local elder to class"

RESOURCE RULE — NON-NEGOTIABLE:
Output EXACTLY 3 resources. No more, no fewer.
Format: clean name only — no page numbers, no descriptions, no dashes, no extra text.
1. "[Textbook name]"
2. "Teacher's Guide for [Subject] [Grade number only — e.g. 8, not Grade 8]"
3. "[One classroom item: chart / blackboard diagram / newspaper cutout / real object]"
NEVER: page numbers, "pp.", descriptions after the name, community resource persons,
  farm visits, radio recordings, government maps, purchased materials, internet resources.`
}

// ─── AI call — routes through shared lib/ai/deepseek.ts ─────────────────────

function callSowAI(prompt: string, isKiswahili = false, costContext?: AICostContext): Promise<string> {
  return callAI(prompt, getDiversitySystemRules(isKiswahili), {
    temperature: TEMPERATURE,
    maxTokens:   1200,
    costContext,
  })
}

// ─── Prompt builder ──────────────────────────────────────────────────────────

function buildLessonPrompt({
  learningArea,
  grade,
  strand,
  substrand,
  lessonNumber,
  totalLessons,
  curriculumMode,
  subjectType = 'default',
  previousVerbs,
  diversitySeed,
  kicdContext,
  textbook,
}: {
  learningArea:   string
  grade:          string
  strand:         string
  substrand:      string
  lessonNumber:   number
  totalLessons:   number
  curriculumMode: CurriculumMode
  subjectType?:   string
  previousVerbs?: string[]
  diversitySeed?: DiversitySeed
  textbook?:      string
  kicdContext?: {
    subjectData:  Record<string, Record<string, unknown>>
    strandData:   Array<{ title: string; kicd_data: Record<string, unknown>[] }>
    subtopicMap?: Record<string, string[]>
  }
}, retryNote = ''): string {

  const isCBC       = curriculumMode.startsWith('cbc')
  const isKiswahili = isKiswahiliSubject(learningArea)
  const isMaths     = subjectType === 'mathematics' || subjectType === 'cbc_senior_mathematics' || subjectType === 'kcse_mathematics'
  // Strip "Grade " / "Form " prefix from grade if it's already there, to avoid "Grade Grade 8"
  const gradeNum = grade.replace(/^(?:Grade|Form)\s+/i, '')


  // KICD context sections
  const subtopics = kicdContext?.subtopicMap?.[strand]
  const subtopicsSection = subtopics?.length
    ? `\nSYLLABUS CONTENT (distribute across ${totalLessons} lessons):\n${subtopics.join(' | ')}\nLesson ${lessonNumber} covers points ${lessonNumber}–${Math.min(lessonNumber + 1, subtopics.length)}.\n`
    : ''

  const kicdStrand = kicdContext?.strandData
    ?.find(s => s.title.toLowerCase().includes(strand.toLowerCase().slice(0, 10)))
  const kicdSection = kicdStrand?.kicd_data?.length
    ? `\nOFFICIAL KICD CONTENT (use as base, adapt language):\n${JSON.stringify(kicdStrand.kicd_data[0], null, 2)}\n`
    : ''

  // Curriculum-mode descriptors
  const curriculumContext = isCBC
    ? 'Kenya CBC — Competency-Based, learner-centered, inquiry-driven, no marks/exams, real Kenyan examples'
    : 'Kenya 8-4-4 KCSE — Content mastery, exam-oriented, past-paper style questions, KCSE marking awareness'

  // ── Outcome instructions ────────────────────────────────────────────────────
  // Use seed verbs when available; fall back to broad verb groups.
  const seed = diversitySeed

  const verbAvoidLine = previousVerbs && previousVerbs.length > 0
    ? `VERBS ALREADY USED — do NOT start any outcome with: ${previousVerbs.slice(-15).join(', ')}`
    : 'First lesson — choose freely, but avoid starting all outcomes with the same verb.'

  let outcomeBlock: string

  if (isKiswahili) {
    const l1 = seed?.outcomePattern.l1 ?? 'taja'
    const l2 = seed?.outcomePattern.l2 ?? 'eleza'
    const l3 = seed?.outcomePattern.l3 ?? 'tathmini'
    outcomeBlock = `
SHABAHA — KISWAHILI:
Andika matokeo MATATU kwa Kiswahili Sanifu katika mpangilio huu wa utambuzi:
a) KIWANGO 1 (maarifa/ufahamu) — anza na: "${l1}" au kitenzi kingine sawa cha kiwango 1
   mfano: "${l1} sifa za ${substrand} katika muktadha wa Kenya"
b) KIWANGO 2 (ufahamu/matumizi) — anza na: "${l2}" au kitenzi kingine sawa cha kiwango 2
   mfano: "${l2} jinsi ${substrand} inavyotumika katika hali halisi ya Kenya"
c) KIWANGO 3 (maadili/utetezi) — anza na: "${l3}" au kitenzi kingine sawa cha kiwango 3
   mfano: "${l3} umuhimu wa ${substrand} katika jamii au taifa"

Muundo wa sentensi kwa somo hili: ${seed?.outcomePattern.structure ?? 'A'} — tofautisha miundo katika matokeo matatu.
${verbAvoidLine}
`
  } else if (isMaths) {
    const l1 = seed?.outcomePattern.l1 ?? 'identify'
    const l2 = seed?.outcomePattern.l2 ?? 'calculate'
    const l3 = seed?.outcomePattern.l3 ?? 'appreciate'
    outcomeBlock = `
LEARNING OUTCOMES — MATHEMATICS:
Write EXACTLY 3 outcomes in this cognitive progression:
a) LEVEL 1 (knowledge/recall) — start with: "${l1}" or any equivalent Level 1 maths verb
   e.g. "${l1} the properties of ${substrand}"
b) LEVEL 2 (computation/application) — start with: "${l2}" or any equivalent Level 2 maths verb
   e.g. "${l2} problems involving ${substrand}"
c) LEVEL 3 (real-life value) — start with: "${l3}" or any equivalent Level 3 verb
   e.g. "${l3} the use of ${substrand} in everyday Kenyan contexts"

Sentence structure for this lesson: ${seed?.outcomePattern.structure ?? 'A'} — use structure variety across the three outcomes.
${verbAvoidLine}
`
  } else if (isCBC) {
    const l1 = seed?.outcomePattern.l1 ?? 'describe'
    const l2 = seed?.outcomePattern.l2 ?? 'analyze'
    const l3 = seed?.outcomePattern.l3 ?? 'reflect on'
    outcomeBlock = `
LEARNING OUTCOMES — CBC:
Write EXACTLY 3 outcomes in this cognitive progression:
a) LEVEL 1 (knowledge/observation) — start with: "${l1}" or any equivalent Level 1 verb
   e.g. "${l1} the [key aspect] of ${substrand} in a Kenyan context"
b) LEVEL 2 (understanding/application) — start with: "${l2}" or any equivalent Level 2 verb
   e.g. "${l2} how ${substrand} is applied in [real Kenyan situation]"
c) LEVEL 3 (values/advocacy) — start with: "${l3}" or any equivalent Level 3 verb
   e.g. "${l3} the importance of ${substrand} in [community or national context]"

Sentence structure for this lesson: ${seed?.outcomePattern.structure ?? 'A'} — vary structure across the three outcomes.
${verbAvoidLine}
`
  } else {
    // 8-4-4
    const l1 = seed?.outcomePattern.l1 ?? 'state'
    const l2 = seed?.outcomePattern.l2 ?? 'explain'
    const l3 = seed?.outcomePattern.l3 ?? 'evaluate'
    outcomeBlock = `
LEARNING OUTCOMES — 8-4-4 KCSE:
Write EXACTLY 3 specific objectives in this progression:
a) KNOWLEDGE — start with: "${l1}" or any equivalent recall verb
   e.g. "${l1} the [key fact] about ${substrand}"
b) COMPREHENSION/APPLICATION — start with: "${l2}" or any equivalent application verb
   e.g. "${l2} how ${substrand} applies to [KCSE exam context]"
c) EVALUATION/ATTITUDE — start with: "${l3}" or any equivalent higher-order verb
   e.g. "${l3} the significance of ${substrand} in [Kenyan context]"

${verbAvoidLine}
`
  }

  // ── Experience instruction ──────────────────────────────────────────────────
  const classroomRule = isKiswahili
    ? `MUHIMU: Shughuli ZOTE zifanyike NDANI ya darasa pekee.
Hakuna safari za nje, hakuna wageni wa nje, hakuna kwenda sehemu nyingine.
Tumia tu: majadiliano, igizo dhima, fikiri-jozi-shiriki, matembezi ya maonyesho, uchunguzi kifani, kazi ya kikundi, maswali na majibu, mdahalo, maonyesho.
KANUNI YA URefu — SI YA KUJADILIWA: Kila shughuli ya ufunzaji = SENTENSI MOJA tu. Maneno 20 kiwango cha juu.
Usiweke lebo za aina ya shughuli (si "Fikiri-Jozi-Shiriki:", "Maonyesho:", n.k.).
MBAYA: "Fikiri-Jozi-Shiriki: Wanafunzi watambue chanzo cha mgogoro wa mpaka Kisumu."
NZURI: "Wanafunzi watambue chanzo cha mgogoro wa mpaka kwa kutumia uchunguzi kifani wa Kisumu."
KANUNI YA RAMANI: Usitaje ramani mahususi ya jiji. Tumia "ramani ya mfano ya topografia", "ramani iliyochapishwa", au "mchoro wa ramani ubaoni" pekee.
Muktadha wa Kikenya uonekane kama mifano ya majadiliano darasani pekee — si mahali darasa linatembelea kimwili.`
    : `IMPORTANT: All activities happen INSIDE the classroom only.
No field trips, no external visitors, no going to other locations.
Use only: discussion, role play, think-pair-share, gallery walk, case study, group work, Q&A, debate, demonstration.
LENGTH RULE — NON-NEGOTIABLE: Each learning experience = ONE plain sentence only. Maximum 20 words.
No activity-type labels or prefixes (no "Think-Pair-Share:", "Demonstration:", "Pair practice:", etc.).
BAD: "Think-Pair-Share: Learners identify conflict triggers from a Kisumu boundary dispute."
GOOD: "Learners identify conflict triggers from a boundary dispute case study in Kisumu."
MAP RULE: Never name a specific city map. Use "a sample topographical map", "a printed map", or "a blackboard sketch map" only.
Kenyan contexts appear as discussion examples only — not as places the class physically visits.`

  const experienceInstruction = seed
    ? isKiswahili
      ? `SHUGHULI ZA UFUNZAJI — MFUMO ${seed.framework.label}: ${seed.framework.name}
${seed.framework.template}
Badilisha [topic], [location], [context] na maelezo mahususi kutoka: ${substrand}, ${strand}, ${learningArea}
Andika shughuli hii kwa Kiswahili Sanifu.
${classroomRule}`
      : `LEARNING EXPERIENCE FRAMEWORK — ${seed.framework.label}: ${seed.framework.name}
${seed.framework.template}
Replace [topic], [location], [context] with specifics from: ${substrand}, ${strand}, ${learningArea}
${classroomRule}`
    : isKiswahili
      ? `Buni shughuli TATU tofauti za darasani.
${classroomRule}`
      : `Design 3 varied classroom activities.
${classroomRule}`

  // ── Inquiry question instruction ────────────────────────────────────────────
  const questionInstruction = seed
    ? isKiswahili
      ? `MASWALI DADISI — mfumo wa ${seed.questionFrame.name}:
Tumia mianzo HII (rekebisha kulingana na mada), ukiyaandika kwa Kiswahili Sanifu:
  Swali la 1 (mfano wa mwanzo): "${seed.questionFrame.starters[0]}" → tafsiri dhana kwa Kiswahili, mfano "Vipi...", "Kwa nini...", "Je..."
  Swali la 2 (mfano wa mwanzo): "${seed.questionFrame.starters[1]}"
  Swali la 3 (mfano wa mwanzo): "${seed.questionFrame.starters[2]}"`
      : `INQUIRY QUESTIONS — ${seed.questionFrame.name} frame:
Use THESE specific starters (adapt to topic):
  Q1 starter: "${seed.questionFrame.starters[0]}"
  Q2 starter: "${seed.questionFrame.starters[1]}"
  Q3 starter: "${seed.questionFrame.starters[2]}"`
    : isKiswahili
      ? `Andika maswali matatu ya uchunguzi yenye mianzo TOFAUTI. Zungusha kati ya: Kwa nini / Vipi / Ni nini kingetokea kama / Kwa njia gani / Je / Kwa kiwango gani...`
      : `Write 3 inquiry questions using DIFFERENT starters. Rotate: Why / How / What if / In what ways / Which / How might / Where / Can you...`

  // ── Assessment instruction ──────────────────────────────────────────────────
  const assessmentInstruction = seed
    ? isKiswahili
      ? `TATHMINI — tumia mbinu HIZI tatu hasa (usibadilishe), ukiziandika kwa Kiswahili Sanifu:
  "${seed.assessmentMethods[0]}"
  "${seed.assessmentMethods[1]}"
  "${seed.assessmentMethods[2]}"`
      : `ASSESSMENT — use EXACTLY these three methods (no substitution):
  "${seed.assessmentMethods[0]}"
  "${seed.assessmentMethods[1]}"
  "${seed.assessmentMethods[2]}"`
    : isKiswahili
      ? `Chagua mbinu tatu TOFAUTI za tathmini, ukiziandika kwa Kiswahili Sanifu. Zungusha kati ya: orodha ya uchunguzi, maswali ya mdomo, zoezi la maandishi, onyesho la vitendo, tathmini ya wenzao, kujitathmini, tiketi ya kutoka, kipengele cha kwenye jalada, jaribio fupi, tafakari.`
      : `Choose 3 DIFFERENT assessment methods. Rotate from: observation checklist, oral questions, written exercise, practical demo, peer assessment, self-assessment, exit ticket, portfolio entry, quiz, reflection.`

  // ── Values and competencies ─────────────────────────────────────────────────
  const valuesStr       = seed?.values           ?? (isKiswahili ? 'Heshima, Uwajibikaji, Umoja' : 'Respect, Responsibility, Unity')
  const competenciesStr = seed?.coreCompetencies ?? (isKiswahili ? 'Mawasiliano, Fikra makini, Ushirikiano' : isCBC ? 'Communication, Critical thinking, Collaboration' : 'Problem solving, Critical thinking')

  // ── Dynamic JSON example — NEVER hardcode identify/explain/appreciate ───────
  const l1ex = seed?.outcomePattern.l1 ?? (isKiswahili ? 'taja' : 'describe')
  const l2ex = seed?.outcomePattern.l2 ?? (isKiswahili ? 'eleza' : 'investigate')
  const l3ex = seed?.outcomePattern.l3 ?? (isKiswahili ? 'tathmini' : 'reflect on')

  const experienceEx = seed
    ? isKiswahili
      ? [
          `${seed.framework.name}: [shughuli mahususi inayohusiana na ${substrand} katika muktadha wa Kikenya]`,
          '[shughuli ya pili tofauti — muundo tofauti na wa kwanza]',
          '[shughuli ya tatu — kazi binafsi, ya jozi, au ya kikundi]',
        ]
      : [
          `${seed.framework.name}: [specific activity referencing ${substrand} in Kenyan context]`,
          '[second distinct activity — different structure from first]',
          '[third activity — individual, pair, or group work]',
        ]
    : isKiswahili
      ? [
          'Wanafunzi [shughuli 1 inayohusiana na muktadha maalum wa eneo]',
          'Wanafunzi [shughuli 2 — mtindo tofauti na shughuli 1]',
          'Wanafunzi [shughuli 3 — kazi binafsi ya kuimarisha]',
        ]
      : [
          'Learners [activity 1 referencing specific local context]',
          'Learners [activity 2 — different mode from activity 1]',
          'Learners [activity 3 — individual task to consolidate]',
        ]

  const resourcesLabel = isKiswahili
    ? `NYENZO — VITU 3 HASA, MAJINA SAFI PEKEE:
1. "${textbook || `Kitabu cha ${learningArea} ${isCBC ? 'Gredi' : 'Kidato'} ${gradeNum}`}"
2. "Mwongozo wa Mwalimu wa ${learningArea} ${isCBC ? 'Gredi' : 'Kidato'} ${gradeNum}"
3. "[Kitu kimoja cha darasani: chati / mchoro ubaoni / kipande cha gazeti / kifaa halisi]"
Hakuna nambari za ukurasa. Hakuna maelezo. Hakuna mistari baada ya jina. Majina safi pekee.
KAMWE: watu rasilimali wa jamii, matembezi shambani, kanda za redio, ramani za serikali, vifaa vilivyonunuliwa.`
    : `RESOURCES — EXACTLY 3 ITEMS, CLEAN NAMES ONLY:
1. "${textbook || `${learningArea} ${isCBC ? 'Grade' : 'Form'} ${gradeNum} Textbook`}"
2. "Teacher's Guide for ${learningArea} ${isCBC ? 'Grade' : 'Form'} ${gradeNum}"
3. "[One classroom item: chart / blackboard diagram / newspaper cutout / real object]"
No page numbers. No descriptions. No dashes after the name. Clean names only.
NEVER: community resource persons, farm visits, radio recordings, government maps, purchased materials.`

  const keywordRequirement = isKiswahili
    ? `SHARTI LA NENO MSINGI:
Somo lako linahusu: ${substrand}
Tumia neno MOJA angalau kutoka kwenye kundi hili mahali fulani kwenye shabaha au shughuli za ufunzaji:
${substrand.split(/[\s\-:,/()]+/).filter(w => w.length >= 4).slice(0, 3).join(', ')}`
    : `KEYWORD REQUIREMENT:
Your lesson is about: ${substrand}
Use at least ONE word from this set somewhere in outcomes or experiences:
${substrand.split(/[\s\-:,/()]+/).filter(w => w.length >= 4).slice(0, 3).join(', ')}`

  const learningResourcesEx = isKiswahili
    ? [
        textbook || `Kitabu cha ${learningArea} ${isCBC ? 'Gredi' : 'Kidato'} ${gradeNum}`,
        `Mwongozo wa Mwalimu wa ${learningArea} ${isCBC ? 'Gredi' : 'Kidato'} ${grade}`,
        '[chati / mchoro ubaoni / kipande cha gazeti / kifaa halisi]',
      ]
    : [
        textbook || `${learningArea} ${isCBC ? 'Grade' : 'Form'} ${gradeNum} Textbook`,
        `Teacher's Guide for ${learningArea} ${isCBC ? 'Grade' : 'Form'} ${grade}`,
        '[chart / blackboard diagram / newspaper cutout / real object]',
      ]

  const assessmentMethodsEx = isKiswahili
    ? [
        seed?.assessmentMethods[0] ?? 'Orodha ya uchunguzi kwa [ujuzi]',
        seed?.assessmentMethods[1] ?? 'Maswali ya mdomo yenye mawazo ya kina',
        seed?.assessmentMethods[2] ?? 'Zoezi la maandishi: [kazi mahususi]',
      ]
    : [
        seed?.assessmentMethods[0] ?? 'Observation checklist for [skill]',
        seed?.assessmentMethods[1] ?? 'Oral questioning using higher-order prompts',
        seed?.assessmentMethods[2] ?? 'Written exercise: [specific task]',
      ]

  const pciLinksStr = isKiswahili
    ? 'Elimu ya Afya, Uraia, Ujuzi wa Maisha'
    : isCBC ? 'Health Education, Citizenship, Life Skills' : 'Guidance and Counselling, Life Skills'

  const outputHeader = isKiswahili
    ? 'MATOKEO — Rudisha MUUNDO huu wa JSON PEKEE (majina ya sehemu za JSON yabaki kwa Kiingereza, thamani zote kwa Kiswahili):'
    : 'OUTPUT — Return ONLY this JSON structure:'

  const learningOutcomeEx = isKiswahili
    ? [
        `${l1ex} [maarifa mahususi kuhusu ${substrand} katika muktadha wa Kikenya]`,
        `${l2ex} jinsi ${substrand} [inavyotumika au kufanya kazi katika hali halisi]`,
        `${l3ex} umuhimu wa ${substrand} katika [jamii au taifa la Kenya]`,
      ]
    : [
        `${l1ex} [specific knowledge about ${substrand} using Kenyan context]`,
        `${l2ex} how ${substrand} [applies or functions in real situation]`,
        `${l3ex} the significance of ${substrand} in [Kenyan community or national context]`,
      ]

  const inquiryQuestionEx = isKiswahili
    ? [
        '[swali likitumia mwanzo wa kwanza kutoka mfumo hapo juu, kwa Kiswahili]',
        '[swali likitumia mwanzo wa pili kutoka mfumo hapo juu, kwa Kiswahili]',
        '[swali likitumia mwanzo wa tatu kutoka mfumo hapo juu, kwa Kiswahili]',
      ]
    : [
        '[question using first starter from the frame above]',
        '[question using second starter from the frame above]',
        '[question using third starter from the frame above]',
      ]

  const importantNotes = isKiswahili
    ? `MUHIMU:
- Matokeo matatu ya kujifunza: mpangilio wa utambuzi Kiwango 1 → Kiwango 2 → Kiwango 3
- Kila matokeo lianze MOJA KWA MOJA na kitenzi cha kutenda — USIANDIKE "Kufikia mwisho wa somo" au "Mwanafunzi aweze" kama utangulizi
- Tumia istilahi za ${isCBC ? 'CBC Kenya' : 'KCSE 8-4-4 Kenya'} kwa Kiswahili sanifu
- Mifano yote lazima itaje sehemu, mazao, desturi, au jamii halisi za Kenya
- Andika maudhui YOTE (matokeo, uzoefu, maswali, tathmini, nyenzo, maadili, uwezo wa msingi) kwa Kiswahili Sanifu — majina ya sehemu za JSON pekee ndiyo yanabaki kwa Kiingereza
- Toa JSON SAHIHI PEKEE — bila maandishi mengine
${retryNote}`
    : `IMPORTANT:
- 3 learning outcomes: Level 1 → Level 2 → Level 3 cognitive order
- Each outcome starts DIRECTLY with the action verb — do NOT write "By the end of the lesson" or "The learner should be able to" as a prefix
- Use ${isCBC ? 'CBC Kenya' : 'KCSE 8-4-4 Kenya'} terminology throughout
- All examples must reference real Kenyan places, crops, practices, or communities
- Output VALID JSON ONLY — no extra text
${retryNote}`

  return `CURRICULUM: ${curriculumContext}

LESSON DETAILS:
Subject: ${learningArea}
${isCBC ? 'Grade' : 'Form'}: ${grade}
Strand/Topic: ${strand}
Substrand/Subtopic: ${substrand}
Lesson: ${lessonNumber} of ${totalLessons}

${outcomeBlock}

${experienceInstruction}

${questionInstruction}

${assessmentInstruction}

${resourcesLabel}

${keywordRequirement}

${kicdSection}${subtopicsSection}
${seed?.contextBlock ? `\nPER-LESSON DIVERSITY CONTEXT:\n${seed.contextBlock}` : ''}

${outputHeader}
{
  "learning_outcomes": [
    "${learningOutcomeEx[0]}",
    "${learningOutcomeEx[1]}",
    "${learningOutcomeEx[2]}"
  ],
  "learning_experiences": [
    "${experienceEx[0]}",
    "${experienceEx[1]}",
    "${experienceEx[2]}"
  ],
  "key_inquiry_questions": [
    "${inquiryQuestionEx[0]}",
    "${inquiryQuestionEx[1]}",
    "${inquiryQuestionEx[2]}"
  ],
  "assessment_methods": [
    "${assessmentMethodsEx[0]}",
    "${assessmentMethodsEx[1]}",
    "${assessmentMethodsEx[2]}"
  ],
  "learning_resources": [
    "${learningResourcesEx[0]}",
    "${learningResourcesEx[1]}",
    "${learningResourcesEx[2]}"
  ],
  "core_competencies": "${competenciesStr}",
  "values": "${valuesStr}",
  "pci_links": "${pciLinksStr}"
}

${importantNotes}`
}

// ─── Context interface ────────────────────────────────────────────────────────

export interface LessonGenerationContext {
  learningArea:   string
  grade:          string
  strand:         string
  substrand:      string
  lessonNumber:   number
  totalLessons:   number
  curriculumMode: CurriculumMode
  subjectType?:   string
  previousVerbs?: string[]
  diversitySeed?: DiversitySeed
  textbook?:      string
  kicdContext?: {
    subjectData:  Record<string, Record<string, unknown>>
    strandData:   Array<{ title: string; kicd_data: Record<string, unknown>[] }>
    subtopicMap?: Record<string, string[]>
  }
  costContext?: AICostContext
}

export interface ValidatedLessonResult {
  learning_outcomes?:      string[]
  learning_experiences?:   string[]
  key_inquiry_questions?:  string[]
  assessment_methods?:     string[]
  learning_resources?:     string[]
  core_competencies?:      string
  values?:                 string
  pci_links?:              string
  _validated:  boolean
  _confidence: number
  _source:     string
  error?:      string
  details?:    string
}

// ─── Main export ─────────────────────────────────────────────────────────────

export async function generateValidatedLesson(
  context: LessonGenerationContext
): Promise<ValidatedLessonResult> {
  let attempt   = 0
  let lastError: string | null = null

  const skillWords = context.substrand
    .split(/[\s\-:,/()]+/)
    .filter(w => w.length >= 4)
    .slice(0, 3)
    .join(', ')

  // Computed once, not per-attempt — retryNote below needs it before the
  // prompt is built, and it must stay the same value used for callSowAI.
  const isKiswahiliCtx = isKiswahiliSubject(context.learningArea)

  while (attempt < MAX_RETRIES) {
    attempt++

    let retryNote = ''
    if (attempt > 1 && lastError) {
      const isMathsRetry = (context.subjectType ?? '').includes('mathematics')
      // The raw validator message (lastError) is internal English jargon —
      // never shown verbatim in the Kiswahili branch. Retries used to inject
      // it plus an all-English "PREVIOUS ATTEMPT FAILED" note unconditionally,
      // which fed a chunk of English straight into an otherwise Kiswahili
      // prompt on every retry — a real, recurring source of mixed-language
      // output, worse than the one-off English defaults fixed earlier since
      // it fires mid-generation for whichever lessons happen to need a retry.
      retryNote = isKiswahiliCtx
        ? `
JARIBIO LILILOPITA HALIKUFAULU. Rekebisha suala hili katika jibu lako lijalo, ukiendelea kuandika KWA KISWAHILI SANIFU TU.
${lastError.includes('progress') ? `KUMBUKA: matokeo lazima yaende kwa mpangilio wa Kiwango 1 → Kiwango 2 → Kiwango 3` : ''}
${lastError.includes('aligned')  ? `KUMBUKA: lazima liwe na angalau neno moja kutoka: ${skillWords}` : ''}
${lastError.includes('verb')     ? `KUMBUKA: tumia vitenzi vya Kiswahili pekee vilivyoorodheshwa hapo juu` : ''}
`
        : `
PREVIOUS ATTEMPT FAILED: ${lastError}
Fix this specific issue in your next response.
${lastError.includes('progress') ? `REMINDER: outcomes must go Level 1 → Level 2 → Level 3 cognitive order` : ''}
${lastError.includes('aligned')  ? `REMINDER: must include at least one word from: ${skillWords}` : ''}
${isMathsRetry && lastError.includes('progress') ? 'MATHS REMINDER: a)=recall/identify, b)=calculate/apply, c)=appreciate/value' : ''}
`
    }

    const prompt = buildLessonPrompt({ ...context }, retryNote)

    let aiResponse: string
    try {
      aiResponse = await callSowAI(prompt, isKiswahiliCtx, context.costContext)
    } catch (err: unknown) {
      lastError = `AI request failed: ${err instanceof Error ? err.message : String(err)}`
      continue
    }

    let lesson: Record<string, any>
    try {
      const cleaned = aiResponse
        .replace(/^```json\s*/i, '')
        .replace(/^```\s*/i, '')
        .replace(/```\s*$/i, '')
        .trim()
      lesson = JSON.parse(cleaned)
    } catch {
      lastError = 'AI returned invalid JSON'
      continue
    }

    const validation = validateLesson(lesson, context.substrand, context.subjectType ?? 'default')

    if (validation.isValid) {
      return {
        ...lesson,
        _validated:  true,
        _confidence: Math.min(0.85 + attempt * 0.03, MAX_CONFIDENCE),
        _source:     'deepseek_sow_generator',
      }
    }

    lastError = validation.issues.join('; ')
  }

  return {
    error:       'Lesson failed validation',
    details:     lastError || 'Unknown error',
    _validated:  false,
    _confidence: 0,
    _source:     'deepseek_sow_generator',
  }
}
