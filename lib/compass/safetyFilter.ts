// lib/compass/safetyFilter.ts
//
// Layer 2 of the Compass child safety architecture. Scans incoming learner
// messages and outgoing model chunks for signals that require a non-educational
// response. Deliberately conservative: false negatives (a harmful message
// passes through) are more dangerous than false positives (an innocent message
// is caught), but the patterns are tuned to Kenyan school context to avoid
// disrupting ordinary educational use.
//
// Layer 1 (prompt-level instructions) is in lib/compass/prompt.ts.
// Layer 3 (teacher notification) wires into the application via this module's
// CompassSafetyEvent type.
// Layer 4 (pre-scan before DeepSeek call) uses scanIncomingMessage().

import { detectInjectionSignals, normalizeForScan } from '@/lib/ai/untrustedInput'

export type SafetyCategory =
  | 'distress_self_harm'
  | 'harmful_instructions'
  | 'prompt_injection'
  | 'off_topic_harmful'

export type SafetyVerdict =
  | { safe: true }
  | { safe: false; category: SafetyCategory; matchedPattern: string }

export type CompassSafetyEvent = {
  category:    SafetyCategory
  detectedIn:  'incoming_message' | 'outgoing_chunk'
  excerpt:     string           // first 80 chars only — never the full message
  sessionId:   string
  studentId:   string
  teacherId:   string | null
}

// ── Distress and self-harm ────────────────────────────────────────────────────
// Kenyan context: English and Kiswahili patterns. Tuned to match overt
// expressions of self-harm rather than common educational words.

const DISTRESS_PATTERNS: ReadonlyArray<[RegExp, string]> = [
  // Kiswahili
  [/\bkujiua\b/i,                              'kujiua'],
  [/\bkujidhuluimu\b/i,                        'kujidhuluimu'],
  [/\bnataka kufa\b/i,                         'nataka kufa'],
  [/\bsikujali kuishi\b/i,                     'sikujali kuishi'],
  // English
  [/\bsuicid(?:e|al)\b/i,                      'suicid*'],
  [/\bkill(?:ing)?\s+myself\b/i,               'kill myself'],
  [/\bhurt\s+myself\b/i,                       'hurt myself'],
  [/\bcut\s+myself\b/i,                        'cut myself'],
  [/\bdon['']?t\s+want\s+to\s+(live|be\s+alive)\b/i, "don't want to live"],
  [/\bI\s+want\s+to\s+die\b/i,                'want to die'],
  [/\bend\s+(it|my\s+life|everything)\b/i,     'end it'],
  [/\bno\s+reason\s+to\s+live\b/i,            'no reason to live'],
  [/\bself[\s-]?harm\b/i,                      'self-harm'],
]

// ── Harmful instructions ──────────────────────────────────────────────────────
// Pattern matches requests for instructions to cause physical harm. Deliberately
// narrow — educational chemistry (lab safety, explosive reactions in the
// curriculum) must not trigger this.

const HARMFUL_INSTRUCTION_PATTERNS: ReadonlyArray<[RegExp, string]> = [
  [/\bhow\s+to\s+(make|build|create|assemble)\s+.{0,30}\b(bomb|explosive|weapon|gun|poison|drug)\b/i, 'how to make bomb/weapon/drug'],
  [/\bstep[\s-]by[\s-]step.{0,50}\b(bomb|explosive|weapon|drugs?)\b/i,   'step-by-step bomb/weapon'],
  [/\brecipe\s+for.{0,30}\b(bomb|meth|cocaine|heroin|fentanyl)\b/i,      'recipe for drugs'],
  [/\bsynthesize\s+.{0,30}\b(meth|cocaine|heroin|fentanyl)\b/i,          'synthesize drugs'],
]

// ── Prompt injection ──────────────────────────────────────────────────────────
// Patterns live in lib/ai/untrustedInput.ts so every AI feature shares them.
// Detection runs on raw AND normalised text (homoglyphs, leetspeak, spaced or
// zero-width-split letters), English + Kiswahili. Heuristic only — the
// structural defence is the system prompt plus the model having no tools.

