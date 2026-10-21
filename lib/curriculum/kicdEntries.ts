// lib/curriculum/kicdEntries.ts
//
// One KICD curriculum-design sub-strand ("mada ndogo") as stored in
// `sow_strands.kicd_data`, plus the two pure operations every consumer
// needs: find which entry a `sow_substrands` row belongs to, and cut that
// entry into the slice one lesson actually teaches.
//
// Why this exists: `sow_substrands` rows do not map 1:1 onto KICD entries.
// The seed splits one KICD sub-strand into several rows (Grade 9 Kiswahili
// stores "11.1.1 Uzungumzaji katika Sherehe (Vipindi 2)" as two rows with
// the same title, one per lesson; "1.4.1 Vihusishi vya Mahali na Vihusishi
// vya Wakati" as two rows with different titles). The SOW generator used to
// sidestep the mapping by always sending `kicd_data[0]` — the strand's
// FIRST sub-strand — for every lesson, so a grammar lesson was grounded in
// the listening sub-strand's outcomes. Matching by title and numbering
// fixes that without touching the seeded rows.
//
// Pure: no DB, no AI, deterministic.

export type KicdEntry = {
  title: string
  learningOutcomes: string[]
  learningExperiences: string[]
  keyInquiryQuestions: string[]
  suggestedLessons: number | null
  // Present only where the design's "Core competencies / Values / PCIs"
  // blocks have been extracted for this entry. Empty means "not loaded",
  // never "the design lists none".
  coreCompetencies: string[]
  values: string[]
  pcis: string[]
}

export type KicdLessonSlice = {
  entryTitle: string
  part: number
  parts: number
  learningOutcomes: string[]
  learningExperiences: string[]
  keyInquiryQuestions: string[]
  coreCompetencies: string[]
  values: string[]
  pcis: string[]
}

function stringList(value: unknown): string[] {
  if (!Array.isArray(value)) return []
  return value
    .filter((v): v is string => typeof v === 'string')
    .map(v => v.trim())
    .filter(v => v.length > 0)
}

// Strips the design's list labels ("a) ", "b. ", "1. ", "• ") and trailing
// list punctuation — the wording itself is kept verbatim.
export function cleanKicdItem(text: string): string {
  return text
    .replace(/^\s*(?:[a-z]\)|[a-z]\.|\d+\.|[•\-–])\s*/i, '')
    .replace(/[\s,;.]+$/, '')
    .replace(/\s+/g, ' ')
    .trim()
}

// Normalises one raw `kicd_data` value (jsonb, untyped) into entries.
// Entries with no outcomes are dropped — they cannot ground a lesson.
export function parseKicdEntries(raw: unknown): KicdEntry[] {
  if (!Array.isArray(raw)) return []
  const entries: KicdEntry[] = []
  for (const item of raw) {
    if (!item || typeof item !== 'object') continue
    const r = item as Record<string, unknown>
    const title = typeof r.title === 'string' ? r.title.trim() : ''
    const learningOutcomes = stringList(r.learning_outcomes).map(cleanKicdItem).filter(Boolean)
    if (!title || learningOutcomes.length === 0) continue
    const lessons = typeof r.suggested_lessons === 'number' && r.suggested_lessons > 0
      ? r.suggested_lessons
      : null
    entries.push({
      title,
      learningOutcomes,
      learningExperiences: stringList(r.learning_experiences).map(cleanKicdItem).filter(Boolean),
      keyInquiryQuestions: stringList(r.key_inquiry_questions).map(cleanKicdItem).filter(Boolean)
        .map(q => (q.endsWith('?') ? q : `${q}?`)),
      suggestedLessons: lessons,
      coreCompetencies: stringList(r.core_competencies),
      values: stringList(r.values),
      pcis: stringList(r.pcis),
    })
  }
  return entries
}

// ─── Matching ────────────────────────────────────────────────────────────────

