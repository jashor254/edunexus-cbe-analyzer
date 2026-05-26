export function gradeLabel(grade: number): string {
  if (grade === 11) return 'Form 3'
  if (grade === 12) return 'Form 4'
  return `Grade ${grade}`
}

export function curriculumBadge(grade: number): string {
  if (grade <= 9)    return 'CBC Junior'
  if (grade === 10)  return 'CBC Senior'
  if (grade === 11)  return '8-4-4 Form 3'
  if (grade === 12)  return '8-4-4 Form 4'
  return 'CBC'
}
