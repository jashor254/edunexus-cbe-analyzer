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

// Subjects where county/place-based examples are genuinely relevant
export function isPlaceBasedSubject(subject: string): boolean {
  const s = subject.toLowerCase().trim()
  return (
    isSocialStudies(subject) ||
    s.includes('agriculture') ||
    s.includes('environmental') ||
    s.includes('geography') ||
    s.includes('history')
  )
}

// Per-subject context hint for subjects where county examples don't apply
export function getSubjectContextHint(subject: string): string {
  const s = subject.toLowerCase().trim()
  if (s.includes('science') || s.includes('biology') || s.includes('chemistry') || s.includes('physics')) {
    return 'Use real scientific phenomena, lab observations, or everyday science examples a Kenyan learner encounters at school or home.'
  }
  if (s.includes('math')) {
    return 'Use real-life measurements, quantities, or data scenarios a Kenyan learner encounters — shopping, farming, sports, cooking.'
  }
  if (s.includes('english') || s.includes('language')) {
    return 'Use texts, conversations, or writing scenarios relevant to Kenyan learners\' daily experiences.'
  }
  if (s.includes('cre') || s.includes('ire') || s.includes('religious')) {
    return 'Use moral dilemmas, community values, or religious teachings relevant to Kenyan learners.'
  }
  if (s.includes('home science') || s.includes('home economics')) {
    return 'Use household management, nutrition, or practical domestic examples relevant to Kenyan families.'
  }
  if (s.includes('business') || s.includes('commerce')) {
    return 'Use market, entrepreneurship, or trade scenarios a Kenyan learner would recognise.'
  }
  if (s.includes('art') || s.includes('craft') || s.includes('music') || s.includes('pe') || s.includes('physical')) {
    return 'Use practical, hands-on creative or physical examples suited to a Kenyan school setting.'
  }
  return 'Use everyday examples and scenarios a Kenyan learner would recognise from school or home life.'
}
