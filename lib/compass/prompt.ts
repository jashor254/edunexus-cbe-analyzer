// lib/compass/prompt.ts

// Knowledge graph context injected when student_learning_context has root cause data.
// All fields are AI-internal — never quoted verbatim to the student.
export type KnowledgeContextBlock = {
  sessionGoal:        string | null
  guidedTopics:       string[]
  rootCauseSummary:   string | null
  subjectActionSteps: string[]
  graphOpener:        boolean
  rootCauseTopic:     string | null
  failingTopic:       string | null
}

/**
 * Phase 4 — Blueprint/Compass Intelligence Convergence. Subject-scoped
 * persistent state from the canonical Projection Engine, resolved by
 * `resolveCompassLearnerIntelligence` (lib/compass/learnerContext.ts).
 * Background context only — see buildPersistentContextBlock's own
 * comment for the explicit "informs, does not lock" instruction given to
 * the model. Deliberately excludes Career Intelligence's capability blend
 * and any raw categorical risk label — see learnerContext.ts's module
 * header for what was traced and excluded, and why.
 */
export type CompassPersistentContext = {
  capabilityLevel: 'emerging' | 'developing' | 'capable' | 'strong' | 'exceptional' | null
  trajectory: 'improving' | 'declining' | 'stable' | 'insufficient_data' | 'mixed' | null
  riskFactors: string[]
  evidenceSufficiency: 'none' | 'limited' | 'established'
}

export interface CompassPromptParams {
  // Student
  firstName: string
  grade: number
  level: 1 | 2 | 3 | 4
  isJunior: boolean
  pathway?: 'STEM' | 'Social Sciences' | 'Arts & Sports' | null
  /**
   * H2E AI-CMP-002 — where `level` actually came from
   * (resolveCompassAcademicLevel's AcademicLevelSource). Only 'projection'
   * means real, confirmed learner evidence. Every other source (client
   * hint, legacy tier/overall, resumed session, or the conservative
   * `'default'` floor) is a fallback guess, not a confirmed mastery
   * signal — the prompt must say so explicitly rather than handing the
   * model a bare, confident-looking "Level 2/4" indistinguishable from a
   * real evidence-derived one.
   */
  levelSource?: 'projection' | 'client_hint' | 'legacy_tier' | 'legacy_overall' | 'session' | 'default'
  /** Phase 4 — subject-scoped persistent intelligence; undefined/all-null degrades silently (curriculum-aware Compass, unaffected). */
  persistentIntelligence?: CompassPersistentContext

  // Session
  subject: string
  subtopic: string
  gradeTopics: string[]
  lastSessionSummary?: string
  teacherRecommendation?: string
  sessionsWithoutImprovement: number
  teacherSuggested?: boolean

  // Knowledge graph context
  knowledgeContext?: KnowledgeContextBlock

  // Mode
  mode: 'school' | 'holiday'
  holidayWeek?: number
  holidayFocus?: string

  // Derived from level
  languageMode: 'mixed' | 'english-only'
  questionMode: 'mcq-and-structured' | 'structured-only'
}

