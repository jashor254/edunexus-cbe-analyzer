// lib/holiday/notify.ts
// Parent Delivery — Adaptive Learning v2 Architecture §6 (FROZEN). No new
// channel infrastructure: this is the existing lib/whatsapp/sender.ts
// gaining one more trigger point (Holiday Return processed), following
// the exact fire-and-forget/notification_log/publishEvent pattern already
// established by app/api/cron/parent-pulse/route.ts. A smartphone parent
// gets a plain-language, Insight-formatted update; a no-smartphone parent
// already got the same information physically, via the printable pack's
// own parent fields (Wave 3) — no separate work needed for that path.

import { createServiceClient } from '@/utils/supabase/service'
import { sendWhatsApp } from '@/lib/whatsapp/sender'
import { publishEvent } from '@/lib/events'
import type { HolidayReturnMasteryClaim } from './return'

export type HolidayReturnNotifyInput = {
  studentId:      string
  weeksAssigned:  number
  weeksCompleted: number
  masteryClaims:  HolidayReturnMasteryClaim[]
}

function buildParentMessage(firstName: string, input: HolidayReturnNotifyInput): string {
  const completion = `${firstName} completed ${input.weeksCompleted} of ${input.weeksAssigned} weeks of holiday work.`
  const subjects = input.masteryClaims.map(c => c.subject).join(', ')
  const detail = subjects
    ? ` The teacher reviewed work in: ${subjects}.`
    : ''
  return `EduNexus — Holiday Pack Update 🎓\n\n${completion}${detail}\n\nThank you for supporting ${firstName} this holiday!`
}

/**
 * Fire-and-forget: never throws, never blocks the caller (recordHolidayReturn
 * has already succeeded by the time this runs — a WhatsApp failure must not
 * un-record a real intake). Silently does nothing if no parent phone is on
 * file — the printable pack already carried this information physically.
 */
export async function notifyParentOfHolidayReturn(input: HolidayReturnNotifyInput): Promise<void> {
  try {
    const db = createServiceClient()
    const { data: student } = await db
      .from('students')
      .select('name, parent_phone')
      .eq('id', input.studentId)
      .maybeSingle()

    const phone = (student?.parent_phone as string | null) ?? null
    if (!phone) return

    const firstName = ((student?.name as string | null) ?? 'Your child').split(' ')[0]
    const message = buildParentMessage(firstName, input)

    await sendWhatsApp(phone, message)

    await db.from('notification_log').insert({
      user_id:      input.studentId,
      type:         'holiday_return_processed',
      reference_id: input.studentId,
      channel:      'whatsapp',
      phone_number: phone,
      success:      true,
    })

    void publishEvent({
      event_type:    'holiday.return.notified',
      resource_type: 'student',
      resource_id:   input.studentId,
      payload:       { weeksCompleted: input.weeksCompleted, weeksAssigned: input.weeksAssigned },
    })
  } catch (err) {
    console.error('[holiday/notify] failed to notify parent of holiday return', input.studentId, err)
  }
}
