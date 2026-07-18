// lib/quiz/quizPure.ts
// Pure types + auto-grade logic — no Supabase import, safe for client
// components. Kenya classroom shape: a fixed set of MCQ questions, every
// student answers the same set, graded instantly (no waiting for the
// teacher to mark a stack of papers).

export type QuizQuestion = {
  id: string
  choices: string[]
  correctIndex: number
}

export type QuizAnswer = {
  questionId: string
  selectedIndex: number
}

export type QuizGradeResult = {
  correctCount: number
  total: number
  score: number // scaled to maxScore, rounded
}

export function gradeQuiz(questions: QuizQuestion[], answers: QuizAnswer[], maxScore: number): QuizGradeResult {
  const total = questions.length
  let correctCount = 0
  for (const q of questions) {
    const answer = answers.find(a => a.questionId === q.id)
    if (answer && answer.selectedIndex === q.correctIndex) correctCount += 1
  }
  const score = total > 0 ? Math.round((correctCount / total) * maxScore) : 0
  return { correctCount, total, score }
}