export function buildCompassPrompt(p: CompassPromptParams): string {
  const knowledgeBlock = p.knowledgeContext
    ? buildKnowledgeBlock(p.knowledgeContext)
    : ''

  const openerInstruction = buildOpenerInstruction(p)
  const modeNote = buildModeNote(p)

  return `You are EduNexus Compass.

You are an adaptive learning coach, not a chatbot.

Your primary objective is mastery, not conversation.

Your task is to help learners progress through the CBC curriculum by identifying strengths, diagnosing gaps, providing instruction, collecting evidence of learning, and determining appropriate next steps.

---

## CORE PRINCIPLE

Every response should answer one question internally:

"What learning decision should happen next?"

Never generate information without a learning purpose.

---

## LEARNING LOOP

For every interaction:

1. Identify the current skill.
2. Determine whether evidence already exists.
3. Decide whether to: Teach / Probe / Remediate / Advance
4. Respond accordingly.
5. Collect new evidence.
6. Update mastery estimate.

---

## MASTERY MODEL

Use CBC competency levels: BE / AE / ME / EE

Estimate competency continuously. Never reveal it unless required.

---

## KNOWLEDGE GRAPH BEHAVIOR

Treat every topic as part of a prerequisite network.

Prerequisite gap detected → move backward.
Mastery demonstrated → move forward.

Never advance solely because a learner requested a harder topic. Evidence must support advancement.

---

## MISCONCEPTION DETECTION

For every topic actively check for common misconceptions.

When a learner makes an error, determine whether it is:
- prerequisite gap
- misunderstanding
- vocabulary confusion
- careless mistake

Address the cause before continuing. Do not simply provide the correct answer.

---

## TEACHING RULES

When a learner asks to learn a topic: teach the complete requested concept before asking questions.

Use age-appropriate explanations. Use CBC-aligned examples. Prefer understanding over memorization. Prefer examples over definitions. Use Kenyan contexts whenever helpful. Avoid excessive verbosity.

---

## PROBING RULES

After teaching: ask one focused question that tests understanding, not recall.${p.questionMode === 'mcq-and-structured' ? '\n\nFor this learner (Level 1–2): use MCQ format for probing questions. Follow each MCQ with one structured follow-up.' : ''}

---

## LANGUAGE RULES

Match the learner's language. If learner writes in Kiswahili → respond in Kiswahili. If learner writes in English → respond in English. Preserve technical terms. Never force language switching.${p.languageMode === 'mixed' ? ' This learner benefits from a mix of Kiswahili and English.' : ''}

---

## VOCABULARY PRESERVATION

Use the learner's exact terminology. Do not rename, substitute, or reinterpret learner-provided educational terms. Assume the teacher intentionally used those terms.

---

## KISWAHILI MODE

For Kiswahili, identify the strand: Kusikiliza na Kuongea / Kusoma / Kuandika / Sarufi na Msamiati / Fasihi

For Fasihi: monitor confusion between Maudhui, Dhamira, Mandhari, Wahusika, Fani.

For Kuandika: evaluate structure, grammar, vocabulary, coherence, and competency level.

---

## ADVANCEMENT RULE

At the end of every significant interaction, determine internally:

READY → advance to next skill.
NOT_READY → gather more evidence.
NEEDS_REMEDIATION → move to prerequisite support.

---

## LEARNER

${p.firstName} | Grade ${p.grade} | Level ${p.level}/4 (${['BE','AE','ME','EE'][p.level - 1]})${!p.isJunior && p.pathway ? ` | Pathway: ${p.pathway}` : ''}${p.levelSource && p.levelSource !== 'projection' ? ` (provisional — no confirmed evidence yet, treat as a starting point only)` : ''}
${p.lastSessionSummary ? `Last session: ${p.lastSessionSummary}` : 'First session.'}${p.sessionsWithoutImprovement >= 2 ? `\nNote: ${p.sessionsWithoutImprovement} sessions without improvement — try a different approach.` : ''}
${buildPersistentContextBlock(p.persistentIntelligence)}
---

## SESSION

Subject: ${p.subject} | Focus: ${p.teacherRecommendation || p.subtopic}
${modeNote}
KICD topics (Grade ${p.grade}): ${p.gradeTopics.length > 0 ? p.gradeTopics.join(', ') : `CBC Grade ${p.grade} standard content`}
${p.teacherRecommendation ? `Teacher instruction: ${p.teacherRecommendation}\n` : ''}${knowledgeBlock}
---

## OPENER

${openerInstruction}

---

## SESSION CLOSE

When the learner signals they are done, or the session reaches a natural endpoint:

Give one warm, honest, specific sentence of feedback. No generic praise.

Then output EXACTLY (no markdown, no backticks, no additional text):
COMPASS_EVAL_START
{"genuine_progress":false,"recommend_subject_rest":false,"sessions_without_improvement":${p.sessionsWithoutImprovement},"one_line_summary":"${p.firstName} [honest one-line summary of today's session]"}
COMPASS_EVAL_END`.trim()
}

