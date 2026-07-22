// lib/core/client/termStatus.ts
//
// Sprint 10F — extracted, not new: this is the exact per-class assessment/
// report completion computation that previously lived only inline in
// app/teacher/core-term/status/page.tsx's effect. The School Office
// landing page (app/teacher/core-office, renamed from core-readiness in
// Sprint 10G) needs the same summary for its
// End-of-Term workflow card; extracting it here means both screens call
// one function instead of the fetch loop being copy-pasted a second time
// (Sprint 10F Phase 10's "no duplicated workflow"). Still composes only
// existing routes (/api/core/classes, /api/core/assessments,
// /api/core/reports) — no new query, no new business logic.
import type { ClassWithDetails, SchoolReportCard, Term } from '@/types/core'

export type CoreAssessment = { id: string; is_published: boolean }

export type ClassTermStatus = {
  classId: string
  className: string
  assessmentState: 'missing' | 'pending' | 'locked'
  reportState: 'missing' | 'generated' | 'published'
  // Sprint C0 Task 2 — previously absent: callers inferred "End of Term
  // summaries are done" from assessmentState === 'locked' alone, which is
  // wrong (locking and computing term_subject_summaries are two distinct
  // steps — app/teacher/core-term/page.tsx's own 'compute' action is what
  // actually populates them, and a school could have every assessment
  // locked with zero summaries computed). This reuses the exact same
  // `view=summary&termId=` read that page's `summaryReady` state already
  // makes — no new endpoint, no new business logic.
  summariesComputed: boolean
}

async function fetchJson<T>(url: string): Promise<T> {
  const res = await fetch(url, { credentials: 'include' })
  const json = await res.json()
  if (!res.ok) throw new Error(json.error?.formErrors?.[0] ?? json.error ?? 'Request failed')
  return json.data as T
}

export async function fetchClassTermStatuses(schoolId: string, currentTerm: Term): Promise<ClassTermStatus[]> {
  const year = new Date(currentTerm.start_date).getFullYear()
  const { classes } = await fetchJson<{ classes: ClassWithDetails[] }>(`/api/core/classes?schoolId=${schoolId}`)

  return Promise.all(classes.map(async (c): Promise<ClassTermStatus> => {
    const [assessments, reportCards, summaries] = await Promise.all([
      fetchJson<CoreAssessment[]>(
        `/api/core/assessments?schoolId=${schoolId}&classId=${c.id}&term=${currentTerm.term_number}&year=${year}`
      ).catch(() => [] as CoreAssessment[]),
      fetchJson<SchoolReportCard[]>(
        `/api/core/reports?schoolId=${schoolId}&classId=${c.id}&termId=${currentTerm.id}`
      ).catch(() => [] as SchoolReportCard[]),
      fetchJson<unknown[]>(
        `/api/core/assessments?schoolId=${schoolId}&classId=${c.id}&view=summary&termId=${currentTerm.id}`
      ).catch(() => [] as unknown[]),
    ])
    const assessmentState: ClassTermStatus['assessmentState'] =
      assessments.length === 0 ? 'missing' : assessments.every(a => a.is_published) ? 'locked' : 'pending'
    const reportState: ClassTermStatus['reportState'] =
      reportCards.length === 0 ? 'missing' : reportCards.every(r => r.is_published) ? 'published' : 'generated'
    return { classId: c.id, className: c.display_name ?? c.class_name, assessmentState, reportState, summariesComputed: summaries.length > 0 }
  }))
}
