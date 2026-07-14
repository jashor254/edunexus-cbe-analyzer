// Runs daily at 08:00 EAT (05:00 UTC), scheduled via
// .github/workflows/notification-crons.yml
// Finds teachers who completed a lesson 7+ days ago with no reflection → sends one WhatsApp nudge per lesson (lifetime dedup).
import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/utils/supabase/service'
import { sendAcademyReflectionNudge } from '@/lib/whatsapp/sender'
import { timingSafeEqualString } from '@/lib/api/secretCompare'

async function runAcademyNudge(): Promise<{ sent: number; skipped: number; total: number; message?: string }> {
  const db = createServiceClient()

  // 1. Lesson completions older than 7 days
  const cutoff = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString()

  const { data: oldProgress } = await db
    .from('academy_progress')
    .select('teacher_id, lesson_id, completed_at')
    .lt('completed_at', cutoff)

  if (!oldProgress?.length) {
    return { sent: 0, skipped: 0, total: 0, message: 'No old progress records' }
  }

  // 2. Which of those have reflections?
  const lessonIds    = [...new Set(oldProgress.map(p => p.lesson_id))]
  const teacherIds   = [...new Set(oldProgress.map(p => p.teacher_id))]

  const { data: reflections } = await db
    .from('academy_reflections')
    .select('teacher_id, lesson_id')
    .in('teacher_id', teacherIds)
    .in('lesson_id', lessonIds)

  const reflectedSet = new Set(
    (reflections ?? []).map(r => `${r.teacher_id}:${r.lesson_id}`)
  )

  // 3. Lessons needing a nudge (no reflection yet)
  const needsNudge = oldProgress.filter(
    p => !reflectedSet.has(`${p.teacher_id}:${p.lesson_id}`)
  )

  if (!needsNudge.length) {
    return { sent: 0, skipped: 0, total: 0, message: 'All old lessons have reflections — great work!' }
  }

  // 4. Check which nudges were already sent (lifetime dedup via notification_log)
  const referenceIds = needsNudge.map(p => `academy_reflect_${p.teacher_id}_${p.lesson_id}`)

  const { data: alreadySent } = await db
    .from('notification_log')
    .select('reference_id')
    .in('reference_id', referenceIds)
    .eq('channel', 'whatsapp')
    .eq('success', true)

  const sentSet = new Set((alreadySent ?? []).map(r => r.reference_id))

  const toSend = needsNudge.filter(
    p => !sentSet.has(`academy_reflect_${p.teacher_id}_${p.lesson_id}`)
  )

  if (!toSend.length) {
    return { sent: 0, skipped: 0, total: 0, message: 'All pending nudges already sent' }
  }

  // 5. Fetch teacher profiles + lesson → module data in parallel (batch)
  const toSendTeacherIds = [...new Set(toSend.map(p => p.teacher_id))]
  const toSendLessonIds  = [...new Set(toSend.map(p => p.lesson_id))]

  const [teacherRes, lessonRes] = await Promise.all([
    db.from('teachers')
      .select('id, full_name, phone, user_id')
      .in('id', toSendTeacherIds),
    db.from('academy_lessons')
      .select('id, module_id, academy_modules!module_id(id, title, slug)')
      .in('id', toSendLessonIds),
  ])

  const teacherMap = new Map((teacherRes.data ?? []).map(t => [t.id, t]))
  const lessonMap  = new Map((lessonRes.data ?? []).map(l => [l.id, l]))

  // One nudge per teacher per run — pick their oldest un-reflected lesson
  const perTeacher = new Map<string, typeof toSend[0]>()
  for (const p of toSend.sort((a, b) => a.completed_at < b.completed_at ? -1 : 1)) {
    if (!perTeacher.has(p.teacher_id)) perTeacher.set(p.teacher_id, p)
  }

  let sent    = 0
  let skipped = 0

  for (const [teacherId, p] of perTeacher) {
    const teacher = teacherMap.get(teacherId)
    const lesson  = lessonMap.get(p.lesson_id)

    if (!teacher?.phone || !lesson) { skipped++; continue }

    // Type-safe access to the related module (Supabase returns an object, not array, for FK join)
    const mod = lesson.academy_modules as unknown as { id: string; title: string; slug: string } | null
    if (!mod?.slug) { skipped++; continue }

    const result = await sendAcademyReflectionNudge({
      teacherId:   teacher.id,
      lessonId:    p.lesson_id,
      phone:       teacher.phone,
      teacherName: teacher.full_name ?? 'Mwalimu',
      moduleTitle: mod.title,
      moduleSlug:  mod.slug,
      userId:      teacher.user_id,
    })

    if (result.success) sent++
    else skipped++
  }

  return { sent, skipped, total: perTeacher.size }
}

export async function POST(request: NextRequest) {
  const authHeader  = request.headers.get('authorization')
  const cronSecret  = process.env.CRON_SECRET
  const isVercelCron = request.headers.get('x-vercel-cron') === '1'

  if (!isVercelCron && (!cronSecret || !timingSafeEqualString(authHeader, `Bearer ${cronSecret}`))) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const result = await runAcademyNudge()
    console.info(`[cron/academy-nudge] ${result.sent} sent, ${result.skipped} skipped${result.message ? ` — ${result.message}` : ''}`)
    return NextResponse.json(result)
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err)
    console.error('[cron/academy-nudge] failed', message)
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
