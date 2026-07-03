// lib/holiday/planner.ts
// Generates a personalised holiday learning plan per student.
// Based on: learner model gaps + career signals + holiday duration.
// Light, focused, parent-friendly — not a worksheet mountain.

import { repos } from '@/lib/repositories'
import { callDeepSeek } from '@/lib/ai/deepseek'
import { getOrCreateLearnerProfile } from '@/lib/learnerModel/queries'
import type { HolidayPlanData, HolidayWeek } from './types'

type PlanInput = {
  studentId:     string
  teacherId:     string
  term:          number
  year:          number
  holidayPeriod: string   // "August Holiday 2026"
  holidayDays:   number   // typically 14–28
  schoolId?:     string
}

export async function generateHolidayPlan(input: PlanInput): Promise<HolidayPlanData> {
  // 1. Load student profile
  const [student, profile] = await Promise.all([
    repos.learnerIntelligence.getStudentHolidayData(input.studentId),
    getOrCreateLearnerProfile(input.studentId),
  ])

  const studentName = student
    ? `${student.first_name ?? ''} ${student.last_name ?? ''}`.trim()
    : 'Student'
  const grade = (student?.grade as number) ?? 8

  // 2. Identify priority gaps from knowledge state
  const priorityGaps: string[] = []
  const knowledgeState = profile.knowledge_state ?? {}

  // Level 1 (BE) substrands are highest priority
  const beSubstrands = Object.entries(knowledgeState)
    .filter(([, m]) => m.level === 1)
    .sort((a, b) => a[1].assessment_count - b[1].assessment_count)  // least assessed first
    .map(([key]) => key.split(':')[1] ?? key)
    .slice(0, 2)

  // Level 2 (AE) substrands are secondary
  const aeSubstrands = Object.entries(knowledgeState)
    .filter(([, m]) => m.level === 2)
    .map(([key]) => key.split(':')[1] ?? key)
    .slice(0, 1)

  priorityGaps.push(...beSubstrands, ...aeSubstrands)

  // 3. Get career signals
  const careerSlugs = (profile.career_signals as Record<string, unknown>)?.top_career_slugs as string[] | undefined
  const weakestSubjects = (profile.career_signals as Record<string, unknown>)?.weakest_subjects as string[] | undefined

  // Also check student's career interests directly
  let careerNote: string | null = null
  if (careerSlugs?.length) {
    const career = await repos.learnerIntelligence.getCareerBySlug(careerSlugs[0])

    if (career) {
      const requiredSubjects = (career as unknown as { required_subjects?: string[] }).required_subjects ?? null
      const weakRequiredSubject = requiredSubjects?.find(s =>
        weakestSubjects?.some(w => w.toLowerCase().includes(s.toLowerCase()))
      )
      if (weakRequiredSubject) {
        careerNote = `${career.title} requires strong ${weakRequiredSubject}. This holiday is a good time to strengthen it.`
      } else {
        careerNote = `Career path: ${career.title}. Keep building the subjects that matter for this path.`
      }
    }
  }

  // 4. Build week structure
  const holidayWeeks = Math.ceil(input.holidayDays / 7)
  const weeks: HolidayWeek[] = []

  if (holidayWeeks === 0) {
    weeks.push({
      week: 1, label: 'Short Break', compass_topics: priorityGaps.slice(0, 1),
      parent_action: 'Have a brief conversation about what was learned this term.',
      student_task: priorityGaps[0] ? `Review ${priorityGaps[0]} briefly.` : 'Rest and reflect on the term.',
      is_rest_week: true,
    })
  } else {
    for (let w = 1; w <= holidayWeeks; w++) {
      const isLastWeek = w === holidayWeeks
      const isRestWeek = isLastWeek && holidayWeeks >= 3

      if (isRestWeek) {
        weeks.push({
          week: w, label: `Week ${w} — Rest & Explore`,
          compass_topics: careerSlugs?.length ? [careerSlugs[0]] : [],
          parent_action: 'Let your child rest. Congratulate them on the term.',
          student_task: `Optional: explore one career that interests you in the Career Explorer.`,
          is_rest_week: true,
        })
      } else if (w === 1) {
        const topic = priorityGaps[0] ?? (weakestSubjects?.[0] ?? 'revision')
        weeks.push({
          week: w, label: `Week ${w} — Consolidate`,
          compass_topics: topic ? [topic] : [],
          parent_action: `Ask ${studentName.split(' ')[0]} to explain ${topic} in their own words — even 5 minutes counts.`,
          student_task: topic
            ? `Complete 2 Compass sessions on "${topic}". Take your time — no rush.`
            : 'Review your notes from this term. Identify one concept you want to understand better.',
          is_rest_week: false,
        })
      } else if (w === 2) {
        const topic = priorityGaps[1] ?? weakestSubjects?.[1] ?? priorityGaps[0]
        weeks.push({
          week: w, label: `Week ${w} — Strengthen`,
          compass_topics: topic ? [topic] : [],
          parent_action: topic
            ? `This week, ask "${studentName.split(' ')[0]}, what is ${topic}?" Listen to the answer — it tells you a lot.`
            : 'Check in on how your child is feeling about the upcoming term.',
          student_task: topic
            ? `Complete 2 Compass sessions on "${topic}". Connect it to something real around you.`
            : 'Prepare one question to ask your teacher on the first day of Term 3.',
          is_rest_week: false,
        })
      } else {
        weeks.push({
          week: w, label: `Week ${w} — Explore`,
          compass_topics: [],
          parent_action: 'Encourage your child to read something they enjoy — any topic.',
          student_task: 'Explore the Career section — read about one career path that interests you.',
          is_rest_week: false,
        })
      }
    }
  }

  // 5. Build parent WhatsApp message
  const firstName = studentName.split(' ')[0]
  const topGap = priorityGaps[0]
  const compassCount = weeks.reduce((s, w) => s + w.compass_topics.length, 0)

  const whatsappMessage = buildWhatsAppMessage({
    firstName, grade, topGap, careerNote,
    weeks, compassCount, holidayPeriod: input.holidayPeriod,
  })

  const parentSummary = topGap
    ? `${firstName} had a strong term but has room to grow in ${topGap}. ${careerNote ? careerNote + ' ' : ''}The holiday plan is light and focused — ${compassCount} short Compass session${compassCount !== 1 ? 's' : ''} spread across the break.`
    : `${firstName} had a solid term. The holiday plan keeps momentum light — rest, explore, and stay curious.`

  const planData: HolidayPlanData = {
    student_name:    studentName,
    grade,
    holiday_period:  input.holidayPeriod,
    priority_gaps:   priorityGaps,
    career_note:     careerNote,
    weeks,
    whatsapp_message: whatsappMessage,
    parent_summary:  parentSummary,
  }

  // 6. Enrich with AI for a more personalised narrative
  const enriched = await enrichPlanWithAI(planData, student?.dream_career as string | null)
  if (enriched) {
    planData.whatsapp_message = enriched.whatsappMessage ?? planData.whatsapp_message
    planData.parent_summary   = enriched.parentSummary   ?? planData.parent_summary
  }

  // 7. Persist
  await repos.learnerIntelligence.upsertHolidayPlan({
    student_id:     input.studentId,
    teacher_id:     input.teacherId,
    school_id:      input.schoolId ?? null,
    term:           input.term,
    year:           input.year,
    holiday_period: input.holidayPeriod,
    holiday_days:   input.holidayDays,
    plan_data:      planData,
  })

  return planData
}

