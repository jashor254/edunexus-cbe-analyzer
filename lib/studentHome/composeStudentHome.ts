// lib/studentHome/composeStudentHome.ts
//
// Phase 7 — Learner Home Convergence. Composes the learner Home view model
// from EXISTING canonical reads only — no new learner-truth computation,
// no new intelligence engine, no Projection formula touched. Field
// provenance:
//
//   - identity            -> students/learners tables, the same legacy/
//                            institutional dual-branch app/api/student/home
//                            already used (Phase 1's compatibility bridge),
//                            plus the same students.external_id -> learners.id
//                            reverse lookup lib/core/identity.ts's
//                            resolveOwnCoreLearnerId already performs for
//                            Blueprint/Portfolio/Achievements/Timeline.
//   - assignments          -> lib/core/assignmentDiscovery.ts
//                            (listAssignmentsForAuthenticatedLearner, the
//                            SAME canonical function /api/student/assignments
//                            uses) for institutional learners; the same
//                            direct query app/api/student/home already ran
//                            for legacy learners, unchanged.
//   - approved actions      -> lib/learnerBlueprint/actionPlan/projections.ts
//                            (listApprovedForLearner + toLearnerView) — the
//                            exact function Phase 6 found had no learner-
//                            facing consumer. Only actions that are BOTH
//                            approved AND already delivered (a real
//                            assignment row or an active Compass delivery)
//                            are surfaced — an approved-but-undelivered
//                            action item is not a learner-meaningful state
//                            (Phase 7 §6).
//   - learning state/trend -> lib/projection/recompute.ts's
//                            recomputeLearnerProjection() academic/capability/
//                            risk/growth values — the same call
//                            app/api/student/home already made for
//                            futureReadiness; this phase only reads MORE of
//                            the same already-fetched Projection, never a
//                            second computation.
//   - Compass stats/sessions -> the same compass_sessions read the route
//                            already performed.
//
// Error isolation (Phase 7 §26): identity + assignments are load-bearing —
// if they fail, Home cannot render at all (same as before this phase).
// Approved-action lookup and Projection are wrapped so a failure there
// degrades gracefully (Home still shows assignments) rather than taking the
// whole page down.

import { createServiceClient } from '@/utils/supabase/service'
import { recomputeLearnerProjection } from '@/lib/projection/recompute'
import type { LearnerIntelligenceProjection } from '@/lib/projection/types'
import {
  resolveCurrentInstitutionalCompatibilityStudentId,
  listAssignmentsForAuthenticatedLearner,
  type LearnerAssignmentListItem,
} from '@/lib/core/assignmentDiscovery'
import { repos } from '@/lib/repositories'
import { resolveCoreLearnerIdForStudentId } from '@/lib/core/identity'
import { toBlueprintActionItem } from '@/lib/learnerBlueprint/actionPlan/types'
import { toLearnerView } from '@/lib/learnerBlueprint/actionPlan/projections'
import { formatSubjectName } from '@/lib/pathwayCalculator'
import {
  chooseNextAction, toNextActionCard, buildAttentionItems, trendLabel,
  deriveAssignmentState, deriveCompassDeliveryState,
} from './nextAction'
import type {
  LearnerHomeView, NextActionCandidate, SubjectLearningState, RecentProgressItem,
  ContinueAssignmentItem, ContinueSession,
} from './types'

const LEVEL_LABELS: Record<number, string> = {
  1: 'Beginning', 2: 'Approaching', 3: 'Meeting', 4: 'Exceeding',
}

function frsLabel(score: number): LearnerHomeView['stats']['frsLabel'] {
  if (score >= 82) return 'Leading'
  if (score >= 68) return 'Strong'
  if (score >= 52) return 'Growing'
  if (score >= 38) return 'Emerging'
  return 'Building'
}

function relativeDate(iso: string): string {
  const d = new Date(iso)
  const now = new Date()
  const diff = Math.floor((now.getTime() - d.getTime()) / 86_400_000)
  if (diff === 0) return 'Today'
  if (diff === 1) return 'Yesterday'
  if (diff < 7) return `${diff} days ago`
  return d.toLocaleDateString('en-KE', { day: 'numeric', month: 'short' })
}

function computeStreak(sessions: { created_at: string }[]): number {
  if (!sessions.length) return 0
  const days = new Set<string>()
  for (const s of sessions) days.add(new Date(s.created_at).toISOString().slice(0, 10))
  const sorted = [...days].sort().reverse()
  const today = new Date().toISOString().slice(0, 10)
  let streak = 0
  let expected = today
  for (const d of sorted) {
    if (d === expected) {
      streak++
      const prev = new Date(expected)
      prev.setDate(prev.getDate() - 1)
      expected = prev.toISOString().slice(0, 10)
    } else if (d < expected) break
  }
  return streak
}

