// app/api/parent/compass-activity/route.ts
// Returns Compass session activity for all students linked to the parent.
// Used by the parent dashboard to show: subject, level movement, summary, XP.
import { createServiceClient } from '@/utils/supabase/service'
import { createClient }        from '@/utils/supabase/server'
import { repos } from '@/lib/repositories'
import { apiSuccess, apiError, getErrorMessage } from '@/lib/api/response'

// Plain-language only — parents see "Meeting", never the raw CBC code
// ('ME') that this maps from (Sprint 19: teacher/Core surfaces keep the
// raw CbcLevel codes; this route is parent-facing only).
const LEVEL_NAME: Record<number, string> = {
  1: 'Beginning', 2: 'Approaching', 3: 'Meeting', 4: 'Exceeding',
}

export type CompassActivitySession = {
  id:              string
  studentId:       string
  studentName:     string
  grade:           number
  subject:         string
  exchangeCount:   number
  xpEarned:        number
  startingLevel:   number | null
  endingLevel:     number | null
  levelGained:     boolean
  summary:         string | null
  createdAt:       string
  weekLabel:       string   // e.g. "This week" | "Last week" | "23 Jun"
}

export type CompassActivityResult = {
  sessions:         CompassActivitySession[]
  totalSessions:    number
  totalXp:          number
  activeStudents:   string[]   // student names who had sessions this week
  weeklyCount:      number
}

function weekLabel(iso: string): string {
  const date  = new Date(iso)
  const now   = new Date()
  const monday = (d: Date) => {
    const x = new Date(d); x.setHours(0,0,0,0)
    const day = x.getDay(); x.setDate(x.getDate() - (day === 0 ? 6 : day - 1))
    return x
  }
  const thisMonday = monday(now).getTime()
  const lastMonday = thisMonday - 7 * 24 * 60 * 60 * 1000
  const sessionMonday = monday(date).getTime()
  if (sessionMonday === thisMonday) return 'This week'
  if (sessionMonday === lastMonday) return 'Last week'
  return date.toLocaleDateString('en-KE', { day: 'numeric', month: 'short' })
}

export async function GET(): Promise<Response> {
  try {
    const auth = await createClient()
    const { data: { user } } = await auth.auth.getUser()
    if (!user) return apiError('Unauthenticated', 401)

    const db = createServiceClient()

    // All students belonging to this parent (both scenarios)
    const students = await repos.compass.findOwnedStudents(user.id)

    if (!students || students.length === 0) {
      return apiSuccess<CompassActivityResult>({
        sessions: [], totalSessions: 0, totalXp: 0,
        activeStudents: [], weeklyCount: 0,
      })
    }

    const studentIds = students.map(s => s.id as string)
    const studentMap = Object.fromEntries(
      students.map(s => [s.id as string, { name: s.name as string, grade: s.grade as number }])
    )

    // Last 30 days of sessions that had at least 1 exchange
    const thirtyDaysAgo = new Date()
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30)

    const { data: sessions } = await db
      .from('compass_sessions')
      .select('id, learner_id, subject, exchange_count, xp_earned, starting_level, ending_level, one_line_summary, created_at')
      .in('learner_id', studentIds)
      .gte('created_at', thirtyDaysAgo.toISOString())
      .gt('exchange_count', 0)
      .order('created_at', { ascending: false })
      .limit(50)

    if (!sessions) {
      return apiSuccess<CompassActivityResult>({
        sessions: [], totalSessions: 0, totalXp: 0,
        activeStudents: [], weeklyCount: 0,
      })
    }

    // Week boundary for "this week" count
    const now = new Date(); now.setHours(0,0,0,0)
    const dayOfWeek = now.getDay()
    const thisMonday = new Date(now)
    thisMonday.setDate(now.getDate() - (dayOfWeek === 0 ? 6 : dayOfWeek - 1))

    let weeklyCount  = 0
    let totalXp      = 0
    const activeThisWeek = new Set<string>()

    const mapped: CompassActivitySession[] = sessions.map(s => {
      const studentId   = s.learner_id as string
      const student     = studentMap[studentId] ?? { name: 'Student', grade: 0 }
      const startLvl    = s.starting_level as number | null
      const endLvl      = s.ending_level   as number | null
      const xp          = (s.xp_earned as number | null) ?? 0
      const created     = s.created_at as string
      const lvlGained   = startLvl !== null && endLvl !== null && endLvl > startLvl
      const label       = weekLabel(created)

      totalXp += xp
      if (label === 'This week') {
        weeklyCount++
        activeThisWeek.add(student.name)
      }

      // Format subject nicely
      const subjectDisplay = (s.subject as string)
        .replace(/_/g, ' ')
        .replace(/\b\w/g, c => c.toUpperCase())

      // Build a parent-readable level line
      let levelLine: string | null = null
      if (startLvl && endLvl && startLvl !== endLvl) {
        levelLine = `${LEVEL_NAME[startLvl]} → ${LEVEL_NAME[endLvl]}`
      } else if (endLvl) {
        levelLine = `Currently ${LEVEL_NAME[endLvl]}`
      }

      return {
        id:            s.id as string,
        studentId,
        studentName:   student.name,
        grade:         student.grade,
        subject:       subjectDisplay,
        exchangeCount: (s.exchange_count as number | null) ?? 0,
        xpEarned:      xp,
        startingLevel: startLvl,
        endingLevel:   endLvl,
        levelGained:   lvlGained,
        summary:       (s.one_line_summary as string | null) ?? levelLine,
        createdAt:     created,
        weekLabel:     label,
      }
    })

    return apiSuccess<CompassActivityResult>({
      sessions:       mapped,
      totalSessions:  mapped.length,
      totalXp,
      activeStudents: [...activeThisWeek],
      weeklyCount,
    })
  } catch (err) {
    console.error('[parent/compass-activity]', err)
    return apiError(getErrorMessage(err), 500)
  }
}