// ── Batch generate for a whole class ─────────────────────────────────────────

type BatchInput = Omit<PlanInput, 'studentId'>
type BatchResult = { studentId: string; studentName: string; plan: HolidayPlanData | null; error?: string }

export async function generateClassHolidayPlans(
  classId:  string,
  input:    BatchInput,
): Promise<BatchResult[]> {
  const enrollment = await repos.learnerIntelligence.getClassEnrollment(classId)
  if (!enrollment.length) return []

  const results = await Promise.allSettled(
    enrollment.map(async (studentId) => {
      const plan = await generateHolidayPlan({ studentId, ...input })
      const s = await repos.learnerIntelligence.getStudentNameById(studentId)
      return {
        studentId,
        studentName: s ? `${s.first_name ?? ''} ${s.last_name ?? ''}`.trim() : studentId,
        plan,
      }
    })
  )

  return results.map((r, i) => {
    const id = enrollment[i]
    if (r.status === 'fulfilled') return r.value as BatchResult
    return { studentId: id, studentName: id, plan: null, error: String((r as PromiseRejectedResult).reason) }
  })
}

// ── WhatsApp message builder ──────────────────────────────────────────────────

function buildWhatsAppMessage(p: {
  firstName:     string
  grade:         number
  topGap:        string | undefined
  careerNote:    string | null
  weeks:         HolidayWeek[]
  compassCount:  number
  holidayPeriod: string
}): string {
  const workWeeks = p.weeks.filter(w => !w.is_rest_week)
  const restWeeks = p.weeks.filter(w => w.is_rest_week)

  const weekLines = workWeeks.map(w =>
    `📅 ${w.label}\n${w.student_task}`
  ).join('\n\n')

  return `EduNexus — ${p.firstName}'s ${p.holidayPeriod} Plan 🎓

Good news: ${p.firstName} completed Term ${p.weeks.length > 0 ? '2' : '1'} and is ready for a break.
${p.topGap ? `\nOne focus this holiday: *${p.topGap}*` : ''}
${p.careerNote ? `\n🔭 ${p.careerNote}` : ''}

${weekLines}
${restWeeks.length ? `\n😌 ${restWeeks[0].label}: Rest. They earned it.` : ''}

${p.compassCount > 0 ? `✅ ${p.compassCount} short Compass session${p.compassCount !== 1 ? 's' : ''} — available on their phone anytime.\n` : ''}
See you in Term 3! 🇰🇪
— EduNexus`.trim()
}