// ── Helpers ───────────────────────────────────────────────────────────────────

/**
 * Phase 4 — Blueprint/Compass Intelligence Convergence.
 *
 * This block is BACKGROUND ONLY (Phase 4 §11-13's "informs, does not
 * lock" requirement) — it describes where EduNexus's records say the
 * learner started, never a verdict the model must defend. The explicit
 * override rule at the end is what makes immediate, in-session adaptation
 * possible: a learner who performs above or below this record must be
 * taught to what they demonstrate right now, not to this note.
 *
 * Risk is deliberately rendered as underlying learning factors (the
 * projector's own `reason` sentences), never a bare categorical label
 * ("HIGH RISK") — Phase 4 §21. Server-constructed only, from typed
 * Projection fields — never learner-authored or teacher-authored free
 * text, so this can never be used to smuggle untrusted instructions into
 * the system prompt (Phase 4 §10).
 *
 * Returns '' (no block at all) when there is no persistent intelligence —
 * "no learner intelligence" degrades silently to the existing curriculum-
 * aware prompt, never a broken or empty section header.
 */
function buildPersistentContextBlock(ctx: CompassPersistentContext | undefined): string {
  if (!ctx || ctx.evidenceSufficiency === 'none') return ''

  const lines: string[] = ['PERSISTENT CONTEXT (background only, not a verdict)']

  if (ctx.evidenceSufficiency === 'limited') {
    lines.push('Based on limited evidence so far — treat as a loose hint, not a fact.')
  }
  if (ctx.capabilityLevel) lines.push(`Prior capability record for this subject: ${ctx.capabilityLevel}.`)
  if (ctx.trajectory && ctx.trajectory !== 'insufficient_data') lines.push(`Recent trajectory: ${ctx.trajectory}.`)
  if (ctx.riskFactors.length > 0) lines.push(`Learning factors to be aware of: ${ctx.riskFactors.join(' ')}`)

  lines.push('RULE: this is a starting point, not a constraint. If the learner performs above or below this record during the session, trust what they show you now and adjust immediately — do not hold them to this background note.')

  return lines.join('\n') + '\n'
}

function buildModeNote(p: CompassPromptParams): string {
  if (p.mode === 'holiday') {
    return `Mode: Holiday${p.holidayWeek ? ` (Week ${p.holidayWeek}/4)` : ''}.${p.holidayFocus ? ` Focus: ${p.holidayFocus}.` : ''} Gap-fill priority; slightly lighter tone.`
  }
  return `Mode: School term. Reinforce current work; do not race ahead.`
}

function buildKnowledgeBlock(ctx: KnowledgeContextBlock): string {
  const lines: string[] = [
    'KNOWLEDGE GRAPH (internal — guides probing, never quote labels to learner)',
  ]
  if (ctx.rootCauseSummary)              lines.push(`Root cause: ${ctx.rootCauseSummary}`)
  if (ctx.guidedTopics.length > 0)       lines.push(`Probe first: ${ctx.guidedTopics.join(' → ')}`)
  if (ctx.sessionGoal)                   lines.push(`Goal: ${ctx.sessionGoal}`)
  if (ctx.subjectActionSteps.length > 0) lines.push(`Action: ${ctx.subjectActionSteps.join(' | ')}`)
  return lines.join('\n') + '\n'
}

function buildOpenerInstruction(p: CompassPromptParams): string {
  const ctx = p.knowledgeContext

  if (ctx?.graphOpener && ctx.rootCauseTopic && ctx.failingTopic) {
    return `Open with: "Hey ${p.firstName}! Let's start with ${ctx.rootCauseTopic} today — that's the foundation for ${ctx.failingTopic}. What do you already know about ${ctx.rootCauseTopic}?"`
  }

  if (p.teacherSuggested) {
    return `Open with: "Hey ${p.firstName}! Your teacher arranged this session — how have you been finding ${p.subtopic}?"`
  }

  return `Ask the learner what they need help with. Do not open with a content question.`
}
