import { createServiceClient } from '@/utils/supabase/service'

export interface TopicProgress {
  topic:         string
  topicDisplay:  string
  subject:       string
  sessions: {
    date:      string
    mastery:   number
    correct:   number
    attempted: number
  }[]
  latestMastery: number
  improvement:   number
  mastered:      boolean
  trend:         'improving' | 'steady' | 'needs_work'
}

export async function getStudentProgress(studentId: string): Promise<TopicProgress[]> {
  const db = createServiceClient()

  const { data: sessions } = await db
    .from('learn_sessions')
    .select('topic, topic_display, subject, mastery_score, questions_correct, questions_attempted, completed_at')
    .eq('student_id', studentId)
    .eq('status', 'complete')
    .order('completed_at', { ascending: true })

  if (!sessions?.length) return []

  const byTopic: Record<string, typeof sessions> = {}
  for (const s of sessions) {
    if (!byTopic[s.topic]) byTopic[s.topic] = []
    byTopic[s.topic].push(s)
  }

  return Object.values(byTopic).map(list => {
    const scores      = list.map(s => s.mastery_score as number)
    const first       = scores[0]
    const latest      = scores[scores.length - 1]
    const improvement = latest - first

    return {
      topic:        list[0].topic as string,
      topicDisplay: list[0].topic_display as string,
      subject:      list[0].subject as string,
      sessions:     list.map(s => ({
        date:      s.completed_at as string,
        mastery:   s.mastery_score as number,
        correct:   s.questions_correct as number,
        attempted: s.questions_attempted as number,
      })),
      latestMastery: latest,
      improvement,
      mastered: latest >= 80,
      trend: improvement >= 15 ? 'improving' : improvement >= 0 ? 'steady' : 'needs_work',
    }
  })
}