// ── AI enrichment ─────────────────────────────────────────────────────────────

async function enrichPlanWithAI(
  plan:        HolidayPlanData,
  dreamCareer: string | null,
): Promise<{ whatsappMessage?: string; parentSummary?: string } | null> {
  try {
    const prompt = `You are writing a WhatsApp holiday plan for a Kenyan parent.

Student: ${plan.student_name}, Grade ${plan.grade}
Holiday: ${plan.holiday_period} (${plan.weeks.length} weeks)
Priority gaps: ${plan.priority_gaps.join(', ') || 'none — student is on track'}
${dreamCareer ? `Dream career: ${dreamCareer}` : ''}
${plan.career_note ? `Career context: ${plan.career_note}` : ''}

Write:
1. A WhatsApp message to the parent (max 220 words). Warm, specific, Kenyan context.
   Include: one good news sentence about the term, one focus for the holiday,
   a 2-3 week plan with simple parent actions, end with encouragement.
   Use emojis sparingly. Do NOT use markdown bold (*text*) or headers.

2. A 2-sentence parent summary for the app dashboard.

Format your response as:
WHATSAPP:
[message here]
SUMMARY:
[2 sentences here]`

    const text = await callDeepSeek(prompt, undefined, {
      maxTokens:   500,
      temperature: 0.7,
    })
    const waMatch = text.match(/WHATSAPP:\n([\s\S]+?)(?=SUMMARY:|$)/)
    const sumMatch = text.match(/SUMMARY:\n([\s\S]+?)$/)

    return {
      whatsappMessage: waMatch?.[1]?.trim(),
      parentSummary:   sumMatch?.[1]?.trim(),
    }
  } catch {
    return null
  }
}
