// GET /api/school/strand-health?grade=7&subject=Mathematics
// Returns top 20 struggling substrands across the teacher's school, optionally
// filtered by grade and/or subject. Aggregates struggle_count across classes.
// Ordered by risk_score DESC (most acute first).

import { createClient } from '@/utils/supabase/server'
import { createServiceClient } from '@/utils/supabase/service'
import { apiSuccess, apiError, apiUnauthorized, apiForbidden } from '@/lib/api/response'
import { repos } from '@/lib/repositories'

type StrandRow = {
  substrand: string
  strand: string
  subject: string
  grade: number
  total_struggle_count: number
  total_students: number
  avg_risk_score: number
  avg_assessment_level: number
  trend: string
  class_count: number
}

type StrandHealthResponse = {
  strands: StrandRow[]
}

export async function GET(req: Request): Promise<Response> {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return apiUnauthorized()

    const db = createServiceClient()
    const teacher = await repos.teachers.findTeacherByUserId(user.id)
    if (!teacher) return apiForbidden()

    const schoolUser = await repos.schools.findSchoolUserByUserId(user.id)
    if (!schoolUser) return apiError('Teacher is not associated with a school', 403)

    const url     = new URL(req.url)
    const grade   = url.searchParams.get('grade')
    const subject = url.searchParams.get('subject')

    // Find all teachers in this school via Core School membership
    // (school_users), not free-text school_name matching.
    const schoolTeachers = await repos.schools.findTeachersBySchoolId(schoolUser.school_id)

    if (!schoolTeachers.length) {
      return apiSuccess<StrandHealthResponse>({ strands: [] })
    }

    const teacherIds = schoolTeachers.map(t => t.id)

    // Find all class_ids taught by school teachers, optionally filtered
    let classQuery = db
      .from('teacher_classes')
      .select('id, grade, subject')
      .in('teacher_id', teacherIds)

    if (grade) {
      classQuery = classQuery.eq('grade', parseInt(grade, 10))
    }
    if (subject) {
      classQuery = classQuery.eq('subject', subject)
    }

    const { data: classes } = await classQuery

    if (!classes?.length) {
      return apiSuccess<StrandHealthResponse>({ strands: [] })
    }

    const classIds    = classes.map(c => c.id as string)
    const classGradeMap = new Map<string, number>(
      classes.map(c => [c.id as string, c.grade as number])
    )

    // Pull substrand_health rows for these classes
    const { data: healthRows } = await db
      .from('substrand_health')
      .select(
        'class_id, sub_strand, strand, subject, struggle_count, total_students, risk_score, assessment_level, trend'
      )
      .in('class_id', classIds)
      .order('risk_score', { ascending: false })

    if (!healthRows?.length) {
      return apiSuccess<StrandHealthResponse>({ strands: [] })
    }

    // Aggregate across classes — group by substrand + subject
    type AggEntry = {
      strand: string
      subject: string
      grade: number
      total_struggle_count: number
      total_students: number
      risk_score_sum: number
      assessment_level_sum: number
      trend_counts: Record<string, number>
      class_count: number
    }

    const agg = new Map<string, AggEntry>()

    for (const row of healthRows) {
      const key = `${row.sub_strand as string}||${row.subject as string}`

      if (!agg.has(key)) {
        agg.set(key, {
          strand:               row.strand as string,
          subject:              row.subject as string,
          grade:                classGradeMap.get(row.class_id as string) ?? 0,
          total_struggle_count: 0,
          total_students:       0,
          risk_score_sum:       0,
          assessment_level_sum: 0,
          trend_counts:         {},
          class_count:          0,
        })
      }

      const entry = agg.get(key)!
      entry.total_struggle_count += row.struggle_count as number
      entry.total_students       += row.total_students as number
      entry.risk_score_sum       += row.risk_score as number
      entry.assessment_level_sum += row.assessment_level as number
      entry.class_count          += 1

      const trend = (row.trend as string) ?? 'stable'
      entry.trend_counts[trend] = (entry.trend_counts[trend] ?? 0) + 1
    }

    // Build output rows, sorted by avg_risk_score DESC, capped at 20
    const strands: StrandRow[] = [...agg.entries()]
      .map(([key, entry]) => {
        const substrand    = key.split('||')[0]
        const dominantTrend = Object.entries(entry.trend_counts)
          .sort(([, a], [, b]) => b - a)[0]?.[0] ?? 'stable'

        return {
          substrand,
          strand:               entry.strand,
          subject:              entry.subject,
          grade:                entry.grade,
          total_struggle_count: entry.total_struggle_count,
          total_students:       entry.total_students,
          avg_risk_score:       Math.round((entry.risk_score_sum / entry.class_count) * 10) / 10,
          avg_assessment_level: Math.round((entry.assessment_level_sum / entry.class_count) * 10) / 10,
          trend:                dominantTrend,
          class_count:          entry.class_count,
        } satisfies StrandRow
      })
      .sort((a, b) => b.avg_risk_score - a.avg_risk_score)
      .slice(0, 20)

    return apiSuccess<StrandHealthResponse>({ strands })
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e)
    console.error('[school/strand-health]', msg)
    return apiError('Failed to load strand health')
  }
}
