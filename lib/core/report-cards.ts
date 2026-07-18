import { repos } from '@/lib/repositories'
import { publishEvent } from '@/lib/events'
import { computeRankings } from '@/lib/ranking'
import { gradeScore } from '@/lib/grading'
import type { GradeScale } from '@/lib/grading'
import type { SchoolReportCard, ReportCardWithSubjects, CbcLevel } from '@/types/core'
import { getAttendanceStatusCountsForClass } from '@/lib/core/attendance'
import { createBlueprintSnapshot } from '@/lib/learnerBlueprint/snapshot'

// Sprint 12B (ADR-0004 — Attendance -> Report Card Integration): Report
// Cards is the consumer here, Attendance the owner. `days_present`/
// `days_absent` are computed by THIS module, from Attendance's raw
// per-status counts (`getAttendanceStatusCountsForClass`), never the
// other way around — Report Cards decides what "present"/"absent" mean
// for its own two-column field; Attendance never makes that decision on
// a consumer's behalf (ADR-0004 §4). `late` counts toward Present (a
// learner who arrived late still attended that day); `excused` counts
// toward Absent (the learner did not attend, regardless of reason) — a
// Report Cards-owned interpretation, not an Attendance concept.
//
// Computed once, at generation time, and stored — an immutable snapshot,
// exactly like `overall_score`/`overall_cbc_level`/`position_in_class`
// already are on this same table (Phase 6 historical-semantics decision:
// this table already only ever computes-once-and-stores, never
// recomputes-on-view; attendance follows that existing precedent, not a
// new one invented for this sprint). If no Attendance session exists at
// all for a learner's class/term, both fields are stored as `null` —
// "no data available," never a fabricated zero that would misleadingly
// read as perfect attendance.
function toReportCardAttendance(counts: { present: number; absent: number; late: number; excused: number } | undefined): {
  days_present: number | null
  days_absent: number | null
} {
  if (!counts) return { days_present: null, days_absent: null }
  return {
    days_present: counts.present + counts.late,
    days_absent: counts.absent + counts.excused,
  }
}

