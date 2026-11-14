// lib/curriculum/displaySchemeGrade.ts
//
// How a saved scheme's grade is shown to a teacher.
//
// `schemes_of_work.grade` is free text that the wizard saves WITH its label
// ("Grade 8", "Grade 10", "Form 3" — see app/api/sow/save/route.ts). A screen
// that prefixes "Grade " to it prints "Grade Grade 8" and "Grade Form 3".
// This formatter adds a label only when the stored value has none.
//
// It never infers a curriculum from a number: a bare "11" is shown as
// "Grade 11" exactly as bare numbers always were, and nothing here makes any
// grade selectable or supported. Pure: no DB, no AI.

/** Already carries its own label ("Grade 8", "Grade 7 (JSS)", "Form 3", "Gredi 8", "Kidato 3"). */
const LABELLED = /^(grade|form|gredi|kidato)\b/i

/**
 * The text to print for a stored scheme grade.
 *  - labelled value  → unchanged            ("Grade 8" → "Grade 8", "Form 3" → "Form 3")
 *  - bare number     → "Grade N"            ("8" → "Grade 8")
 *  - anything else   → unchanged            (never guessed)
 *  - empty / missing → ""
 */
export function displaySchemeGrade(stored: string | number | null | undefined): string {
  const value = String(stored ?? '').trim()
  if (value === '') return ''
  if (LABELLED.test(value)) return value
  if (/^\d{1,2}$/.test(value)) return `Grade ${value}`
  return value
}

/** The field label to use next to a displayed grade: "Form" for 8-4-4 forms, otherwise "Grade". */
export function schemeGradeFieldLabel(stored: string | number | null | undefined): 'Grade' | 'Form' {
  return /^(form|kidato)\b/i.test(displaySchemeGrade(stored)) ? 'Form' : 'Grade'
}
