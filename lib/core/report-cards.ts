import { createServiceClient } from '@/utils/supabase/service'
import type { SchoolReportCard, ReportCardWithSubjects, CbcLevel } from '@/types/core'

const REPORT_COLS = 'id, school_id, learner_id, term_id, class_id, overall_score, overall_cbc_level, position_in_class, total_learners, days_present, days_absent, class_teacher_comment, headteacher_comment, pdf_url, is_published, published_at, generated_at, created_at, updated_at'

export async function generateReportCards(
  schoolId: string,
  classId: string,
  termId: string,
  gradeBoundaries: Record<string, { min: number }>
): Promise<{ generated: number; skipped: number }> {
  const supabase = createServiceClient()

  // Get all enrolled learners for this class + term
  const { data: enrollments } = await supabase
    .from('learner_enrollments')
    .select('learner_id')
    .eq('class_id', classId)
    .eq('term_id', termId)
    .eq('status', 'active')

  if (!enrollments?.length) return { generated: 0, skipped: 0 }

  const learnerIds = enrollments.map((e) => e.learner_id)
  const totalLearners = learnerIds.length

  // Get term subject summaries for this class
  const { data: summaries } = await supabase
    .from('term_subject_summaries')
    .select('learner_id, weighted_score, cbc_level')
    .eq('class_id', classId)
    .eq('term_id', termId)
    .in('learner_id', learnerIds)

  // Aggregate overall score per learner
  const learnerAgg: Record<string, { scores: number[]; levels: CbcLevel[] }> = {}
  for (const s of summaries ?? []) {
    if (!learnerAgg[s.learner_id]) learnerAgg[s.learner_id] = { scores: [], levels: [] }
    if (s.weighted_score != null) learnerAgg[s.learner_id].scores.push(s.weighted_score)
    if (s.cbc_level) learnerAgg[s.learner_id].levels.push(s.cbc_level as CbcLevel)
  }

  const toCbcLevel = (score: number): CbcLevel => {
    if (score >= (gradeBoundaries.EE?.min ?? 75)) return 'EE'
    if (score >= (gradeBoundaries.ME?.min ?? 50)) return 'ME'
    if (score >= (gradeBoundaries.AE?.min ?? 25)) return 'AE'
    return 'BE'
  }

  // Sort learners by average score for position ranking
  const ranked = learnerIds
    .map((id) => {
      const agg = learnerAgg[id]
      const avg = agg?.scores.length ? agg.scores.reduce((a, b) => a + b, 0) / agg.scores.length : 0
      return { learner_id: id, avg }
    })
    .sort((a, b) => b.avg - a.avg)

  const rows = ranked.map((r, i) => ({
    school_id: schoolId,
    learner_id: r.learner_id,
    term_id: termId,
    class_id: classId,
    overall_score: Math.round(r.avg * 100) / 100,
    overall_cbc_level: toCbcLevel(r.avg),
    position_in_class: i + 1,
    total_learners: totalLearners,
    is_published: false,
    generated_at: new Date().toISOString(),
  }))

  const { error } = await supabase
    .from('school_report_cards')
    .upsert(rows, { onConflict: 'learner_id,term_id' })
  if (error) throw new Error(`generateReportCards: ${error.message}`)

  return { generated: rows.length, skipped: 0 }
}

export async function updateReportCard(
  reportId: string,
  schoolId: string,
  updates: Pick<SchoolReportCard, 'class_teacher_comment' | 'headteacher_comment' | 'days_present' | 'days_absent'>
): Promise<SchoolReportCard> {
  const supabase = createServiceClient()
  const { data, error } = await supabase
    .from('school_report_cards')
    .update(updates)
    .eq('id', reportId)
    .eq('school_id', schoolId)
    .select(REPORT_COLS)
    .single()
  if (error) throw new Error(`updateReportCard: ${error.message}`)
  return data
}

export async function publishReportCards(
  schoolId: string,
  termId: string,
  classId?: string
): Promise<{ published: number }> {
  const supabase = createServiceClient()
  let query = supabase
    .from('school_report_cards')
    .update({ is_published: true, published_at: new Date().toISOString() })
    .eq('school_id', schoolId)
    .eq('term_id', termId)
    .eq('is_published', false)
  if (classId) query = query.eq('class_id', classId)
  const { data, error } = await query.select('id')
  if (error) throw new Error(`publishReportCards: ${error.message}`)
  return { published: data?.length ?? 0 }
}

export async function getReportCard(
  learnerId: string,
  termId: string
): Promise<ReportCardWithSubjects | null> {
  const supabase = createServiceClient()
  const { data } = await supabase
    .from('school_report_cards')
    .select(`
      ${REPORT_COLS},
      learners (id, first_name, middle_name, last_name, admission_number),
      term_subject_summaries (
        id, subject_id, weighted_score, cbc_level, position_in_class, teacher_comment,
        subjects (id, name, code)
      )
    `)
    .eq('learner_id', learnerId)
    .eq('term_id', termId)
    .single()
  return data as unknown as ReportCardWithSubjects | null
}

export async function listClassReportCards(
  classId: string,
  termId: string
): Promise<SchoolReportCard[]> {
  const supabase = createServiceClient()
  const { data, error } = await supabase
    .from('school_report_cards')
    .select(REPORT_COLS)
    .eq('class_id', classId)
    .eq('term_id', termId)
    .order('position_in_class')
  if (error) throw new Error(`listClassReportCards: ${error.message}`)
  return data
}

export async function updatePdfUrl(reportId: string, pdfUrl: string): Promise<void> {
  const supabase = createServiceClient()
  const { error } = await supabase
    .from('school_report_cards')
    .update({ pdf_url: pdfUrl })
    .eq('id', reportId)
  if (error) throw new Error(`updatePdfUrl: ${error.message}`)
}