export async function generateReportCards(
  actorUserId: string,
  schoolId: string,
  classId: string,
  termId: string,
  gradeBoundaries: Record<string, { min: number }>
): Promise<{ generated: number; skipped: number }> {
  // Sprint 5B integrity guard (docs/engineering/sprint-5a-report-card-lifecycle-audit.md
  // Part 4/7, docs/engineering/implementation-log.md): refuses to generate
  // if ANY report card for this class/term is already published.
  // upsertReportCards below writes on `ON CONFLICT (learner_id, term_id)`,
  // which would otherwise silently overwrite a published card's stored
  // grade AND reset is_published back to false (the Critical finding Sprint
  // 5A confirmed still live). All-or-nothing: this check runs before any
  // read/write below, so a mixed class (some published, some still draft)
  // is refused in full rather than partially regenerated.
  const existing = await repos.schools.listClassReportCards(classId, termId)
  const publishedCount = existing.filter((r) => r.is_published).length
  if (publishedCount > 0) {
    throw new Error(
      `generateReportCards refused: ${publishedCount} report card(s) for class ${classId}, term ${termId} ` +
        `are already published. Regenerating would silently overwrite published grades and reset publication ` +
        `status. No records were modified — unpublish the affected report cards first if regeneration is intended.`
    )
  }

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

  // Sprint 4C1 (docs/engineering/sprint-4c0-grading-policy-integration.md,
  // Option B, docs/engineering/implementation-log.md): activates the
  // dormant school_settings.grade_boundaries capability through the
  // canonical Grading Engine (lib/grading) instead of a local closure. The
  // boundary VALUES are unchanged — same gradeBoundaries parameter, same
  // 75/50/25 fallback defaults — only the computation now runs through
  // gradeScore(). BE's floor is always 0 (matching the deleted closure's
  // unconditional `return 'BE'` for anything below AE). This does not
  // change generateReportCards's stored-once-at-generation behaviour
  // (Sprint 4C0 Part 5) or its known re-generation/publish-guard gap
  // (tracked separately, not touched by this sprint).
  const cbcScale: GradeScale = {
    name: 'CBC (school-configured, school_settings.grade_boundaries)',
    bands: [
      { label: 'EE', minPct: gradeBoundaries.EE?.min ?? 75 },
      { label: 'ME', minPct: gradeBoundaries.ME?.min ?? 50 },
      { label: 'AE', minPct: gradeBoundaries.AE?.min ?? 25 },
      { label: 'BE', minPct: 0 },
    ],
  }
  // Clamped defensively — see lib/core/assessments.ts's identical comment.
  const toCbcLevel = (score: number): CbcLevel =>
    gradeScore(Math.min(100, Math.max(0, score)), 100, cbcScale).grade as CbcLevel

  // Average score per learner, in enrollment order (ranking assigned below)
  const learnerAvgs = learnerIds.map((id) => {
    const agg = learnerAgg[id]
    const avg = agg?.scores.length ? agg.scores.reduce((a, b) => a + b, 0) / agg.scores.length : 0
    return { learner_id: id, avg }
  })

  // Sprint 3D migration (docs/engineering/sprint-3-assessment-domain-audit.md
  // §4, docs/architecture/deprecation-registry.md #4, docs/engineering/
  // implementation-log.md): delegates to the canonical Ranking Engine
  // (lib/ranking) instead of `i+1` sequential assignment, which never
  // handled ties. This is an intentional behaviour change, same class of
  // fix as Sprint 3C's updateClassPositions — tied overall averages
  // (including multiple learners with no scores at all, avg=0) now share a
  // class position instead of receiving arbitrary, enrollment-order-
  // dependent distinct positions. This is the parent-facing, published-
  // report-card instance of that defect.
  const ranked = computeRankings(learnerAvgs.map((r) => ({ id: r.learner_id, score: r.avg })))
  const avgByLearnerId = new Map(learnerAvgs.map((r) => [r.learner_id, r.avg]))

  // Sprint 12B — Attendance is the owner, Report Cards the consumer: one
  // bulk read for the whole class/term (never a per-learner loop against
  // Attendance — see getAttendanceStatusCountsForClass's own doc comment
  // for the N+1 this avoids), then this module decides what "present"/
  // "absent" mean for its own two columns.
  const attendanceCounts = await getAttendanceStatusCountsForClass(actorUserId, schoolId, classId, termId)

  const rows = ranked.map((r) => {
    const avg = avgByLearnerId.get(r.id) ?? 0
    return {
      school_id: schoolId,
      learner_id: r.id,
      term_id: termId,
      class_id: classId,
      overall_score: Math.round(avg * 100) / 100,
      overall_cbc_level: toCbcLevel(avg),
      position_in_class: r.position,
      total_learners: totalLearners,
      is_published: false,
      generated_at: new Date().toISOString(),
      ...toReportCardAttendance(attendanceCounts[r.id]),
    }
  })

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
  actorUserId: string,
  schoolId: string,
  termId: string,
  classId?: string,
  // Sprint 12K: `publishReportCards` is called two ways — standalone (the
  // direct publish API route) or as one step inside `runEndOfTerm`
  // (lib/core/endOfTerm.ts). Both are real, distinct ADR-0008 Part 3
  // triggers; the snapshot type reflects which one actually happened,
  // never both at once for the same publish event (never a duplicate
  // snapshot for one real moment). Defaults to the standalone case.
  snapshotType: 'report_card_publication' | 'end_of_term' = 'report_card_publication'
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

  // Sprint 12K (ADR-0008 Part 3): one Blueprint Snapshot per learner whose
  // report card was just published — the first of the three frozen
  // triggers. Awaited (not fire-and-forget — an un-awaited promise can be
  // killed mid-flight when a serverless function's response returns) but
  // non-fatal: a snapshot failure is caught and logged, never thrown, so
  // it can never block or roll back the actual report-card publish, which
  // has already succeeded by this point. lib/learnerBlueprint owns this
  // entirely; report-cards.ts never composes or persists a Blueprint
  // itself.
  for (const card of result.publishedCards) {
    await createBlueprintSnapshot({
      coreLearnerId: card.learner_id,
      schoolId,
      academicYearId: null,
      termId,
      snapshotType,
      sourceRecordId: card.id,
      actorUserId,
    }).catch(err => console.error(`[blueprint-snapshot] ${snapshotType}:`, err instanceof Error ? err.message : String(err)))
  }

  return { published: result.published }
}

// Security Hotfix SH-001 (docs/engineering/sprint-5c-service-role-authorization-audit.md,
// docs/engineering/implementation-log.md): findReportCardWithSubjects
// filters only by learner_id/term_id, never school_id — a caller who
// passed a valid schoolId (to pass the route's requireSchoolMembership
// check) but a DIFFERENT school's learnerId could read that school's
// report card. Fixed by verifying ownership first, via the existing,
// already-school-scoped LearnerRepository::findById — no new lookup
// logic, no new repository method. Deliberately indistinguishable from
// "learner not found": both cases throw the same generic error, giving an
// attacker no signal that a cross-school learnerId exists at all.
//
// `schoolId` is optional: app/api/core/reports/route.ts (school-staff,
// membership-scoped) always supplies it and the check runs.
// app/api/reports/report-card/route.ts (parent-facing) does not — that
// route already gates on `requireParent(supabase, learnerId)`, which
// proves the caller is a guardian of THIS specific learnerId, a stronger,
// per-resource check than a school-membership one. Adding a school lookup
// there would be an unrelated new query for no additional protection.
export async function getReportCard(
  learnerId: string,
  termId: string,
  schoolId?: string
): Promise<ReportCardWithSubjects | null> {
  if (schoolId) await repos.learners.findById(learnerId, schoolId)
  return repos.schools.findReportCardWithSubjects(learnerId, termId)
}

// Security Hotfix SH-001 — same fix, same reasoning, for the class-scoped
// read: listClassReportCards filters only by class_id/term_id, never
// school_id. Verified first via the existing, already-school-scoped
// TeacherRepository::findClassById.
export async function listClassReportCards(
  classId: string,
  termId: string,
  schoolId: string
): Promise<SchoolReportCard[]> {
  await repos.teachers.findClassById(classId, schoolId)
  return repos.schools.listClassReportCards(classId, termId)
}

export async function updatePdfUrl(reportId: string, pdfUrl: string): Promise<void> {
  return repos.schools.updateReportPdfUrl(reportId, pdfUrl)
}
