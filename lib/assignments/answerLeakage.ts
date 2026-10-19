// lib/assignments/answerLeakage.ts
//
// Audit F-01 — a bounded, deterministic SCREEN for one obvious kind of
// answer giveaway in a single-answer multiple-choice variant: the stem's own
// supporting text states the marked answer before the learner is asked for
// it. Pure; no I/O, no AI.
//
// What it is: a prompt for teacher judgment ("possible giveaway — please
// read"). What it is NOT: proof either way. It compares words, so it cannot
// see a paraphrase ("lets electricity move easily" for "a good conductor"),
// and it cannot tell a deliberate recall prompt from a leak. That is why it
// never blocks, and why "no_signal" must never be shown as "no leakage".
//
// Distinguishing legitimate scaffolding (audit §8 categories 2–4) from a
// giveaway (categories 5–6), per answer type:
//  - Numeric answers: flagged only when the marked value itself appears in a
//    supporting sentence. A formula reminder ("…add up to 180°") or a worked
//    example on other numbers does not contain the answer, so it passes;
//    "180° − 130° = 50°" does not.
//  - One-word answers: flagged when a supporting sentence names the answer
//    ("The bulb does not light up for rubber").
//  In both, a sentence naming at least half of the wrong options too is
//  treated as listing the choices, not as giving one away.
//  - Longer answers: flagged when the supporting text covers most of the
//    answer's distinctive words AND clearly more than any wrong option's.
// Words that already appear in the question being asked are ignored (they
// are the topic, not a giveaway), and lines that merely list the options are
// not "support".

export type LeakageSignalKind = 'answer_value_stated' | 'answer_term_stated' | 'answer_wording_in_stem'

export type LeakageSignal = {
  kind: LeakageSignalKind
  /** The supporting sentence(s) where the answer was found, verbatim from the stem. */
  excerpt: string
}

export type LeakageScreen =
  | { status: 'not_checked'; reason: 'no_question_text' | 'no_answer_key' }
  /** Nothing found BY THIS CHECK. Not evidence that the question is free of giveaways. */
  | { status: 'no_signal' }
  | { status: 'possible_leak'; signals: LeakageSignal[] }

export type FigureReference = { excerpt: string }

const STOPWORDS = new Set([
  'a', 'an', 'the', 'and', 'or', 'but', 'of', 'to', 'in', 'on', 'at', 'for', 'from', 'by', 'with', 'as', 'is', 'are', 'was',
  'were', 'be', 'been', 'it', 'its', 'this', 'that', 'these', 'those', 'which', 'what', 'who', 'why', 'how', 'when', 'where',
  'they', 'them', 'their', 'there', 'he', 'she', 'his', 'her', 'we', 'you', 'your', 'our', 'i', 'not', 'no', 'do', 'does',
  'did', 'can', 'could', 'will', 'would', 'should', 'may', 'must', 'has', 'have', 'had', 'so', 'if', 'then', 'than', 'all',
  'any', 'some', 'each', 'other', 'into', 'about', 'only', 'also', 'very', 'because', 'one', 'two',
])

/** Crude suffix stripping so "protects"/"protect", "abusing"/"abuse", "citizens"/"citizen" meet. */
function stem(word: string): string {
  let w = word
  if (w.length > 4) w = w.replace(/(ing|ed|es|s)$/, '')
  if (w.length > 3) w = w.replace(/e$/, '')
  return w
}

function words(text: string): string[] {
  return (text.toLowerCase().match(/[a-z0-9]+(?:['’][a-z]+)?/g) ?? []).map(w => w.replace(/['’][a-z]+$/, ''))
}

function contentTerms(text: string): Set<string> {
  return new Set(words(text).filter(w => !STOPWORDS.has(w) && !/^\d+$/.test(w)).map(stem))
}

function numbers(text: string): Set<string> {
  return new Set(text.match(/\d+(?:\.\d+)?/g) ?? [])
}

function normalise(text: string): string {
  return text.toLowerCase().replace(/^[\s\-•*()]*([a-d][.)]\s+)?/i, '').replace(/[\s.]+$/, '').replace(/\s+/g, ' ').trim()
}

/** Sentences and lines, verbatim. A full stop only ends a sentence when whitespace follows, so "2.5" survives. */
function segments(stemText: string): string[] {
  return stemText.split(/\n+|(?<=[.!?])\s+/).map(s => s.trim()).filter(Boolean)
}

/** The sentence(s) that ask the question: any ending in "?" or ":", plus the final one. */
function isAsking(segment: string, index: number, total: number): boolean {
  return index === total - 1 || /[?:]$/.test(segment)
}

function coverage(terms: Set<string>, within: Set<string>): number {
  if (terms.size === 0) return 0
  let hit = 0
  for (const t of terms) if (within.has(t)) hit++
  return hit / terms.size
}

