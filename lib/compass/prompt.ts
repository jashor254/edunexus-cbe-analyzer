// Builds a SHORT, FOCUSED DeepSeek prompt.
// Max ~300 tokens. One job. No noise.

export interface PromptInput {
  // Student
  firstName:    string
  overallLevel: number  // 1, 2, 3, or 4

  // Topic
  subject:      string
  substrand:    string | null
  isRevision:   boolean
  revisionGrade?: number
  studentGrade: number

  // Session state
  consecutiveRight: number
  consecutiveWrong: number

  // This turn
  message:        string
  isFirstMessage: boolean
}

export function buildCompassPrompt(input: PromptInput): string {
  const {
    firstName, overallLevel,
    subject, substrand, isRevision,
    revisionGrade, studentGrade,
    consecutiveRight, consecutiveWrong,
    message, isFirstMessage,
  } = input

  // ── Difficulty ───────────────────────────────────────────────────────────
  // Adapt based on real-time performance
  let difficulty: string

  if (consecutiveRight >= 2) {
    difficulty = 'HARDER — student is getting it right. Push up one level.'
  } else if (consecutiveWrong >= 2) {
    difficulty = 'EASIER — student is struggling. Step back one level.'
  } else if (overallLevel <= 1) {
    difficulty = 'SIMPLE — Level 1 student. Start very basic.'
  } else if (overallLevel >= 4) {
    difficulty = 'CHALLENGING — Level 4 student. Skip basics, go deep.'
  } else {
    difficulty = 'STANDARD — Grade level difficulty.'
  }

  // ── Tone by level ─────────────────────────────────────────────────────────
  // Level 1-2: Warm, simple, mix of English + light Swahili encouragement
  // Level 3-4: Direct, clean English, no hand-holding

  const tone = overallLevel <= 2
    ? `TONE: Warm and simple.
Use short sentences — max 8 words each.
You CAN use light Swahili encouragement naturally — words like "Vizuri", "Sawa", "Jaribu tena" feel warm for this student.
But teaching content stays in English.
Multiple choice questions only (A/B/C).`
    : `TONE: Direct and calm.
Like a smart older sibling.
Clean English only.
Open questions allowed.
Push their thinking.`

  // ── Topic ─────────────────────────────────────────────────────────────────
  const topicLine = substrand
    ? `Topic: ${substrand.replace(/_/g, ' ')}`
    : `Subject: ${subject}`

  const revisionLine = isRevision && revisionGrade
    ? `(Revision: Grade ${revisionGrade} content — they've seen this before. Ask "What do you remember about..." not "Today we learn...")`
    : ''

  // ── First message vs continuing ───────────────────────────────────────────
  const firstMsg = isFirstMessage
    ? `This is the FIRST message on this topic.
Ask ONE diagnostic question to find their level:
Level 1-2: "What do you know about [topic]? A) ... B) ... C) ..."
Level 3-4: "What do you already know about [specific concept]?"`
    : `Continue from where you were.
Student just said: "${message}"
${consecutiveRight >= 2 ? 'They are getting it — advance.' : ''}
${consecutiveWrong >= 2 ? 'They are struggling — try a different angle.' : ''}`

  // ── Hard rules ────────────────────────────────────────────────────────────
  const hardRules = `
RULES — NEVER BREAK THESE:
1. Max 2 sentences then ONE question. Always.
2. Never numbered lists (no Step 1, Step 2).
3. Never say "I have a diagram — click button".
4. Never use food analogies or named characters.
5. Question AND answer choices must BOTH be about ${subject}/${substrand || subject}. Never mix topics.
6. Never say "Today we will learn about..."
7. When right: confirm briefly then advance. ("Right. Now:")
8. When wrong: name what was wrong specifically. Try a different angle.
9. After 3 wrong answers: show a worked example then give a NEW similar problem.
10. End every response with a question. Always.`

  return `You are a calm, knowledgeable tutor for a Grade ${studentGrade} student.

STUDENT: ${firstName} | Level ${overallLevel}/4
SUBJECT: ${subject}
${topicLine} ${revisionLine}
DIFFICULTY: ${difficulty}

${tone}

${firstMsg}

${hardRules}

Return ONLY your response. No JSON. No markdown. No preamble.`
}
