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
import { requireAuthentication, requireClassTeacher } from '@/lib/core/permissions'
import { resolveTeacher } from '@/lib/core/identity'
import { resolveExistingOwningSchool } from '@/lib/core/institutionOwnership'
import { UnauthorizedError } from '@/lib/core/errors'
import { SENIOR_PATHWAYS } from '@/lib/curriculum/subjects'

const APP_URL = process.env.NEXT_PUBLIC_APP_URL ?? 'https://edunexus.co.ke'

const StudentSchema = z.object({
  name:              z.string().min(1).max(100),
  grade:             z.number().int().min(7).max(12),
  curriculum_type:   z.enum(['cbc', 'igcse', 'ib', '844', 'other']).default('cbc'),
  parent_name:       z.string().min(1).max(100).optional(),
  parent_phone:      z.string().max(20).optional(),
  parent_email:      z.string().email().optional(),
  current_pathway:   z.enum(SENIOR_PATHWAYS).optional(),
  selected_subjects: z.array(z.string()).optional(),
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
    let userId: string
    try {
      userId = (await requireAuthentication(supabase)).id
    } catch (err) {
      if (err instanceof UnauthorizedError) return apiUnauthorized()
      throw err
    }

    const db = createServiceClient()

    const { data: teacher } = await db
      .from('teachers')
      .select('id, full_name, school')
      .eq('user_id', userId)
      .single()
    if (!teacher) return apiForbidden()

    try {
      await requireClassTeacher(supabase, classId)
    } catch {
      return apiNotFound('Class not found')
    }

    // Institution Ownership Enforcement (Phase 0) — every teacher-enrolled
    // learner must carry the same school_id as the class they're enrolled
    // into. Case A: the class already has a school_id (created after this
    // enforcement shipped) — reuse it. Case B: a historical class predating
    // this migration (school_id still NULL) — resolve the teacher's owning
    // school and repair the class's ownership in the same request, so the
    // gap can't be re-created by the very act of adding a learner to it.
    const { data: classRow } = await db
      .from('teacher_classes')
      .select('id, school_id')
      .eq('id', classId)
      .single()

    let classSchoolId = classRow?.school_id ?? null
    if (!classSchoolId) {
      // Case B repair, without invention. If the teacher has a real active
      // membership, adopt that school and heal the historical class row in
      // the same request. If they do NOT, the class stays school-less —
      // which is the truth for a Solo Teacher's private roster — rather than
      // provisioning a fictional school to fill the column.
      //
      // The previous resolveOwningSchool() call made adding a learner enough
      // to found an institution and become its school_admin. `students.school_id`
      // and `teacher_classes.school_id` are both nullable, so nothing here
      // requires a school to exist; the repair is best-effort by design.
      const { schoolId } = await resolveExistingOwningSchool(userId)
      classSchoolId = schoolId
      if (classSchoolId) {
        await db
          .from('teacher_classes')
          .update({ school_id: classSchoolId })
          .eq('id', classId)
          .is('school_id', null) // defense-in-depth: never clobber a value another concurrent repair already set
      }
    }

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
            user_id:         userId,
            name:            s.name.trim(),
            grade:           s.grade,
            curriculum_type: s.curriculum_type,
            school:          teacher.school ?? null,
            school_id:       classSchoolId,
            added_by:        'teacher',
            teacher_id:      teacher.id,
            parent_first_name: s.parent_name?.trim() ?? null,
            parent_phone:    s.parent_phone?.trim() ?? null,
            parent_email:    s.parent_email?.trim().toLowerCase() ?? null,
            notification_email:    !!s.parent_email,
            notification_whatsapp: !!s.parent_phone,
            ...(s.current_pathway ? {
              current_pathway:   s.current_pathway,
              selected_subjects: s.selected_subjects ?? [],
            } : {}),
          })
          .select('id, name')
          .single()

        if (insertErr || !student) {
          results.push({ name: s.name, status: 'error', error: insertErr?.message ?? 'Insert failed' })
          continue
        }

        // Link to class
        const { error: enrollErr } = await db.from('class_students').insert({
          class_id:   classId,
          student_id: student.id,
        })
        if (enrollErr) throw new Error(`Failed to enroll student: ${enrollErr.message}`)

        // Backfill pending submissions for any active assignments in this class
        const { data: activeAssignments } = await db
          .from('assignments')
          .select('id')
          .eq('class_id', classId)
          .gte('due_date', new Date().toISOString())

        if (activeAssignments && activeAssignments.length > 0) {
          await db.from('assignment_submissions').insert(
            activeAssignments.map((a: { id: string }) => ({
              assignment_id: a.id,
              student_id:    student.id,
              class_id:      classId,
              status:        'pending',
            }))
          )
        }

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
            `platform inayosaidia watoto kujifunza vizuri zaidi.\n\n` +
            `Bonyeza hapa kuunda akaunti yako ya mzazi:\n${inviteLink}\n\n` +
            `Mtoto wako atakuwa na mwalimu wake wa kibinafsi na ripoti za kina. Bure kabisa! 🇰🇪`

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
    let userId: string
    try {
      userId = (await requireAuthentication(supabase)).id
    } catch (err) {
      if (err instanceof UnauthorizedError) return apiUnauthorized()
      throw err
    }

    const teacher = await resolveTeacher(userId)
    if (!teacher) return apiForbidden()

    try {
      await requireClassTeacher(supabase, classId)
    } catch {
      return apiNotFound('Class not found')
    }

    const db = createServiceClient()

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
