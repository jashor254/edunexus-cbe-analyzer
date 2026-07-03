import type { LearnerMark, SubjectAnalysis } from './types'

export function analyzeSubjects(
  marks: LearnerMark[],
  subjects: string[],
  maxScore: number
): SubjectAnalysis[] {
  return subjects.map((subject) => {
    const scores = marks
      .filter((m) => m.subject_scores[subject] !== undefined)
      .map((m) => ({
        name:  m.student_name,
        score: Number(m.subject_scores[subject]) || 0,
      }))

    if (scores.length === 0) {
      return {
        subject,
        highest:      null,
        lowest:       null,
        average:      0,
        passRate:     0,
        distribution: { a: 0, b: 0, c: 0, d: 0 },
      }
    }

    const sorted   = [...scores].sort((a, b) => b.score - a.score)
    const avg       = scores.reduce((s, x) => s + x.score, 0) / scores.length
    const threshold = maxScore * 0.5
    const passRate  = (scores.filter((x) => x.score >= threshold).length / scores.length) * 100

    const pct = (s: number) => (s / maxScore) * 100
    return {
      subject,
      highest:  sorted[0],
      lowest:   sorted[sorted.length - 1],
      average:  Math.round(avg * 10) / 10,
      passRate: Math.round(passRate),
      distribution: {
        a: scores.filter((x) => pct(x.score) >= 80).length,
        b: scores.filter((x) => pct(x.score) >= 60 && pct(x.score) < 80).length,
        c: scores.filter((x) => pct(x.score) >= 40 && pct(x.score) < 60).length,
        d: scores.filter((x) => pct(x.score) < 40).length,
      },
    }
  })
}
