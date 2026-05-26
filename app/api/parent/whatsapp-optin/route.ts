import { z } from 'zod'
import { createClient } from '@/utils/supabase/server'
import { createServiceClient } from '@/utils/supabase/service'
import { apiSuccess, apiError, apiUnauthorized, apiForbidden, apiBadRequest } from '@/lib/api/response'
import { sendWelcomeMessage } from '@/lib/whatsapp/sender'

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
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return apiUnauthorized()

    const body = await req.json()
    const parsed = OptInSchema.safeParse(body)
    if (!parsed.success) {
      return apiBadRequest(parsed.error.issues.map(i => i.message).join(', '))
    }
    const { phone, optIn, studentId } = parsed.data

    const db = createServiceClient()

    // Verify student belongs to this user
    const { data: student } = await db
      .from('students')
      .select('id, name, parent_first_name')
      .eq('id', studentId)
      .eq('user_id', user.id)
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

    // Resolve parent first name: prefer stored value, fall back to auth metadata
    const parentFirstName =
      student.parent_first_name ??
      (user.user_metadata as Record<string, string> | undefined)?.full_name ??
      (user.user_metadata as Record<string, string> | undefined)?.name ??
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
