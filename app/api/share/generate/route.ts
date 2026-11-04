import { createClient } from '@/utils/supabase/server'
import { createServiceClient } from '@/utils/supabase/service'
import { generateShareToken } from '@/lib/sharedReports/token'
import { ShareGenerateSchema, SHARE_TTL_DAYS, SHARE_MAX_BODY_BYTES } from '@/lib/sharedReports/reportSchema'
import { apiSuccess, apiError, apiUnauthorized, apiForbidden, apiBadRequest } from '@/lib/api/response'

export async function POST(req: Request) {
  try {
    const supabase = await createClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      return apiUnauthorized()
    }

    // Bound the body before parsing it (a missing/forged Content-Length is not trusted).
    const raw = await req.text()
    if (Buffer.byteLength(raw, 'utf8') > SHARE_MAX_BODY_BYTES) {
      return apiError('Report is too large to share', 413)
    }
    let json: unknown
    try {
      json = JSON.parse(raw)
    } catch {
      return apiBadRequest('Body must be valid JSON')
    }
    const parsed = ShareGenerateSchema.safeParse(json)
    if (!parsed.success) return apiBadRequest(parsed.error.issues[0]?.message ?? 'Missing studentId or reportData')
    const { studentId, reportData } = parsed.data

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

    // 192-bit CSPRNG bearer token (DSA-01); legacy 12-char tokens are retired
    const token = generateShareToken()

    const expiresAt = new Date()
    expiresAt.setDate(expiresAt.getDate() + SHARE_TTL_DAYS)

    const { error: insertError } = await db.from('shared_reports').insert({
      token,
      student_id:   studentId,
      user_id:      user.id,
      student_name: student.name,
      grade:        student.grade,
      report_data:  reportData,
      // Content is supplied by the caller, not derived server-side from learner
      // evidence — recorded so it is never mistaken for an EduNexus-generated report.
      provenance:   'client_supplied',
      expires_at:   expiresAt.toISOString(),
    })

    if (insertError) {
      // code only: the raw error's details can echo the row (incl. the bearer token)
      console.error('[share/generate] insert error:', insertError.code)
      return apiError('Failed to save share link')
    }

    const shareUrl = `https://www.edunexus.co.ke/shared/${token}`

    return apiSuccess({ token, shareUrl, expiresAt: expiresAt.toISOString() })
  } catch (error: unknown) {
    console.error('[share/generate] error:', error instanceof Error ? error.message : String(error))
    return apiError('Internal server error')
  }
}
