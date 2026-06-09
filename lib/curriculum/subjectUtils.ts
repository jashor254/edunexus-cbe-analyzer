export function isKiswahiliSubject(subject: string): boolean {
  return subject.toLowerCase().trim().startsWith('kiswahili')
}

export function getLessonLanguage(subject: string): 'sw' | 'en' {
  return isKiswahiliSubject(subject) ? 'sw' : 'en'
}

export function isSocialStudies(subject: string): boolean {
  const s = subject.toLowerCase().trim()
  return (
    s.includes('social studies') ||
    s.includes('social science') ||
    s === 'geography' ||
    s === 'history' ||
    s === 'civics' ||
    s === 'life skills'
  )
}
