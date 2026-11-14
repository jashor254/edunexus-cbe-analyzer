// lib/sow/promptGradeLabel.test.ts
//
// Regression: the JSON example in the SOW lesson prompt printed
// "Teacher's Guide for Integrated Science Grade Grade 7" (and "Gredi Gredi",
// "Form Form 3"). The instruction text strips the "Grade "/"Form " prefix
// (gradeNum) but the example resource used the raw `grade`, so a wizard grade
// that already carries its prefix — which is how every caller sends it —
// doubled the word. The model copies the example, so the doubled label could
// reach a printed Scheme of Work.
//
// Real prompt builder via generateValidatedLesson; only the AI wrapper is
// mocked (it captures the prompt). No network.
//
// Run: npx tsx --experimental-test-module-mocks --test lib/sow/promptGradeLabel.test.ts
import { test, before, beforeEach, mock } from 'node:test'
import assert from 'node:assert/strict'

const prompts: string[] = []
mock.module('@/lib/ai/deepseek', {
  namedExports: { callDeepSeek: async (prompt: string) => { prompts.push(prompt); return 'not json' } },
})
let generateValidatedLesson: typeof import('./aiLessonGenerator').generateValidatedLesson
before(async () => { ({ generateValidatedLesson } = await import('./aiLessonGenerator')) })
beforeEach(() => { prompts.length = 0 })

async function promptFor(grade: string, learningArea: string, curriculumMode: 'cbc_junior' | 'cbc_senior' | '844_form3', textbook?: string): Promise<string> {
  await generateValidatedLesson({
    learningArea, grade, strand: 'S', substrand: 'Laboratory Safety', lessonNumber: 1, totalLessons: 2,
    curriculumMode, subjectType: 'default', textbook,
  })
  assert.ok(prompts.length > 0)
  return prompts[0]
}

test('GRADE-001 English prompt: no doubled Grade/Form word, whatever the grade prefix', async () => {
  for (const [grade, mode] of [['Grade 7', 'cbc_junior'], ['Grade 10', 'cbc_senior'], ['Form 3', '844_form3']] as const) {
    const p = await promptFor(grade, 'Integrated Science', mode)
    assert.doesNotMatch(p, /Grade\s+Grade/i, `${grade}`)
    assert.doesNotMatch(p, /Form\s+Form/i, `${grade}`)
  }
})

test('GRADE-002 English prompt: the example Teacher\'s Guide names the grade exactly once', async () => {
  const p = await promptFor('Grade 7', 'Integrated Science', 'cbc_junior')
  const matches = p.match(/Teacher's Guide for Integrated Science Grade 7\b/g) ?? []
  assert.ok(matches.length >= 2, 'instruction line and JSON example both read "…Grade 7"')
  assert.match(p, /"Teacher's Guide for Integrated Science Grade 7",/)
})

test('GRADE-003 a bare numeric grade is still labelled', async () => {
  const p = await promptFor('7', 'Integrated Science', 'cbc_junior')
  assert.match(p, /Teacher's Guide for Integrated Science Grade 7/)
  assert.doesNotMatch(p, /Grade\s+Grade/i)
})

test('GRADE-004 Kiswahili prompt: no "Gredi Gredi" / "Kidato Kidato"', async () => {
  const g = await promptFor('Grade 8', 'Kiswahili', 'cbc_junior')
  assert.doesNotMatch(g, /Gredi\s+Gredi/i)
  assert.match(g, /Mwongozo wa Mwalimu wa Kiswahili Gredi 8/)
  const f = await promptFor('Form 3', 'Kiswahili', '844_form3')
  assert.doesNotMatch(f, /Kidato\s+Kidato/i)
})

test('GRADE-005 a teacher-typed textbook is untouched', async () => {
  const p = await promptFor('Grade 7', 'Integrated Science', 'cbc_junior', 'Spotlight Integrated Science Grade 7')
  assert.match(p, /"Spotlight Integrated Science Grade 7"/)
})
