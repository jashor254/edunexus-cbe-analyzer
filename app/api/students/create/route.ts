// app/api/students/create/route.ts
import { z } from 'zod'
import { createClient } from '@/utils/supabase/server'
import { createServiceClient } from '@/utils/supabase/service'
import { apiSuccess, apiError, apiUnauthorized, apiBadRequest } from '@/lib/api/response'
import { requireAuthentication } from '@/lib/core/permissions'
import { UnauthorizedError } from '@/lib/core/errors'
import { logger } from '@/lib/observability/logger'
import { SENIOR_PATHWAYS } from '@/lib/curriculum/subjects'

const CreateStudentSchema = z.object({
  name:              z.string().trim().min(1),
  grade:             z.coerce.number().int().min(7).max(12),
  school:            z.string().trim().optional(),
  curriculum_type:   z.enum(['cbc', 'igcse', 'ib', 'other']).optional(),
  current_pathway:   z.enum(SENIOR_PATHWAYS).optional(),
  selected_subjects: z.array(z.string()).optional(),
})

const PLAN_LIMITS: Record<string, number> = {
  free:    1,
  starter: 2,
  term:    3,
  premium: 3,
  admin:   3,
  school:  9999,
}

export async function POST(request: Request) {
  try {
    const supabase = await createClient()
    let userId: string
    try {
      userId = (await requireAuthentication(supabase)).id
    } catch (err) {
      if (err instanceof UnauthorizedError) return apiUnauthorized()
      throw err
    }

    const parsed = CreateStudentSchema.safeParse(await request.json())
    if (!parsed.success) return apiBadRequest(parsed.error.issues[0]?.message ?? 'Invalid input')
    const { name, grade, school, curriculum_type, current_pathway, selected_subjects } = parsed.data

    const gradeNum = grade
    const curriculumType = curriculum_type ?? 'cbc'

    const service = createServiceClient()

    // Determine active plan
    const { data: subscription } = await service
      .from('subscriptions')
      .select('plan')
      .eq('user_id', userId)
      .eq('status', 'active')
      .gt('expires_at', new Date().toISOString())
      .order('created_at', { ascending: false })
      .limit(1)
      .single()

    const plan = subscription?.plan || 'free'
    const maxStudents = PLAN_LIMITS[plan] ?? 1

    // Count only parent-owned students — exclude teacher-created ones so class
    // students don't consume parent plan slots
    const { count, error: countError } = await service
      .from('students')
      .select('id', { count: 'exact', head: true })
      .or(`user_id.eq.${userId},parent_user_id.eq.${userId}`)
      .neq('added_by', 'teacher')

    if (countError) {
      logger.error('Student count lookup failed', { operation: 'students.create.count', user_id: userId }, countError)
      return apiError('Unable to create student. Please try again.')
    }

    if ((count ?? 0) >= maxStudents) {
      return apiError(
        `Your ${plan} plan allows up to ${maxStudents} student(s). Upgrade to add more.`,
        403
      )
    }

    const pathwayValue = current_pathway ?? null

    // Create student
    const { data: student, error: insertError } = await service
      .from('students')
      .insert({
        user_id:         userId,
        name:            name.trim(),
        grade:           gradeNum,
        school:          school?.trim() || null,
        curriculum_type: curriculumType,
        ...(pathwayValue ? {
          current_pathway:   pathwayValue,
          selected_subjects: Array.isArray(selected_subjects) ? selected_subjects : [],
        } : {}),
      })
      .select()
      .single()

    if (insertError) {
      logger.error('Student insert failed', { operation: 'students.create.insert', user_id: userId }, insertError)
      return apiError('Unable to create student. Please try again.')
    }

    // Ensure token_balances row exists for user
    await service
      .from('token_balances')
      .upsert({ user_id: userId, balance: 0 }, { onConflict: 'user_id', ignoreDuplicates: true })

    return apiSuccess({ student }, 201)
  } catch (err) {
    console.error('[students/create]', err)
    return apiError('Server error')
  }
}