// Calibrated 2026-10-13 on the 75 stored sample rows (55 variants + 20
// canonical): at 0.6 / 0.25 the screen flags 5 of the 9 hand-labelled
// Foundation giveaways with no flag on any non-leaking row. The 4 misses are
// paraphrases no threshold reaches. Small sample, same data used to choose —
// re-check against a larger labelled set before tightening or loosening.
/** A sentence naming at least half of the wrong options is listing the choices, not giving one away. */
function listsTheChoices(distractorNamed: boolean[]): boolean {
  if (distractorNamed.length === 0) return false
  return distractorNamed.filter(Boolean).length * 2 >= distractorNamed.length
}

const WORDING_MIN_COVERAGE = 0.6
const WORDING_MIN_MARGIN = 0.25

export function screenAnswerLeakage(input: {
  questionText: string | null
  choices: string[]
  correctIndex: number | null
}): LeakageScreen {
  const { questionText, choices, correctIndex } = input
  if (!questionText || !questionText.trim()) return { status: 'not_checked', reason: 'no_question_text' }
  if (correctIndex === null || correctIndex < 0 || correctIndex >= choices.length) return { status: 'not_checked', reason: 'no_answer_key' }

  const all = segments(questionText)
  const optionEchoes = new Set(choices.map(normalise))
  const asking = all.filter((s, i) => isAsking(s, i, all.length))
  const support = all.filter((s, i) => !isAsking(s, i, all.length) && !optionEchoes.has(normalise(s)))
  if (support.length === 0) return { status: 'no_signal' }

  const askedTerms = new Set(asking.flatMap(s => [...contentTerms(s)]))
  const correct = choices[correctIndex]
  const distractors = choices.filter((_, i) => i !== correctIndex)
  const signals: LeakageSignal[] = []

  // Numeric answers — the marked value, where no wrong option shares it.
  const distractorNumbers = new Set(distractors.flatMap(d => [...numbers(d)]))
  const answerNumbers = [...numbers(correct)].filter(n => !distractorNumbers.has(n))
  if (answerNumbers.length > 0) {
    const distractorNumberSets = distractors.map(numbers)
    const stated = support.filter(s => {
      const inSentence = numbers(s)
      return answerNumbers.every(n => inSentence.has(n))
        && !listsTheChoices(distractorNumberSets.map(d => [...d].some(n => inSentence.has(n))))
    })
    if (stated.length > 0) signals.push({ kind: 'answer_value_stated', excerpt: stated.join(' ') })
    return signals.length > 0 ? { status: 'possible_leak', signals } : { status: 'no_signal' }
  }

  const answerTerms = new Set([...contentTerms(correct)].filter(t => !askedTerms.has(t)))
  if (answerTerms.size === 0) return { status: 'no_signal' } // the option only repeats the question's own words
  const distractorTerms = distractors.map(d => new Set([...contentTerms(d)].filter(t => !askedTerms.has(t))))

  if (answerTerms.size === 1) {
    const [term] = answerTerms
    const stated = support.filter(s => {
      const inSentence = contentTerms(s)
      return inSentence.has(term)
        && !listsTheChoices(distractorTerms.map(d => [...d].some(t => inSentence.has(t))))
    })
    if (stated.length > 0) signals.push({ kind: 'answer_term_stated', excerpt: stated.join(' ') })
  } else {
    const supportTerms = new Set(support.flatMap(s => [...contentTerms(s)]))
    const answerCoverage = coverage(answerTerms, supportTerms)
    const bestDistractor = Math.max(0, ...distractorTerms.map(d => coverage(d, supportTerms)))
    if (answerCoverage >= WORDING_MIN_COVERAGE && answerCoverage - bestDistractor >= WORDING_MIN_MARGIN) {
      const carrying = support.filter(s => [...contentTerms(s)].some(t => answerTerms.has(t)))
      signals.push({ kind: 'answer_wording_in_stem', excerpt: carrying.join(' ') })
    }
  }

  return signals.length > 0 ? { status: 'possible_leak', signals } : { status: 'no_signal' }
}

const FIGURE_NOUN = /\b(diagram|figure|picture|drawing|sketch|graph|chart|image|photo|photograph)s?\b/i
const SHAPE_PLACED = /\b(line|lines|angle|angles|triangle|shape|circuit|grid|number line|map|table)\b[^.?!\n]{0,30}\b(below|above|shown)\b/i

/**
 * A variant can only store text (choices text[] + question_text), so any
 * reference to a picture or a drawn shape "below/above" points at nothing the
 * learner will see — a confirmed content problem, not a judgment call.
 * Text examples ("the example below") are not matched.
 */
export function findMissingFigureReferences(questionText: string | null): FigureReference[] {
  if (!questionText) return []
  return segments(questionText)
    .filter(s => FIGURE_NOUN.test(s) || SHAPE_PLACED.test(s))
    .map(excerpt => ({ excerpt }))
}