// ── Off-topic harmful ─────────────────────────────────────────────────────────
// Sexual content involving minors is never acceptable regardless of framing.
// Keep this narrow to avoid blocking biology/health lessons.

const OFF_TOPIC_HARMFUL_PATTERNS: ReadonlyArray<[RegExp, string]> = [
  [/\bchild\s*(porn|sexual\s+abuse\s+material|exploitation)\b/i, 'CSAM'],
  [/\bCSAM\b/,                                                    'CSAM abbrev'],
]

function runPatterns(
  text: string,
  patterns: ReadonlyArray<[RegExp, string]>,
  category: SafetyCategory,
): SafetyVerdict {
  const folded = normalizeForScan(text)
  for (const [re, label] of patterns) {
    if (re.test(text) || re.test(folded)) return { safe: false, category, matchedPattern: label }
  }
  return { safe: true }
}

/**
 * Scan an incoming learner message before it is sent to DeepSeek.
 * Returns a verdict; on `safe: false`, the caller should NOT call DeepSeek
 * and should return an appropriate response directly.
 */
export function scanIncomingMessage(text: string): SafetyVerdict {
  const injection = detectInjectionSignals(text, { includeMarking: false })[0]
  if (injection) return { safe: false, category: 'prompt_injection', matchedPattern: injection.label }

  const distress = runPatterns(text, DISTRESS_PATTERNS, 'distress_self_harm')
  if (!distress.safe) return distress

  const harmful = runPatterns(text, HARMFUL_INSTRUCTION_PATTERNS, 'harmful_instructions')
  if (!harmful.safe) return harmful

  const offTopic = runPatterns(text, OFF_TOPIC_HARMFUL_PATTERNS, 'off_topic_harmful')
  if (!offTopic.safe) return offTopic

  return { safe: true }
}

/**
 * Scan a chunk of outgoing Compass text before it is streamed to the learner.
 * Runs distress and harmful patterns only — injection patterns are inbound only.
 */
export function scanOutgoingChunk(text: string): SafetyVerdict {
  const distress = runPatterns(text, DISTRESS_PATTERNS, 'distress_self_harm')
  if (!distress.safe) return distress

  const harmful = runPatterns(text, HARMFUL_INSTRUCTION_PATTERNS, 'harmful_instructions')
  if (!harmful.safe) return harmful

  return { safe: true }
}

/**
 * The replacement message to stream to the learner when a distress signal is detected.
 * Short and clear — never leave the learner mid-sentence with no reply.
 */
export const DISTRESS_RESPONSE_EN =
  "It sounds like you're going through something difficult right now. " +
  "Please talk to your teacher or a trusted adult at school today — they can help. " +
  "I'll be here for your schoolwork whenever you're ready."

export const DISTRESS_RESPONSE_SW =
  "Inaonekana unapitia wakati mgumu sasa hivi. " +
  "Tafadhali ongea na mwalimu wako au mtu mzima unayemwamini shuleni leo — wanaweza kusaidia. " +
  "Nitakuwepo kwa masomo yako ukiwa tayari."

/** The replacement message when harmful instructions are requested. */
export const HARMFUL_CONTENT_RESPONSE =
  "I can only help with your schoolwork. " +
  "Let's get back to what you were studying."

/** The replacement message when a prompt injection attempt is detected. */
export const INJECTION_RESPONSE =
  "I can only help with your schoolwork. What topic shall we work on today?"

/**
 * Returns the appropriate safe replacement response text for a given category,
 * attempting to detect the language from the original message.
 */
export function safeReplacementResponse(
  category: SafetyCategory,
  originalText: string,
): string {
  if (category === 'distress_self_harm') {
    // Simple heuristic: if the message contains common Kiswahili words, respond in Kiswahili
    const likelyKiswahili = /\b(na|ya|wa|kwa|ni|la|za|pia|sana|lakini|kama)\b/i.test(originalText)
    return likelyKiswahili ? DISTRESS_RESPONSE_SW : DISTRESS_RESPONSE_EN
  }
  if (category === 'prompt_injection') return INJECTION_RESPONSE
  return HARMFUL_CONTENT_RESPONSE
}
