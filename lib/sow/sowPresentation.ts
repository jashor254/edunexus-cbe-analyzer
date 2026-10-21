// lib/sow/sowPresentation.ts
//
// How a scheme of work's cells are PRINTED — pure, shared by the renderers.
// The printed scheme used to list outcomes as bare, unnumbered fragments
// ("andika maana ya…") with no "Kufikia mwisho wa kipindi, mwanafunzi
// aweze:" stem, and gave the teacher nowhere to write textbook pages.

export function outcomeStem(isKiswahili: boolean): string {
  return isKiswahili
    ? 'Kufikia mwisho wa kipindi, mwanafunzi aweze:'
    : 'By the end of the lesson, the learner should be able to:'
}

const LIST_LABEL = /^\s*(?:[a-z]\)|[a-z]\.|\d+\.)\s*/i
const KISWAHILI_PREAMBLE = /^(kufikia mwisho wa (kipindi|somo|mada( ndogo)?)[,:]?\s*)?(mwanafunzi\s+)?(aweze|ataweza)[:\s]+/i
const ENGLISH_PREAMBLE = /^(by the end of (the|this) lesson[,:]?\s*)?(the\s+)?learner[s]?\s+(should\s+)?be\s+able\s+to\s+/i

// KICD Kiswahili outcomes are infinitives ("kueleza…", "kutambua…").
// Lessons generated before grounding stored bare verbs ("andika maana…");
// under the stem "mwanafunzi aweze:" those read as orders, so print them
// in the design's form.
export function toKiswahiliInfinitive(outcome: string): string {
  const text = outcome.replace(LIST_LABEL, '').replace(KISWAHILI_PREAMBLE, '').trim()
  if (!text) return text
  const lowered = text.charAt(0).toLowerCase() + text.slice(1)
  return /^ku/.test(lowered) ? lowered : `ku${lowered}`
}

export function formatOutcomes(outcomes: string[], isKiswahili: boolean): string[] {
  return outcomes
    .map(o => (isKiswahili ? toKiswahiliInfinitive(o) : o.replace(LIST_LABEL, '').replace(ENGLISH_PREAMBLE, '').trim()))
    .filter(Boolean)
}

// a), b), c) … — the labelling KICD designs use for specific outcomes.
export function letterLabel(index: number): string {
  return `${String.fromCharCode(97 + (index % 26))})`
}

const HAS_PAGE_REF = /\b(uk|ukurasa|kurasa|pp?|pages?)\.?\s*\d/i

// The generator never invents page numbers; the printed scheme leaves a
// blank after the first resource (the learner's textbook) for the teacher.
export function withPageBlank(resources: string[], isKiswahili: boolean): string[] {
  if (resources.length === 0) return resources
  const [first, ...rest] = resources
  if (HAS_PAGE_REF.test(first)) return resources
  return [`${first} — ${isKiswahili ? 'uk.' : 'pp.'} ______`, ...rest]
}

export function breakBadge(isKiswahili: boolean): string {
  return isKiswahili ? 'SHUGHULI MAALUM' : 'BREAK'
}

export type SignOffLine = { role: string; name: string }

export function signOffLines(isKiswahili: boolean, teacherName: string): SignOffLine[] {
  return isKiswahili
    ? [
        { role: 'Imeandaliwa na (Mwalimu)', name: teacherName },
        { role: 'Imekaguliwa na (Mkuu wa Idara)', name: '' },
        { role: 'Imeidhinishwa na (Mwalimu Mkuu)', name: '' },
      ]
    : [
        { role: 'Prepared by (Teacher)', name: teacherName },
        { role: 'Checked by (Head of Department)', name: '' },
        { role: 'Approved by (Principal / Head Teacher)', name: '' },
      ]
}
