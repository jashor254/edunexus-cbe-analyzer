// app/api/students/create/route.ts
import { createClient } from '@/utils/supabase/server'
import { createServiceClient } from '@/utils/supabase/service'
import { apiSuccess, apiError, apiUnauthorized, apiBadRequest } from '@/lib/api/response'

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
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) return apiUnauthorized()

    const body = await request.json()
    const { name, grade, school, curriculum_type, current_pathway, selected_subjects } = body

    if (!name?.trim()) return apiBadRequest('Name is required')
    const gradeNum = Number(grade)
    if (!gradeNum || gradeNum < 7 || gradeNum > 12) return apiBadRequest('Grade must be between 7 and 12')

    const validCurriculumTypes = ['cbc', 'igcse', 'ib', 'other']
    const curriculumType = validCurriculumTypes.includes(curriculum_type) ? curriculum_type : 'cbc'

    const service = createServiceClient()

    // Determine active plan
    const { data: subscription } = await service
      .from('subscriptions')
      .select('plan')
      .eq('user_id', user.id)
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
      .or(`user_id.eq.${user.id},parent_user_id.eq.${user.id}`)
      .neq('added_by', 'teacher')

    if (countError) return apiError(countError.message)

    if ((count ?? 0) >= maxStudents) {
      return apiError(
        `Your ${plan} plan allows up to ${maxStudents} student(s). Upgrade to add more.`,
        403
      )
    }

    const VALID_PATHWAYS = ['STEM', 'Social Sciences', 'Arts & Sports Science'] as const
    type ValidPathway = typeof VALID_PATHWAYS[number]
    const pathwayValue: ValidPathway | null =
      current_pathway && VALID_PATHWAYS.includes(current_pathway as ValidPathway)
        ? (current_pathway as ValidPathway)
        : null

    // Create student
    const { data: student, error: insertError } = await service
      .from('students')
      .insert({
        user_id:         user.id,
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

    if (insertError) return apiError(insertError.message)

    // Ensure token_balances row exists for user
    await service
      .from('token_balances')
      .upsert({ user_id: user.id, balance: 0 }, { onConflict: 'user_id', ignoreDuplicates: true })

    return apiSuccess({ student }, 201)
  } catch (err) {
    console.error('[students/create]', err)
    return apiError('Server error')
  }
}