export class StudentProfileNotFoundError extends Error {}

/**
 * Resolves the Core learnerId + schoolId for a legacy/institutional
 * `students.id` — the same students.external_id reverse bridge
 * lib/core/identity.ts's resolveOwnCoreLearnerId already performs, applied
 * to a studentId this composer has already resolved (legacy OR
 * institutional-compatibility) rather than re-deriving it from a fresh
 * "find owned students" scan. Returns null for a learner with no Core
 * bridge (a Solo/legacy-only learner never onboarded through Core) — that
 * is a legitimate, common state, not an error.
 */
async function resolveCoreIdentity(studentId: string): Promise<{ learnerId: string; schoolId: string } | null> {
  const learnerId = await resolveCoreLearnerIdForStudentId(studentId)
  if (!learnerId) return null
  try {
    const schoolId = await repos.learners.findSchoolId(learnerId)
    return { learnerId, schoolId }
  } catch {
    return null
  }
}

type ApprovedDeliveredAction = {
  candidate: NextActionCandidate
  completed: boolean
}

/**
 * Approved Blueprint actions that are ALSO already delivered (assignment or
 * Compass) — Phase 7 §6's answer to "only surface learner-meaningful
 * states." An approved-but-undelivered action is silently excluded, not
 * shown as a vague "your teacher is preparing something."
 */
async function loadApprovedDeliveredActions(
  learnerId: string,
  schoolId: string,
  assignmentsById: Map<string, LearnerAssignmentListItem>,
): Promise<ApprovedDeliveredAction[]> {
  const rows = await repos.blueprintActionItems.listApprovedForLearner(learnerId, schoolId)
  const results: ApprovedDeliveredAction[] = []

  for (const row of rows) {
    const item = toBlueprintActionItem(row)
    const safe = toLearnerView(item)
    if (!safe) continue // not visible to this learner (visibility scope), even though approved

    // Delivered as a real assignment? — correlate against the already-fetched
    // assignment list first (no extra query); only fall back to a direct
    // lookup for the legacy branch, which doesn't carry submission state.
    const deliveredAssignment = assignmentsById.get(item.id)
    if (deliveredAssignment) {
      const state = deriveAssignmentState(deliveredAssignment.submissionStatus, deliveredAssignment.isOverdue, deliveredAssignment.daysLeft)
      results.push({
        completed: state === 'completed',
        candidate: {
          kind: 'assignment',
          id: deliveredAssignment.id,
          title: safe.title,
          subject: formatSubjectName(deliveredAssignment.teacher_classes?.subject ?? deliveredAssignment.topic ?? ''),
          provenance: 'teacher_approved_action',
          state,
          href: '/dashboard/assignments',
          dueDate: deliveredAssignment.due_date,
          daysLeft: deliveredAssignment.daysLeft,
          isOverdue: deliveredAssignment.isOverdue,
          whyItMatters: safe.whyItMatters,
        },
      })
      continue
    }

    // Delivered to Compass?
    const compassDelivery = await repos.blueprintCompassDeliveries.findByBlueprintActionItemId(item.id).catch(() => null)
    if (compassDelivery) {
      const state = deriveCompassDeliveryState(compassDelivery.status)
      results.push({
        completed: state === 'completed',
        candidate: {
          kind: 'compass_action',
          id: compassDelivery.id,
          title: safe.title,
          subject: formatSubjectName(compassDelivery.subject),
          provenance: 'teacher_approved_action',
          state,
          href: '/learn',
          dueDate: null,
          daysLeft: null,
          isOverdue: false,
          whyItMatters: safe.whyItMatters,
        },
      })
    }
    // Neither delivered yet -> intentionally excluded (Phase 7 §6/§19).
  }

  return results
}

function buildLearningState(projection: LearnerIntelligenceProjection): SubjectLearningState[] {
  const academic = projection.academic?.value.bySubject ?? {}
  return Object.entries(academic)
    .map(([subject, perf]) => ({
      subject,
      displayName: formatSubjectName(subject),
      level: perf.latestLevel,
      levelLabel: LEVEL_LABELS[perf.latestLevel] ?? 'Emerging',
      trendLabel: trendLabel(perf.trend),
    }))
    .sort((a, b) => a.displayName.localeCompare(b.displayName))
}

