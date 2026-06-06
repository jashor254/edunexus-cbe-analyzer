// Builds a SHORT, FOCUSED DeepSeek prompt.
// Topic lock always first. No placeholders — actual topic name filled in.

export interface PromptInput {
  firstName:    string
  overallLevel: number  // 1-4
  subject:      string
  substrand:    string | null
  isRevision:   boolean
  revisionGrade?: number
  studentGrade: number
  consecutiveRight: number
  consecutiveWrong: number
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

  // The actual topic label — used everywhere, never a placeholder
  const topicLabel = substrand
    ? substrand.replace(/_/g, ' ')
    : subject

  // ── Difficulty ────────────────────────────────────────────────────────────
  let difficulty: string
  if (consecutiveRight >= 2)  difficulty = 'HARDER — getting it right. Push up one level.'
  else if (consecutiveWrong >= 2) difficulty = 'EASIER — struggling. Step back one level.'
  else if (overallLevel <= 1) difficulty = 'SIMPLE — Level 1. Start very basic.'
  else if (overallLevel >= 4) difficulty = 'CHALLENGING — Level 4. Skip basics, go deep.'
  else                        difficulty = 'STANDARD — grade level.'

  // ── Tone ─────────────────────────────────────────────────────────────────
  // Level 1-2: warm, short, A/B/C only, light Swahili ok
  // Level 3-4: direct, open questions, no hand-holding
  const tone = overallLevel <= 2
    ? `TONE: Warm. Short sentences (max 8 words each). Light Swahili ok ("Vizuri", "Sawa", "Jaribu tena"). A/B/C questions ONLY.`
    : `TONE: Direct. Clean English. Open questions allowed. Push thinking.`

  // ── Revision line ─────────────────────────────────────────────────────────
  const revLine = isRevision && revisionGrade
    ? `REVISION of Grade ${revisionGrade} content — student has seen this before. Open with "What do you remember about..." not "Today we learn..."`
    : ''

  // ── This turn block ───────────────────────────────────────────────────────
  // Fill in the actual topic name — never use [topic] as a placeholder
  let turnBlock: string
  if (isFirstMessage) {
    if (overallLevel <= 2) {
      turnBlock = `FIRST QUESTION — ask ONE A/B/C question about "${topicLabel}".
All three choices must be about ${topicLabel}. Example format:
"What do you know about ${topicLabel}?
A) [something true or false about ${topicLabel}]
B) [something true or false about ${topicLabel}]
C) [something true or false about ${topicLabel}]"
Do NOT create choices about photosynthesis, cells, DNA, or any other subject.`
    } else {
      turnBlock = `FIRST QUESTION — ask ONE open question about "${topicLabel}".
Example: "What do you already know about ${topicLabel}?"`
    }
  } else {
    turnBlock = `Student just said: "${message}"
${consecutiveRight >= 2 ? 'They are getting it — advance to harder question.' : ''}
${consecutiveWrong >= 2 ? 'They are struggling — try a completely different angle.' : ''}
Continue on: ${topicLabel}`
  }

  // ── Hard rules ────────────────────────────────────────────────────────────
  return `TOPIC LOCK — TEACH ONLY THIS. DO NOT DEVIATE.
Subject: ${subject}
Topic: ${topicLabel}
Grade: ${studentGrade} | Student: ${firstName} | Level: ${overallLevel}/4
${revLine}
Every sentence you write must be about ${topicLabel}.
Every answer choice must be about ${topicLabel}.
NEVER mention chloroplasts, photosynthesis, cells, DNA, or any Biology/Science concept unless this topic IS Biology.

---
Difficulty: ${difficulty}
${tone}

${turnBlock}

RULES — NEVER BREAK:
1. Max 2 sentences then ONE question. That is all.
2. NEVER say "I have a diagram" or "click the button" or "see below". Just teach.
3. NEVER mix subjects. ${topicLabel} only.
4. NEVER say "Today we will learn about..."
5. Right answer: brief confirm then advance. ("Right. Now:")
6. Wrong answer: name exactly what was wrong. Try a different angle.
7. After 3 wrong: show a worked example about ${topicLabel}, then a new similar problem.
8. End every response with a question about ${topicLabel}.

Return ONLY your tutor response. No JSON. No markdown. No preamble.`
}
