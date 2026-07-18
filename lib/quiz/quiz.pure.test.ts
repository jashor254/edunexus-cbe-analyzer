// Run: npx tsx --test lib/quiz/quiz.pure.test.ts
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { gradeQuiz } from './quizPure'

const Q = (id: string, correctIndex: number) => ({ id, choices: ['A', 'B', 'C', 'D'], correctIndex })

test('gradeQuiz: all correct scores full marks', () => {
  const questions = [Q('q1', 0), Q('q2', 1), Q('q3', 2)]
  const answers = [{ questionId: 'q1', selectedIndex: 0 }, { questionId: 'q2', selectedIndex: 1 }, { questionId: 'q3', selectedIndex: 2 }]
  const result = gradeQuiz(questions, answers, 30)
  assert.deepEqual(result, { correctCount: 3, total: 3, score: 30 })
})

test('gradeQuiz: partial correctness scales proportionally to maxScore', () => {
  const questions = [Q('q1', 0), Q('q2', 1), Q('q3', 2), Q('q4', 3)]
  const answers = [
    { questionId: 'q1', selectedIndex: 0 }, // correct
    { questionId: 'q2', selectedIndex: 0 }, // wrong
    { questionId: 'q3', selectedIndex: 2 }, // correct
    { questionId: 'q4', selectedIndex: 0 }, // wrong
  ]
  const result = gradeQuiz(questions, answers, 20)
  assert.equal(result.correctCount, 2)
  assert.equal(result.score, 10) // 2/4 * 20
})

test('gradeQuiz: an unanswered question counts as wrong, not skipped', () => {
  const questions = [Q('q1', 0), Q('q2', 1)]
  const answers = [{ questionId: 'q1', selectedIndex: 0 }] // q2 never answered
  const result = gradeQuiz(questions, answers, 100)
  assert.equal(result.correctCount, 1)
  assert.equal(result.score, 50)
})

test('gradeQuiz: no questions produces a zero score, not NaN or a divide-by-zero crash', () => {
  const result = gradeQuiz([], [], 100)
  assert.deepEqual(result, { correctCount: 0, total: 0, score: 0 })
})

test('gradeQuiz: score rounds to the nearest whole mark', () => {
  const questions = [Q('q1', 0), Q('q2', 1), Q('q3', 2)]
  const answers = [{ questionId: 'q1', selectedIndex: 0 }] // 1/3 correct
  const result = gradeQuiz(questions, answers, 10)
  assert.equal(result.score, 3) // round(3.33) = 3
})