function buildRecentProgress(projection: LearnerIntelligenceProjection): RecentProgressItem[] {
  const growth = projection.growth?.value.bySubject ?? {}
  const items: RecentProgressItem[] = []
  for (const [subject, ctx] of Object.entries(growth)) {
    if (ctx.trend === 'improving' && ctx.delta !== null && ctx.delta > 0) {
      items.push({
        subject,
        displayName: formatSubjectName(subject),
        message: `You're improving in ${formatSubjectName(subject)}`,
      })
    }
  }
  return items.slice(0, 2)
}

function buildBlueprintInsight(projection: LearnerIntelligenceProjection): string | null {
  const academic = projection.academic?.value.bySubject ?? {}
  const entries = Object.values(academic)
  if (entries.length === 0) return null
  const improving = entries.find(e => e.trend === 'improving')
  if (improving) return `${formatSubjectName(improving.subject)} is trending up`
  const strongest = [...entries].sort((a, b) => b.latestLevel - a.latestLevel)[0]
  return `You're doing well in ${formatSubjectName(strongest.subject)}`
}

export async function composeStudentHome(userId: string): Promise<LearnerHomeView> {
  const db = createServiceClient()

  const { data: legacyStudent } = await db
    .from('students')
    .select('id, name, grade, school, current_pathway, curriculum_type')
    .eq('user_id', userId)
    .maybeSingle()

  let student = legacyStudent
  let isInstitutional = false

  if (!student) {
    const compatStudentId = await resolveCurrentInstitutionalCompatibilityStudentId(userId)
    if (compatStudentId) {
      const { data: compatStudent } = await db
        .from('students')
        .select('id, name, grade, school, current_pathway, curriculum_type')
        .eq('id', compatStudentId)
        .maybeSingle()
      if (compatStudent) {
        student = compatStudent
        isInstitutional = true
      }
    }
  }

  if (!student) throw new StudentProfileNotFoundError('No student profile found')

  const studentId = student.id as string
  const thirtyDays = new Date()
  thirtyDays.setDate(thirtyDays.getDate() - 30)
  const weekStart = new Date()
  weekStart.setHours(0, 0, 0, 0)
  const dow = weekStart.getDay()
  weekStart.setDate(weekStart.getDate() - (dow === 0 ? 6 : dow - 1))

  const [
    { data: sessions },
    { data: classLinks },
    projectionResult,
  ] = await Promise.all([
    db.from('compass_sessions')
      .select('id, subject, xp_earned, starting_level, ending_level, one_line_summary, created_at')
      .eq('learner_id', studentId)
      .gt('exchange_count', 0)
      .gte('created_at', thirtyDays.toISOString())
      .order('created_at', { ascending: false })
      .limit(20),
    db.from('class_students').select('class_id').eq('student_id', studentId),
    recomputeLearnerProjection(studentId).catch(() => null),
  ])

  const projection = projectionResult

  const classIds = (classLinks ?? []).map(c => c.class_id as string)
  let learnerAssignments: LearnerAssignmentListItem[] = []

  if (isInstitutional) {
    learnerAssignments = await listAssignmentsForAuthenticatedLearner(userId)
  } else if (classIds.length > 0) {
    const now = new Date()
    const { data: asgn } = await db
      .from('assignments')
      .select('id, title, topic, due_date, status, blueprint_action_item_id, teacher_classes(subject)')
      .in('class_id', classIds)
      .eq('status', 'active')
      .order('due_date', { ascending: true })
      .limit(20)
    learnerAssignments = (asgn ?? []).map(a => {
      const due = new Date(a.due_date as string)
      const daysLeft = Math.ceil((due.getTime() - now.getTime()) / 86_400_000)
      return {
        id: a.id as string,
        class_id: '',
        title: a.title as string,
        topic: a.topic as string,
        instructions: '',
        type: '',
        is_compass_guided: null,
        is_quiz: false,
        max_score: null,
        due_date: a.due_date as string,
        status: a.status as string,
        created_at: '',
        blueprint_action_item_id: a.blueprint_action_item_id as string | null,
        teacher_classes: (Array.isArray(a.teacher_classes) ? a.teacher_classes[0] : a.teacher_classes) as { name: string | null; grade: number | null; subject: string | null } | null,
        teachers: null,
        submission: null,
        submissionStatus: 'pending',
        daysLeft,
        isOverdue: daysLeft < 0,
      }
    })
  }

  const assignmentsById = new Map<string, LearnerAssignmentListItem>()
  for (const a of learnerAssignments) {
    if (a.blueprint_action_item_id) assignmentsById.set(a.blueprint_action_item_id, a)
  }

  const plainAssignmentCandidates: NextActionCandidate[] = learnerAssignments
    .filter(a => !a.blueprint_action_item_id) // delivered-action assignments are represented via the approved-action path instead, not twice
    .map(a => ({
      kind: 'assignment',
      id: a.id,
      title: a.title,
      subject: formatSubjectName(a.teacher_classes?.subject ?? a.topic ?? ''),
      provenance: 'class_assignment',
      state: deriveAssignmentState(a.submissionStatus, a.isOverdue, a.daysLeft),
      href: '/dashboard/assignments',
      dueDate: a.due_date,
      daysLeft: a.daysLeft,
      isOverdue: a.isOverdue,
      whyItMatters: null,
    }))

  let approvedActions: ApprovedDeliveredAction[] = []
  const coreIdentity = await resolveCoreIdentity(studentId).catch(() => null)
  if (coreIdentity) {
    approvedActions = await loadApprovedDeliveredActions(coreIdentity.learnerId, coreIdentity.schoolId, assignmentsById).catch(() => [])
  }

  const liveApprovedCandidates = approvedActions.filter(a => !a.completed).map(a => a.candidate)
  const allCandidates = [...plainAssignmentCandidates, ...liveApprovedCandidates]

  const chosen = chooseNextAction(allCandidates)
  const nextAction = chosen ? toNextActionCard(chosen) : null

  const overdueForAttention = allCandidates.filter(c => c.isOverdue && c.id !== chosen?.id)

  const learningState = projection ? buildLearningState(projection) : []
  const riskedSubjects = (projection?.risk?.value.flags ?? [])
    .filter(f => f.subject && (f.severity === 'at_risk' || f.severity === 'critical'))
    .map(f => ({ subject: f.subject as string, displayName: formatSubjectName(f.subject as string) }))

  const attention = buildAttentionItems(overdueForAttention, riskedSubjects, chosen?.subject ?? null, '/dashboard/assignments')
  const recentProgress = projection ? buildRecentProgress(projection) : []
  const blueprintInsight = projection ? buildBlueprintInsight(projection) : null

  const sessionsArr = sessions ?? []
  const totalXp = sessionsArr.reduce((s, x) => s + ((x.xp_earned as number) ?? 0), 0)
  const weekSessions = sessionsArr.filter(s => new Date(s.created_at as string) >= weekStart).length
  const streak = computeStreak(sessionsArr.map(s => ({ created_at: s.created_at as string })))
  const frs = Math.round((projection?.capability?.value.overallScore ?? 0) * 100)

  const continueSessions: ContinueSession[] = sessionsArr.slice(0, 4).map(s => ({
    id: s.id as string,
    subject: s.subject as string,
    subjectLabel: formatSubjectName(s.subject as string),
    xpEarned: (s.xp_earned as number) ?? 0,
    levelGained: Boolean(s.starting_level && s.ending_level && (s.ending_level as number) > (s.starting_level as number)),
    summary: s.one_line_summary as string | null,
    relativeDate: relativeDate(s.created_at as string),
  }))

  const continueAssignments: ContinueAssignmentItem[] = learnerAssignments
    .filter(a => a.id !== chosen?.id)
    .slice()
    .sort((a, b) => new Date(a.due_date).getTime() - new Date(b.due_date).getTime())
    .slice(0, 5)
    .map(a => ({
      id: a.id,
      title: a.title,
      subject: formatSubjectName(a.teacher_classes?.subject ?? a.topic ?? ''),
      dueDate: a.due_date,
      daysLeft: a.daysLeft,
      isOverdue: a.isOverdue,
    }))

  return {
    student: {
      id: studentId,
      name: student.name as string,
      firstName: (student.name as string).split(' ')[0],
      grade: student.grade as number,
      school: student.school as string | null,
      pathway: student.current_pathway as string | null,
      curriculum: student.curriculum_type as string,
    },
    stats: {
      totalXp,
      totalSessions: sessionsArr.length,
      sessionsThisWeek: weekSessions,
      streak,
      futureReadiness: frs,
      frsLabel: frsLabel(frs),
    },
    nextAction,
    attention,
    learningState,
    recentProgress,
    continueAssignments,
    continueSessions,
    blueprintTeaser: { insight: blueprintInsight },
    blueprintHref: '/student/blueprint',
    hasAssessment: learningState.length > 0,
    hasTeacher: classIds.length > 0 || isInstitutional,
    hasPendingApprovedAction: liveApprovedCandidates.length > 0,
  }
}
