// lib/parentPulse/builder.ts
// Builds the weekly parent pulse — one WhatsApp message per student per week.
// Not a report. Not a PDF. One message. One action. Sent automatically.
// This is the thing that makes parents feel the platform is watching their child.

import { createServiceClient } from '@/utils/supabase/service'
import { getOrCreateLearnerProfile } from '@/lib/learnerModel/queries'

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
  const db = createServiceClient()

  // Get learner profile
  const profile = await getOrCreateLearnerProfile(ctx.studentId)
  const knowledgeState = profile.knowledge_state ?? {}
  const riskLevel      = profile.overall_risk_level
  const flags          = profile.risk_flags ?? []
  const engagement     = profile.engagement_patterns as Record<string, unknown> ?? {}
  const careerSignals  = profile.career_signals as Record<string, unknown> ?? {}

  // Get recent compass sessions
  const { data: recentCompass } = await db
    .from('compass_sessions')
    .select('topic, subject, status')
    .eq('student_id', ctx.studentId)
    .eq('status', 'completed')
    .order('created_at', { ascending: false })
    .limit(3)

  // Get formative signals for this student this week
  const weekStart = new Date()
  weekStart.setDate(weekStart.getDate() - 7)
  const { data: formativeThisWeek } = await db
    .from('formative_signals')
    .select('subject, sub_strand, got_it_ids, confused_ids, lost_ids')
    .contains('got_it_ids', [ctx.studentId])
    .gte('recorded_at', weekStart.toISOString())
    .limit(5)

  const { data: formativeConcerning } = await db
    .from('formative_signals')
    .select('subject, sub_strand')
    .contains('lost_ids', [ctx.studentId])
    .gte('recorded_at', weekStart.toISOString())
    .limit(3)

  // Build message sections
  const firstName = ctx.studentName.split(' ')[0]
  const sections: string[] = []

  // 1. Header
  sections.push(`EduNexus — ${firstName}'s Week (${ctx.weekOf}) 📚`)

  // 2. Good news first (what went well)
  const strongSubstrands = Object.entries(knowledgeState)
    .filter(([, m]) => m.level >= 3)
    .map(([key]) => key.split(':')[1] ?? key)
    .slice(0, 2)

  const compassTopics = (recentCompass ?? []).map(s => s.topic as string).slice(0, 2)
  const gotItSubjects = (formativeThisWeek ?? []).map(s => s.subject as string).filter(Boolean)

  const goodNews = [...new Set([...strongSubstrands, ...compassTopics, ...gotItSubjects])].slice(0, 2)

  if (goodNews.length > 0) {
    sections.push(`Strong this week: ${goodNews.join(', ')}`)
  } else {
    sections.push(`${firstName} is continuing their learning journey.`)
  }

  // 3. One concern (if any)
  const concernSubject = (formativeConcerning ?? [])[0]?.subject as string | undefined
  const topFlag        = flags[0]
  const topWeakSubstrand = Object.entries(knowledgeState)
    .filter(([, m]) => m.level === 1)
    .map(([key]) => key.split(':')[1] ?? key)[0]

  const concern = concernSubject ?? topWeakSubstrand ?? (topFlag?.substrand)
  if (concern) {
    sections.push(`Needs attention: ${concern}`)
  }

  // 4. Career note (if career signals exist)
  const topCareer = (careerSignals.top_career_slugs as string[] | undefined)?.[0]
  if (topCareer) {
    const { data: career } = await db
      .from('careers')
      .select('title')
      .eq('slug', topCareer)
      .maybeSingle()
    if (career?.title) {
      sections.push(`Career path: ${firstName} is exploring ${career.title as string}`)
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
  const db = createServiceClient()

  // Get all students whose parents have opted into WhatsApp
  const { data: optedIn } = await db
    .from('whatsapp_opt_ins')
    .select('student_id, students(first_name, last_name, grade, parent_phone, parent_user_id)')
    .eq('opted_in_at', 'not.null')
    .limit(500)

  if (!optedIn?.length) return []

  const pulses: ParentPulse[] = []

  for (const row of optedIn) {
    const student = (row.students as unknown as Record<string, unknown> | null)
    if (!student) continue

    const studentId   = row.student_id as string
    const firstName   = (student.first_name as string) ?? ''
    const lastName    = (student.last_name as string) ?? ''
    const studentName = `${firstName} ${lastName}`.trim()
    const grade       = (student.grade as number) ?? 8
    const parentPhone = (student.parent_phone as string) ?? null

    // Get parent name from profiles
    const parentUserId = student.parent_user_id as string | null
    let parentName: string | null = null
    if (parentUserId) {
      const { data: profile } = await db
        .from('profiles')
        .select('full_name')
        .eq('id', parentUserId)
        .maybeSingle()
      parentName = (profile?.full_name as string) ?? null
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
