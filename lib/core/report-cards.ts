import { repos } from '@/lib/repositories'
import { publishEvent } from '@/lib/events'
import type { SchoolReportCard, ReportCardWithSubjects, CbcLevel } from '@/types/core'

export async function generateReportCards(
  schoolId: string,
  classId: string,
  termId: string,
  gradeBoundaries: Record<string, { min: number }>
): Promise<{ generated: number; skipped: number }> {
  const enrollments = await repos.schools.findActiveEnrollmentsByClass(classId, termId)

  if (!enrollments.length) return { generated: 0, skipped: 0 }

  const learnerIds = enrollments.map((e) => e.learner_id)
  const totalLearners = learnerIds.length

  const summaries = await repos.schools.findTermSubjectSummaries(classId, termId, learnerIds)

  // Aggregate overall score per learner
  const learnerAgg: Record<string, { scores: number[]; levels: CbcLevel[] }> = {}
  for (const s of summaries) {
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

  await repos.schools.upsertReportCards(rows)

  return { generated: rows.length, skipped: 0 }
}

export async function updateReportCard(
  reportId: string,
  schoolId: string,
  updates: Pick<SchoolReportCard, 'class_teacher_comment' | 'headteacher_comment' | 'days_present' | 'days_absent'>
): Promise<SchoolReportCard> {
  return repos.schools.updateReportCard(reportId, schoolId, updates)
}

export async function publishReportCards(
  schoolId: string,
  termId: string,
  classId?: string
): Promise<{ published: number }> {
  const result = await repos.schools.publishReportCards(schoolId, termId, classId)

  // Report-card publication is a high-stakes, parent-facing action (final
  // grades released) — same convention as the sibling publishAssessment()
  // (lib/core/assessments.ts), which already emits an event on publish.
  void publishEvent({
    event_type:    'teacher.report_card.published',
    resource_type: 'school_report_card',
    resource_id:   classId ?? termId,
    payload:       { school_id: schoolId, term_id: termId, class_id: classId, published_count: result.published },
  }).catch(err => console.error('[events] teacher.report_card.published:', err instanceof Error ? err.message : String(err)))

  return result
}

export async function getReportCard(
  learnerId: string,
  termId: string
): Promise<ReportCardWithSubjects | null> {
  return repos.schools.findReportCardWithSubjects(learnerId, termId)
}

export async function listClassReportCards(
  classId: string,
  termId: string
): Promise<SchoolReportCard[]> {
  return repos.schools.listClassReportCards(classId, termId)
}

export async function updatePdfUrl(reportId: string, pdfUrl: string): Promise<void> {
  return repos.schools.updateReportPdfUrl(reportId, pdfUrl)
}
