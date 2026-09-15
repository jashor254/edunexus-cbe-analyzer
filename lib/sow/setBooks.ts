import type { SelectedSubstrand } from './types'

export interface SetBook {
  id: string
  title: string
  subject: 'english' | 'kiswahili'
  grade: string
  curriculum: '844'
}

export const SET_BOOKS: SetBook[] = [
  // 8-4-4 Form 3 — English
  { id: 'eng-f3-1', title: 'Parliament of Owls',                       subject: 'english',   grade: 'Form 3', curriculum: '844' },
  { id: 'eng-f3-2', title: 'A Silent Song and Other Stories',          subject: 'english',   grade: 'Form 3', curriculum: '844' },
  { id: 'eng-f3-3', title: 'The Samaritan',                            subject: 'english',   grade: 'Form 3', curriculum: '844' },

  // 8-4-4 Form 3 — Kiswahili
  { id: 'kisw-f3-1', title: 'Nguu za Jadi',                            subject: 'kiswahili', grade: 'Form 3', curriculum: '844' },
  { id: 'kisw-f3-2', title: 'Mapambazuko ya Machweo na Hadithi Zingine', subject: 'kiswahili', grade: 'Form 3', curriculum: '844' },
  { id: 'kisw-f3-3', title: 'Bembea ya Maisha',                        subject: 'kiswahili', grade: 'Form 3', curriculum: '844' },

  // 8-4-4 Form 4 — same 2022-2026 KNEC set book cycle as Form 3
  { id: 'eng-f4-1', title: 'Parliament of Owls',                       subject: 'english',   grade: 'Form 4', curriculum: '844' },
  { id: 'eng-f4-2', title: 'A Silent Song and Other Stories',          subject: 'english',   grade: 'Form 4', curriculum: '844' },
  { id: 'eng-f4-3', title: 'The Samaritan',                            subject: 'english',   grade: 'Form 4', curriculum: '844' },

  { id: 'kisw-f4-1', title: 'Nguu za Jadi',                            subject: 'kiswahili', grade: 'Form 4', curriculum: '844' },
  { id: 'kisw-f4-2', title: 'Mapambazuko ya Machweo na Hadithi Zingine', subject: 'kiswahili', grade: 'Form 4', curriculum: '844' },
  { id: 'kisw-f4-3', title: 'Bembea ya Maisha',                        subject: 'kiswahili', grade: 'Form 4', curriculum: '844' },
]

// Only returns books for 8-4-4 English or Kiswahili; empty array for everything else.
export function getSetBooksForSubject(
  subjectName: string,
  curriculumMode: string,
  grade: string
): SetBook[] {
  if (!curriculumMode.includes('844')) return []

  const name = subjectName.toLowerCase()
  const isEnglish   = name.includes('english')
  const isKiswahili = name.includes('kiswahili')

  if (!isEnglish && !isKiswahili) return []

  return SET_BOOKS.filter(b =>
    b.curriculum === '844' &&
    b.grade.toLowerCase() === grade.toLowerCase() &&
    (isEnglish ? b.subject === 'english' : b.subject === 'kiswahili')
  )
}

// 8-4-4 Kiswahili/English schemes conventionally place the set book (Kitabu
// Teule / class reader) as the 6th topic in the term's sequence, after the
// first 5 chapters — not first, not last, not teacher-orderable. If fewer
// than 5 chapters were selected, it lands at the end rather than skipping
// ahead of chapters that don't exist yet.
export function insertSetBooksAsSixthSubstrand(
  substrands: SelectedSubstrand[],
  setBookTitles: string[],
): SelectedSubstrand[] {
  if (!setBookTitles.length) return substrands

  const setBookEntries: SelectedSubstrand[] = setBookTitles.map((title, i) => ({
    strandId:       'set-book',
    strandTitle:    'Kitabu Teule',
    substrandId:    `set-book-${i}`,
    substrandTitle: `Kitabu Teule: ${title}`,
    lessonsRequired: 6,
    orderIndex:     0,
  }))

  const insertAt = Math.min(5, substrands.length)
  const merged = [
    ...substrands.slice(0, insertAt),
    ...setBookEntries,
    ...substrands.slice(insertAt),
  ]

  return merged.map((s, i) => ({ ...s, orderIndex: i }))
}