// Words that name the skill/strand family rather than the content, in both
// languages — they appear in nearly every row title, so they carry no
// signal about WHICH sub-strand a row is.
const GENERIC_WORDS = new Set([
  // Kiswahili function words
  'na', 'ya', 'wa', 'za', 'la', 'kwa', 'cha', 'vya', 'katika', 'ni', 'au', 'pia',
  // Kiswahili skill labels and generic activity nouns
  'kusikiliza', 'kuzungumza', 'kusoma', 'kuandika', 'sarufi', 'matumizi', 'lugha',
  'uchambuzi', 'uchanganuzi',
  // English function words
  'the', 'and', 'of', 'in', 'to', 'for', 'a', 'an', 'on', 'with',
  // English skill labels
  'listening', 'speaking', 'reading', 'writing', 'grammar', 'use',
])

// Skill → the position KICD language designs number it at (x.1.1 listening,
// x.2.1 reading, x.3.1 writing, x.4.1 grammar). A row labelled with a skill
// is only compared against entries at that position, and — when its title
// shares no content words with any of them — falls back to the single
// entry at that position.
const SKILL_POSITIONS: Array<[RegExp, number]> = [
  [/^\s*(kusikiliza|listening)/i, 1],
  [/^\s*(kusoma|reading)/i, 2],
  [/^\s*(kuandika|writing)/i, 3],
  [/^\s*(sarufi|matumizi ya lugha|grammar)/i, 4],
]

// Senior Fasihi rows are labelled by genre, numbered the same way
// (x.1.1 fasihi simulizi, x.2.1 ushairi, x.3.1 bunilizi). Genre is a filter
// only — never a fallback: the seeded genre rows are finer-grained than the
// design ("Uchambuzi wa Tawasifu – Wahusika" under an entry about Riwaya),
// and grounding them in a different text's outcomes would be wrong.
const GENRE_POSITIONS: Array<[RegExp, number]> = [
  [/^\s*fasihi simulizi/i, 1],
  [/^\s*ushairi/i, 2],
  [/^\s*bunilizi/i, 3],
]

