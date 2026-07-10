// lib/parentPulse/builder.ts
// Builds the weekly parent pulse — one WhatsApp message per student per week.
// Not a report. Not a PDF. One message. One action. Sent automatically.
// This is the thing that makes parents feel the platform is watching their child.

import { repos } from '@/lib/repositories'
import { getOrCreateLearnerProfile } from '@/lib/learnerModel/queries'
import { recomputeLearnerProjection } from '@/lib/projection/recompute'

type ParentPulse = {
  student_id:      string
  student_name:    string
  parent_phone:    string | null
  parent_name:     string | null
  message:         string
  summary_line:    string   // for the app dashboard
  week_of:         string
}

type PulseContext = {
  studentId:   string
  studentName: string
  grade:       number
  parentName:  string | null
  weekOf:      string
}

export async function buildParentPulse(ctx: PulseContext): Promise<string> {
  // `profile` is retained only for career_signals and engagement_patterns —
  // neither has a Projection equivalent yet (no careerProjector exists, and
  // behaviourProjector has no wired evidence source). Knowledge and risk
  // come from the Projection Engine — the same risk engine Blueprint, Career
  // Intelligence, and Adaptive Recommendation already use. See
  // docs/architecture/migration-ledger.md.
  const [profile, projection] = await Promise.all([
    getOrCreateLearnerProfile(ctx.studentId),
    recomputeLearnerProjection(ctx.studentId),
  ])
  const knowledgeBySubject = projection.knowledge?.value.bySubject ?? {}
  const riskLevel      = projection.risk?.value.overallRiskLevel ?? 'normal'
  const flags          = projection.risk?.value.flags ?? []
  const engagement     = profile.engagement_patterns as Record<string, unknown> ?? {}
  const careerSignals  = profile.career_signals as Record<string, unknown> ?? {}

  void engagement // used for future enrichment

  // Get recent compass sessions
  const recentCompass = await repos.compass.findRecentSessionsByStudent(ctx.studentId, 3)

  // Get formative signals for this student this week
  const weekStart = new Date()
  weekStart.setDate(weekStart.getDate() - 7)
  const weekSince = weekStart.toISOString()

  const [formativeThisWeek, formativeConcerning] = await Promise.all([
    repos.learnerModel.findFormativeSignalsForStudent(ctx.studentId, weekSince, 5),
    repos.learnerModel.findConcernFormativeSignals(ctx.studentId, weekSince, 3),
  ])

  // Build message sections
  const firstName = ctx.studentName.split(' ')[0]
  const sections: string[] = []

  // 1. Header
  sections.push(`EduNexus — ${firstName}'s Week (${ctx.weekOf}) 📚`)

  // 2. Good news first (what went well)
  const strongSubjects = Object.entries(knowledgeBySubject)
    .filter(([, m]) => m.currentLevel >= 3)
    .map(([subject]) => subject)
    .slice(0, 2)

  const compassTopics = recentCompass.map(s => s.subject).filter(Boolean) as string[]
  const gotItSubjects = formativeThisWeek.map(s => s.subject).filter(Boolean) as string[]

  const goodNews = [...new Set([...strongSubjects, ...compassTopics, ...gotItSubjects])].slice(0, 2)

  if (goodNews.length > 0) {
    sections.push(`Strong this week: ${goodNews.join(', ')}`)
  } else {
    sections.push(`${firstName} is continuing their learning journey.`)
  }

  // 3. One concern (if any)
  const concernSubject = formativeConcerning[0]?.subject ?? undefined
  const topFlag        = flags[0]
  const topWeakSubject = Object.entries(knowledgeBySubject)
    .filter(([, m]) => m.currentLevel === 1)
    .map(([subject]) => subject)[0]

  const concern = concernSubject ?? topWeakSubject ?? (topFlag?.subject ?? undefined)
  if (concern) {
    sections.push(`Needs attention: ${concern}`)
  }

  // 4. Career note (if career signals exist)
  const topCareer = (careerSignals.top_career_slugs as string[] | undefined)?.[0]
  if (topCareer) {
    const career = await repos.careers.findCareerBySlug(topCareer)
    if (career?.title) {
      sections.push(`Career path: ${firstName} is exploring ${career.title}`)
    }
  }

  // 5. One action for the parent
  const action = buildParentAction(firstName, concern, riskLevel)
  sections.push(`\nThis week: ${action}`)

  // 6. Footer
  sections.push(`\nReply STOP to unsubscribe. EduNexus 🇰🇪`)

  return sections.join('\n')
}

function buildParentAction(
  firstName: string,
  concern:   string | undefined,
  risk:      string,
): string {
  if (risk === 'critical') {
    return `Please speak with ${firstName}'s teacher this week — we have flagged some areas that need attention.`
  }
  if (concern) {
    return `Ask ${firstName} to explain "${concern}" to you in 2 minutes. If they can't, that is the area to focus on.`
  }
  return `Ask ${firstName}: "What is one thing you learned this week that surprised you?" Listen for 2 minutes.`
}

// ── Batch pulse for all students with WhatsApp-opted-in parents ───────────────

export async function buildAllParentPulses(weekOf: string): Promise<ParentPulse[]> {
  const optedIn = await repos.notifications.getAllActiveOptIns(500)

  if (!optedIn.length) return []

  const pulses: ParentPulse[] = []

  for (const row of optedIn) {
    const student = row.students
    if (!student) continue

    const studentId   = row.student_id
    const studentName = ((student.name as string) ?? '').trim()
    const firstName   = studentName.split(' ')[0] ?? ''
    const grade       = (student.grade as number) ?? 8
    const parentPhone = (student.parent_phone as string) ?? null

    // Get parent name from profiles
    const parentUserId = student.parent_user_id as string | null
    let parentName: string | null = null
    if (parentUserId) {
      parentName = await repos.teachers.findProfileFullName(parentUserId)
    }

    try {
      const message = await buildParentPulse({
        studentId, studentName, grade, parentName, weekOf,
      })

      const strongLine = `${firstName} is learning — here is your weekly update.`

      pulses.push({
        student_id:   studentId,
        student_name: studentName,
        parent_phone: parentPhone,
        parent_name:  parentName,
        message,
        summary_line: strongLine,
        week_of:      weekOf,
      })
    } catch {
      // Skip failed students — don't block the batch
    }
  }

  return pulses
}
