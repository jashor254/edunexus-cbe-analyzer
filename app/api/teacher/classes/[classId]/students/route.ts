// app/api/teacher/classes/[classId]/students/route.ts
// Teacher adds one or more students to a class with parent contact details.
// Creates student records, class_students links, invite tokens, fires notifications.

import { z } from 'zod'
import { createClient } from '@/utils/supabase/server'
import { createServiceClient } from '@/utils/supabase/service'
import {
  apiSuccess, apiError, apiUnauthorized, apiForbidden, apiNotFound, apiBadRequest,
} from '@/lib/api/response'
import { sendWelcomeMessage } from '@/lib/whatsapp/sender'

const APP_URL = process.env.NEXT_PUBLIC_APP_URL ?? 'https://edunexus.co.ke'

const StudentSchema = z.object({
  name:          z.string().min(1).max(100),
  grade:         z.number().int().min(7).max(12),
  curriculum_type: z.enum(['cbc', 'igcse', 'ib', '844', 'other']).default('cbc'),
  parent_name:   z.string().min(1).max(100).optional(),
  parent_phone:  z.string().max(20).optional(),
  parent_email:  z.string().email().optional(),
})

const BodySchema = z.object({
  students: z.array(StudentSchema).min(1).max(100),
})

export async function POST(
  req: Request,
  { params }: { params: Promise<{ classId: string }> }
) {
  try {
    const { classId } = await params
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return apiUnauthorized()

    const db = createServiceClient()

    const { data: teacher } = await db
      .from('teachers')
      .select('id, full_name, school')
      .eq('user_id', user.id)
      .single()
    if (!teacher) return apiForbidden()

    const { data: cls } = await db
      .from('teacher_classes')
      .select('id, name, grade, subject')
      .eq('id', classId)
      .eq('teacher_id', teacher.id)
      .single()
    if (!cls) return apiNotFound('Class not found')

    const parsed = BodySchema.safeParse(await req.json())
    if (!parsed.success) {
      return apiBadRequest(parsed.error.issues.map(i => i.message).join(', '))
    }

    const results: Array<{ name: string; status: 'created' | 'error'; studentId?: string; error?: string }> = []

    for (const s of parsed.data.students) {
      try {
        // Create student record owned by teacher's user account
        const { data: student, error: insertErr } = await db
          .from('students')
          .insert({
            user_id:         user.id,
            name:            s.name.trim(),
            grade:           s.grade,
            curriculum_type: s.curriculum_type,
            school:          teacher.school ?? null,
            added_by:        'teacher',
            teacher_id:      teacher.id,
            parent_first_name: s.parent_name?.trim() ?? null,
            parent_phone:    s.parent_phone?.trim() ?? null,
            parent_email:    s.parent_email?.trim().toLowerCase() ?? null,
            notification_email:    !!s.parent_email,
            notification_whatsapp: !!s.parent_phone,
          })
          .select('id, name')
          .single()

        if (insertErr || !student) {
          results.push({ name: s.name, status: 'error', error: insertErr?.message ?? 'Insert failed' })
          continue
        }

        // Link to class
        await db.from('class_students').insert({
          class_id:   classId,
          student_id: student.id,
          teacher_id: teacher.id,
        })

        // Generate invite token
        let signupToken: string | null = null
        if (s.parent_email || s.parent_phone) {
          const { data: invite } = await db
            .from('student_invites')
            .insert({
              student_id:   student.id,
              parent_email: s.parent_email?.trim().toLowerCase() ?? null,
            })
            .select('token')
            .single()
          signupToken = invite?.token ?? null
        }

        // Fire WhatsApp welcome (non-blocking)
        if (s.parent_phone && signupToken) {
          const inviteLink = `${APP_URL}/parent-join?student=${student.id}&token=${signupToken}`
          const parentName = s.parent_name?.split(' ')[0] ?? 'Parent'
          const welcomeMsg =
            `Habari ${parentName}! 👋\n\n` +
            `Mwalimu ${teacher.full_name ?? ''} ameweka ${student.name} kwenye EduNexus — ` +
            `platform ya AI inayosaidia watoto kujifunza vizuri zaidi.\n\n` +
            `Bonyeza hapa kuunda akaunti yako ya mzazi:\n${inviteLink}\n\n` +
            `Mtoto wako atakuwa na AI tutor binafsi na ripoti za kina. Bure kabisa! 🇰🇪`

          // Use freeform sender (within 24h opt-in window or skip silently)
          sendWelcomeMessage(s.parent_phone, student.name, student.id).catch(() => {
            // WhatsApp failures are non-fatal
          })
        }

        results.push({ name: s.name, status: 'created', studentId: student.id })
      } catch (err) {
        results.push({
          name:   s.name,
          status: 'error',
          error:  err instanceof Error ? err.message : 'Unknown error',
        })
      }
    }

    const created = results.filter(r => r.status === 'created').length
    const failed  = results.filter(r => r.status === 'error').length

    return apiSuccess({ created, failed, results }, 201)
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e)
    console.error('[teacher/classes/students POST]', msg)
    return apiError('Internal server error')
  }
}

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ classId: string }> }
) {
  try {
    const { classId } = await params
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return apiUnauthorized()

    const db = createServiceClient()

    const { data: teacher } = await db
      .from('teachers')
      .select('id')
      .eq('user_id', user.id)
      .single()
    if (!teacher) return apiForbidden()

    const { data: cls } = await db
      .from('teacher_classes')
      .select('id')
      .eq('id', classId)
      .eq('teacher_id', teacher.id)
      .single()
    if (!cls) return apiNotFound('Class not found')

    const { data: links } = await db
      .from('class_students')
      .select('student_id')
      .eq('class_id', classId)

    const studentIds = (links ?? []).map((l: { student_id: string }) => l.student_id)
    if (studentIds.length === 0) return apiSuccess({ students: [] })

    const { data: students } = await db
      .from('students')
      .select('id, name, grade, curriculum_type, parent_email, parent_phone, parent_first_name, parent_user_id, added_by')
      .in('id', studentIds)

    return apiSuccess({ students: students ?? [] })
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e)
    console.error('[teacher/classes/students GET]', msg)
    return apiError('Internal server error')
  }
}
