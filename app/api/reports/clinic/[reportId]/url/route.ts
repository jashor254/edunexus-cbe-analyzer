// app/api/reports/clinic/[reportId]/url/route.ts
// Mints a short-lived signed URL for a clinic report PDF. The `clinic-reports`
// storage bucket is private (Sprint 15) — this route is the only sanctioned
// path to a downloadable link, gated on the same ownership checks already
// used across the parent/teacher/admin surfaces (see lib/api/response.ts and
// app/api/parent/*/route.ts for the established .or(user_id, parent_user_id)
// pattern reused below).

import { NextRequest } from 'next/server'
import { createClient } from '@/utils/supabase/server'
import { createServiceClient } from '@/utils/supabase/service'
import { apiSuccess, apiError, apiUnauthorized, apiForbidden } from '@/lib/api/response'
import { ADMIN_CONFIG } from '@/lib/config/api'

const BUCKET = 'clinic-reports'
const SIGNED_URL_TTL_SECONDS = 60 * 5

// pdf_url is stored as a full public URL (legacy — see migration
// 20260710120000_sprint15_corrections.sql). Extract the object path so a
// signed URL can be minted for the same object.
function extractObjectPath(pdfUrl: string): string | null {
  const marker = `/storage/v1/object/public/${BUCKET}/`
  const idx = pdfUrl.indexOf(marker)
  if (idx === -1) return null
  return decodeURIComponent(pdfUrl.slice(idx + marker.length))
}

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ reportId: string }> }
) {
  try {
    const { reportId } = await params

    const supabase = await createClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) return apiUnauthorized()

    const db = createServiceClient()

    const { data: report } = await db
      .from('student_clinic_reports')
      .select('id, student_id, class_id, teacher_id, pdf_url')
      .eq('id', reportId)
      .maybeSingle()

    // Same response for "doesn't exist" and "not yours" — don't leak which.
    if (!report) return apiForbidden()

    let authorized = false

    // 1. The learner themself, or a parent linked via students.parent_user_id
    if (report.student_id) {
      const { data: student } = await db
        .from('students')
        .select('id')
        .eq('id', report.student_id)
        .or(`user_id.eq.${user.id},parent_user_id.eq.${user.id}`)
        .maybeSingle()
      if (student) authorized = true
    }

    // 2. A parent linked via the separate class_students.parent_id mechanism
    //    (this and students.parent_user_id are not guaranteed to be kept in
    //    sync — check both, matching app/api/parent/alerts/route.ts).
    if (!authorized && report.student_id) {
      const { data: link } = await db
        .from('class_students')
        .select('id')
        .eq('student_id', report.student_id)
        .eq('parent_id', user.id)
        .maybeSingle()
      if (link) authorized = true
    }

    // 3. The owning teacher
    if (!authorized && report.teacher_id) {
      const { data: teacher } = await db
        .from('teachers')
        .select('id')
        .eq('id', report.teacher_id)
        .eq('user_id', user.id)
        .maybeSingle()
      if (teacher) authorized = true
    }

    // 4. Admin (same convention as app/api/admin/pilot/students/route.ts)
    if (!authorized && ADMIN_CONFIG.isAdmin(user.email ?? '')) {
      authorized = true
    }

    if (!authorized) return apiForbidden()

    if (!report.pdf_url) return apiError('Report PDF not available', 404)

    const objectPath = extractObjectPath(report.pdf_url)
    if (!objectPath) return apiError('Report PDF not available', 404)

    const { data: signed, error: signError } = await db.storage
      .from(BUCKET)
      .createSignedUrl(objectPath, SIGNED_URL_TTL_SECONDS)

    if (signError || !signed) return apiError('Failed to generate report link', 500)

    return apiSuccess({ url: signed.signedUrl, expiresInSeconds: SIGNED_URL_TTL_SECONDS })
  } catch (e: unknown) {
    console.error('[reports/clinic/url]', e instanceof Error ? e.message : String(e))
    return apiError('Internal server error')
  }
}
