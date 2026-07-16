import { z } from 'zod'
import { createClient } from '@/utils/supabase/server'
import { createServiceClient } from '@/utils/supabase/service'
import { apiSuccess, apiError, apiUnauthorized, apiForbidden, apiBadRequest } from '@/lib/api/response'
import { sendWelcomeMessage } from '@/lib/whatsapp/sender'
import { requireAuthentication, requireStudent, requireParent } from '@/lib/core/permissions'
import { UnauthorizedError } from '@/lib/core/errors'

/**
 * Preserves the exact original `.or(user_id.eq,parent_user_id.eq)` check
 * using the canonical self/parent gates, composed rather than reimplemented —
 * same reasoning as app/api/parent/assessments/process/route.ts.
 */
async function isSelfOrParentOf(client: Awaited<ReturnType<typeof createClient>>, studentId: string): Promise<boolean> {
  try {
    await requireStudent(client, studentId)
    return true
  } catch {
    // fall through to the parent check
  }
  try {
    await requireParent(client, studentId)
    return true
  } catch {
    return false
  }
}

const OptInSchema = z.object({
  phone:     z.string().min(1),
  optIn:     z.boolean(),
  studentId: z.uuid({ error: 'studentId must be a UUID' }),
})

function normaliseKenyanPhone(raw: string): string | null {
  const digits = raw.replace(/\D/g, '')

  let normalised: string
  if (digits.startsWith('0') && digits.length === 10) {
    // e.g. 0712345678 → 254712345678
    normalised = '254' + digits.slice(1)
  } else if (digits.startsWith('254') && digits.length === 12) {
    // e.g. 254712345678 (already normalized)
    normalised = digits
  } else {
    // Anything else (9-digit bare, wrong length, wrong prefix) — reject
    return null
  }

  // Valid Kenyan mobile: starts with 2547 (Safaricom/Airtel) or 2541 (Faiba/other)
  if (!normalised.startsWith('2547') && !normalised.startsWith('2541')) return null
  return normalised
}

export async function POST(req: Request) {
  try {
    const supabase = await createClient()
    let userId: string
    try {
      userId = (await requireAuthentication(supabase)).id
    } catch (err) {
      if (err instanceof UnauthorizedError) return apiUnauthorized()
      throw err
    }

    const body = await req.json()
    const parsed = OptInSchema.safeParse(body)
    if (!parsed.success) {
      return apiBadRequest(parsed.error.issues.map(i => i.message).join(', '))
    }
    const { phone, optIn, studentId } = parsed.data

    const db = createServiceClient()

    // Verify student belongs to this user — checks both link mechanisms
    // (direct creator via user_id, or invite-linked parent via parent_user_id),
    // matching every other parent-facing route.
    if (!(await isSelfOrParentOf(supabase, studentId))) return apiForbidden()

    const { data: student } = await db
      .from('students')
      .select('id, name, parent_first_name')
      .eq('id', studentId)
      .single()

    if (!student) return apiForbidden()

    // ── Opt-out ──────────────────────────────────────────────────────────────
    if (!optIn) {
      await db
        .from('students')
        .update({
          notification_whatsapp: false,
          whatsapp_opted_in:     false,
        })
        .eq('id', studentId)

      await db
        .from('whatsapp_opt_ins')
        .update({ opted_out_at: new Date().toISOString() })
        .eq('student_id', studentId)
        .is('opted_out_at', null)

      return apiSuccess({ success: true })
    }

    // ── Opt-in ───────────────────────────────────────────────────────────────
    const formattedPhone = normaliseKenyanPhone(phone)
    if (!formattedPhone) {
      return apiBadRequest('Invalid Kenyan phone number. Use format: 0712345678 or +254712345678')
    }

    // Resolve parent first name: prefer stored value, fall back to auth metadata.
    // `user_metadata` isn't part of the canonical CurrentUser shape (identity.ts
    // deliberately exposes only id/email — auth metadata is a raw Supabase Auth
    // concept, not an identity-service concern), so it's read directly here.
    const { data: { user: authUser } } = await supabase.auth.getUser()
    const parentFirstName =
      student.parent_first_name ??
      (authUser?.user_metadata as Record<string, string> | undefined)?.full_name ??
      (authUser?.user_metadata as Record<string, string> | undefined)?.name ??
      null

    await db
      .from('students')
      .update({
        parent_phone:          formattedPhone,
        notification_whatsapp: true,
        whatsapp_opted_in:     true,
        whatsapp_opted_in_at:  new Date().toISOString(),
        parent_first_name:     parentFirstName,
      })
      .eq('id', studentId)

    await db
      .from('whatsapp_opt_ins')
      .insert({
        student_id:  studentId,
        parent_phone: formattedPhone,
        source:       'dashboard_prompt',
      })

    // Send welcome message — fire and forget, never fails the request
    sendWelcomeMessage(formattedPhone, student.name as string, studentId)
      .catch(err => console.warn('[whatsapp-optin] welcome message failed:', err))

    return apiSuccess({ success: true, phone: formattedPhone })
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : String(e)
    console.error('[parent/whatsapp-optin POST]', message)
    return apiError('Internal server error')
  }
}
