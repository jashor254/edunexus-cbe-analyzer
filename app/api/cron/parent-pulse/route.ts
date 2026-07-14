// POST /api/cron/parent-pulse
// Runs every Sunday — sends the weekly parent pulse via WhatsApp.
// Scheduled via .github/workflows/notification-crons.yml (not vercel.json —
// see that workflow's header comment for why). Protected by cron secret.
// Fire-and-forget per student.

import { createServiceClient } from '@/utils/supabase/service'
import { apiSuccess, apiError, apiUnauthorized } from '@/lib/api/response'
import { buildAllParentPulses } from '@/lib/parentPulse/builder'
import { sendWhatsApp } from '@/lib/whatsapp/sender'
import { timingSafeEqualString } from '@/lib/api/secretCompare'
import { publishEvent } from '@/lib/events'

export async function POST(req: Request): Promise<Response> {
  try {
    const cronSecret = req.headers.get('x-cron-secret')
    if (!timingSafeEqualString(cronSecret, process.env.CRON_SECRET)) return apiUnauthorized()

    const db  = createServiceClient()
    const weekOf = new Date().toISOString().slice(0, 10)

    const pulses = await buildAllParentPulses(weekOf)
    if (!pulses.length) return apiSuccess({ sent: 0, message: 'No opted-in parents found' })

    let sent   = 0
    let failed = 0

    for (const pulse of pulses) {
      if (!pulse.parent_phone) { failed++; continue }

      try {
        await sendWhatsApp(pulse.parent_phone, pulse.message)

        // Log the notification
        await db.from('notification_log').insert({
          user_id:      pulse.student_id,
          type:         'parent_weekly_pulse',
          reference_id: pulse.student_id,
          channel:      'whatsapp',
          phone_number: pulse.parent_phone,
          success:      true,
        })

        void publishEvent({
          event_type:      'parent.pulse.generated',
          resource_type:   'student',
          resource_id:     pulse.student_id,
          payload: {
            student_id: pulse.student_id,
            week_of:    weekOf,
          },
          idempotency_key: `parent.pulse.generated:${pulse.student_id}:${weekOf}`,
        }).catch(err => console.error('[events] parent.pulse.generated:', err instanceof Error ? err.message : String(err)))

        sent++
      } catch (err) {
        failed++
        await db.from('notification_log').insert({
          user_id:       pulse.student_id,
          type:          'parent_weekly_pulse',
          reference_id:  pulse.student_id,
          channel:       'whatsapp',
          phone_number:  pulse.parent_phone,
          success:       false,
          error_message: err instanceof Error ? err.message : String(err),
        })
      }
    }

    return apiSuccess({ sent, failed, total: pulses.length, week_of: weekOf })
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e)
    console.error('[cron/parent-pulse]', msg)
    return apiError('Parent pulse cron failed')
  }
}
