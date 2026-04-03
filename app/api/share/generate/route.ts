import { createClient } from '@/utils/supabase/server'
import { createServiceClient } from '@/utils/supabase/service'
import { apiSuccess, apiError, apiUnauthorized, apiForbidden, apiBadRequest } from '@/lib/api/response'

export async function POST(req: Request) {
  try {
    const supabase = await createClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      return apiUnauthorized()
    }

    const { studentId, reportData } = await req.json()
    if (!studentId || !reportData) {
      return apiBadRequest('Missing studentId or reportData')
    }

    const db = createServiceClient()

    // Verify student belongs to this user
    const { data: student, error: studentError } = await db
      .from('students')
      .select('id, name, grade')
      .eq('id', studentId)
      .eq('user_id', user.id)
      .single()

    if (studentError || !student) {
      return apiForbidden()
    }

    // Generate unique 12-char token
    const token = crypto.randomUUID().replace(/-/g, '').substring(0, 12).toUpperCase()

    const expiresAt = new Date()
    expiresAt.setDate(expiresAt.getDate() + 30)

    const { error: insertError } = await db.from('shared_reports').insert({
      token,
      student_id:   studentId,
      user_id:      user.id,
      student_name: student.name,
      grade:        student.grade,
      report_data:  reportData,
      expires_at:   expiresAt.toISOString(),
    })

    if (insertError) {
      console.error('[share/generate] insert error:', insertError)
      return apiError('Failed to save share link')
    }

    const shareUrl = `https://www.edunexus.co.ke/shared/${token}`

    return apiSuccess({ token, shareUrl, expiresAt: expiresAt.toISOString() })
  } catch (error: any) {
    console.error('[share/generate] error:', error.message)
    return apiError('Internal server error')
  }
}
