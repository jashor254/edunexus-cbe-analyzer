import { repos } from '@/lib/repositories'
import { formatSubjectName } from '@/lib/academicClinic/reportGenerator'

export interface SubjectProgress {
  subject:           string
  subjectDisplay:    string
  completedSessions: number
  totalMinutes:      number
  lastCompletedAt:   string | null
  recentSummaries:   string[]
}

export async function getStudentProgress(studentId: string): Promise<SubjectProgress[]> {
  const sessions = await repos.compass.findCompletedSessionsByLearner(studentId)

  if (!sessions.length) return []

  const bySubject: Record<string, typeof sessions> = {}
  for (const s of sessions) {
    const key = s.subject ?? 'unknown'
    if (!bySubject[key]) bySubject[key] = []
    bySubject[key].push(s)
  }

  return Object.entries(bySubject).map(([subject, list]) => {
    const totalSeconds = list.reduce((sum, s) => sum + (s.duration_seconds ?? 0), 0)
    const last = list[list.length - 1]

    return {
      subject,
      subjectDisplay:    formatSubjectName(subject),
      completedSessions: list.length,
      totalMinutes:       Math.round(totalSeconds / 60),
      lastCompletedAt:    last.completed_at ?? null,
      recentSummaries:    list
        .slice(-3)
        .map(s => s.one_line_summary)
        .filter((s): s is string => Boolean(s)),
    }
  })
}