function contentTokens(text: string): Set<string> {
  const tokens = text
    .toLowerCase()
    .replace(/^\s*\d+(?:\.\d+)+\s*/, '')
    .normalize('NFD').replace(/[̀-ͯ]/g, '')
    .split(/[^a-z0-9']+/)
    .map(t => t.replace(/'/g, ''))
    .filter(t => t.length >= 3 && !GENERIC_WORDS.has(t))
  return new Set(tokens)
}

function positionFrom(table: Array<[RegExp, number]>, substrandTitle: string): number | null {
  for (const [pattern, position] of table) {
    if (pattern.test(substrandTitle)) return position
  }
  return null
}

function entryPosition(entryTitle: string): number | null {
  const m = entryTitle.match(/^\s*\d+\.(\d+)\.\d+/)
  return m ? Number(m[1]) : null
}

const MIN_SCORE = 0.5

type Candidate = { index: number; score: number; shared: number; skillMatch: boolean }

// Index of the KICD entry a `sow_substrands` row belongs to, or null when no
// entry is a credible match (the caller must then treat the lesson as NOT
// grounded — never fall back to an arbitrary entry).
//
// Score = the better of "how much of the row title the entry explains"
// (JSS rows: "Sarufi - Vihusishi vya wakati") and "how much of the entry
// title the row contains" (senior rows carry long genre prefixes:
// "Bunilizi na Kazi za Kihalisia - Uchambuzi wa Tamthilia - Maudhui").
export function matchKicdEntry(substrandTitle: string, entries: KicdEntry[]): number | null {
  if (entries.length === 0) return null
  const rowTokens = contentTokens(substrandTitle)
  const rowSkill = positionFrom(SKILL_POSITIONS, substrandTitle)
  const rowPosition = rowSkill ?? positionFrom(GENRE_POSITIONS, substrandTitle)

  const atRowPosition = rowPosition === null
    ? []
    : entries.map((e, i) => ({ e, i })).filter(x => entryPosition(x.e.title) === rowPosition)
  const candidates = atRowPosition.length ? atRowPosition : entries.map((e, i) => ({ e, i }))

  let best: Candidate | null = null
  candidates.forEach(({ e: entry, i: index }) => {
    const entryTokens = contentTokens(entry.title)
    let shared = 0
    for (const t of rowTokens) if (entryTokens.has(t)) shared++
    const coverage = rowTokens.size ? shared / rowTokens.size : 0
    const precision = entryTokens.size ? shared / entryTokens.size : 0
    const score = Math.max(coverage, precision)
    const skillMatch = rowSkill !== null && entryPosition(entry.title) === rowSkill
    const current: Candidate | null = best
    const better = !current
      || score > current.score
      || (score === current.score && skillMatch && !current.skillMatch)
      || (score === current.score && skillMatch === current.skillMatch && shared > current.shared)
    if (better) best = { index, score, shared, skillMatch }
  })

  const top: Candidate | null = best
  if (top && top.shared > 0 && top.score >= MIN_SCORE) return top.index

  // Titles share too little — accept a language-skill position only when it
  // is unambiguous (exactly one entry numbered at that position).
  if (rowSkill !== null && atRowPosition.length === 1) return atRowPosition[0].i
  return null
}

// ─── Lesson parts ────────────────────────────────────────────────────────────

// For lessons in teaching order, numbers each lesson within the KICD entry
// it belongs to: two rows of "Uzungumzaji katika Sherehe" become part 1/2
// and 2/2. `key` identifies the entry (e.g. `${strandId}#${entryIndex}`);
// null keys (ungrounded lessons) get part 1/1.
export function assignLessonParts(keys: Array<string | null>): Array<{ part: number; parts: number }> {
  const totals = new Map<string, number>()
  for (const k of keys) if (k !== null) totals.set(k, (totals.get(k) ?? 0) + 1)
  const seen = new Map<string, number>()
  return keys.map(k => {
    if (k === null) return { part: 1, parts: 1 }
    const part = (seen.get(k) ?? 0) + 1
    seen.set(k, part)
    return { part, parts: totals.get(k) ?? 1 }
  })
}

// KICD designs end each outcome list with the affective outcome
// ("kufurahia…", "kuchangamkia…", "appreciate…"). It belongs to the
// sub-strand as a whole, so it goes with the final lesson, not the first.
const AFFECTIVE = /^(kufurahia|kuchangamkia|kuonea fahari|kuthamini|kujenga mazoea|kujenga hamu|appreciate|value|develop interest|enjoy|show interest|recognise the importance|recognize the importance|acknowledge)/i

function splitEvenly<T>(items: T[], part: number, parts: number): T[] {
  if (items.length === 0) return []
  if (parts <= 1) return items
  if (items.length < parts) return [items[Math.min(part - 1, items.length - 1)]]
  const base = Math.floor(items.length / parts)
  const extra = items.length % parts
  const start = (part - 1) * base + Math.min(part - 1, extra)
  const size = base + (part - 1 < extra ? 1 : 0)
  return items.slice(start, start + size)
}

// The part of an entry one lesson teaches. Outcomes and experiences are
// split in design order across the entry's lessons; the inquiry question,
// competencies, values and PCIs belong to the whole sub-strand and repeat.
export function sliceKicdForLesson(entry: KicdEntry, part: number, parts: number): KicdLessonSlice {
  const safeParts = Math.max(1, parts)
  const safePart = Math.min(Math.max(1, part), safeParts)
  const outcomes = entry.learningOutcomes
  const last = outcomes[outcomes.length - 1]
  const hasAffective = outcomes.length > 1 && AFFECTIVE.test(last)
  const cognitive = hasAffective ? outcomes.slice(0, -1) : outcomes

  const lessonOutcomes = splitEvenly(cognitive, safePart, safeParts)
  if (hasAffective && safePart === safeParts) lessonOutcomes.push(last)

  return {
    entryTitle: entry.title,
    part: safePart,
    parts: safeParts,
    learningOutcomes: lessonOutcomes,
    learningExperiences: splitEvenly(entry.learningExperiences, safePart, safeParts),
    keyInquiryQuestions: entry.keyInquiryQuestions,
    coreCompetencies: entry.coreCompetencies,
    values: entry.values,
    pcis: entry.pcis,
  }
}
