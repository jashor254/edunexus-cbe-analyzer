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
