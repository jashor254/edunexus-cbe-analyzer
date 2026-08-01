// app/api/whatsapp/inbound/route.ts
// WhatsApp Business API webhook endpoint.
//
// Handles two things:
//   GET  — webhook verification challenge from Meta (one-time setup)
//   POST — inbound message callbacks (every parent reply)
//
// Uses service role client — webhooks have no user session.
// Always returns HTTP 200 to prevent Meta retrying failed deliveries.

import { NextRequest, NextResponse } from 'next/server'
import { createHmac, timingSafeEqual } from 'node:crypto'
import { processInboundReply, buildAcknowledgement } from '@/lib/parentPulse/observationPipeline'
import { sendWhatsApp } from '@/lib/whatsapp/sender'
import { createServiceClient } from '@/utils/supabase/service'
import { getLearnerProfile } from '@/lib/learnerModel/queries'

// ── GET — Meta webhook verification ──────────────────────────────────────────
// Meta sends a GET with hub.mode=subscribe + hub.verify_token + hub.challenge.
// We echo back hub.challenge as plain text to confirm ownership.

export async function GET(req: NextRequest): Promise<NextResponse> {
  const { searchParams } = req.nextUrl

  const mode        = searchParams.get('hub.mode')
  const verifyToken = searchParams.get('hub.verify_token')
  const challenge   = searchParams.get('hub.challenge')

  if (mode !== 'subscribe') {
    return new NextResponse('Invalid mode', { status: 400 })
  }

  const expectedToken = process.env.WHATSAPP_VERIFY_TOKEN
  if (!expectedToken) {
    console.error('[whatsapp/inbound] WHATSAPP_VERIFY_TOKEN not set')
    return new NextResponse('Server misconfiguration', { status: 500 })
  }

  if (verifyToken !== expectedToken) {
    return new NextResponse('Forbidden', { status: 403 })
  }

  // Echo challenge as plain text — Meta requires exactly this format
  return new NextResponse(challenge ?? '', {
    status: 200,
    headers: { 'Content-Type': 'text/plain' },
  })
}

// ── POST — inbound message webhook ───────────────────────────────────────────

export async function POST(req: NextRequest): Promise<NextResponse> {
  // Always return 200 — if we return anything else Meta will retry indefinitely.
  // Errors are logged internally.
  try {
    const rawBody = await req.text()

    // ── Signature verification ──────────────────────────────────────────────
    const webhookSecret = process.env.WHATSAPP_WEBHOOK_SECRET

    if (!webhookSecret) {
      console.error('[whatsapp/inbound] WHATSAPP_WEBHOOK_SECRET not set — rejecting payload')
      return NextResponse.json({ ok: false, error: 'webhook_not_configured' }, { status: 401 })
    }

    const signature = req.headers.get('x-hub-signature-256') ?? ''

    const expectedSig =
      'sha256=' +
      createHmac('sha256', webhookSecret)
        .update(rawBody)
        .digest('hex')

    const sigBuffer  = Buffer.from(signature)
    const expectedBuffer = Buffer.from(expectedSig)

    // timingSafeEqual requires equal-length buffers
    const mismatch =
      sigBuffer.length !== expectedBuffer.length ||
      !timingSafeEqual(sigBuffer, expectedBuffer)

    if (mismatch) {
      console.error('[whatsapp/inbound] Signature mismatch — rejecting payload')
      // Return 200 anyway; a 403 would cause Meta to retry
      return NextResponse.json({ ok: false, error: 'signature_mismatch' }, { status: 200 })
    }

    // ── Parse payload ───────────────────────────────────────────────────────
    let payload: Record<string, unknown>
    try {
      payload = JSON.parse(rawBody) as Record<string, unknown>
    } catch {
      console.error('[whatsapp/inbound] JSON parse failed')
      return NextResponse.json({ ok: false, error: 'invalid_json' }, { status: 200 })
    }

    const extracted = extractMessage(payload)
    if (!extracted) {
      // Not a message event (could be a status update or delivery receipt)
      return NextResponse.json({ ok: true }, { status: 200 })
    }

    const { fromPhone, messageBody } = extracted
    const receivedAt = new Date().toISOString()

    // ── Run observation pipeline ────────────────────────────────────────────
    const result = await processInboundReply({ fromPhone, rawBody: messageBody, receivedAt })

    // ── Send acknowledgement if outcome is structured ───────────────────────
    if (result.processed && result.outcome && result.outcome !== 'free_form') {
      const ack = await buildAcknowledgementForPhone(
        fromPhone,
        result.outcome as 'demonstrated' | 'struggled' | 'not_attempted',
        result.teacherNotified ?? false,
      )
      if (ack) {
        // notification_log.reference_id is a NOT NULL uuid — processInboundReply's
        // result doesn't expose a studentId here (only outcome/error), so
        // logging this ack to notification_log would need that return shape
        // widened first. Deferred; this at least stops the send failing silently.
        try {
          await sendWhatsApp(fromPhone, ack)
        } catch (err) {
          console.error('[whatsapp/inbound] ack send failed', { fromPhone, message: err instanceof Error ? err.message : String(err) })
        }
      }
    }

    return NextResponse.json({ ok: true, outcome: result.outcome ?? null }, { status: 200 })
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    console.error('[whatsapp/inbound] Unhandled error:', message)
    // Still 200 — never let an exception cause Meta to retry
    return NextResponse.json({ ok: false, error: 'internal_error' }, { status: 200 })
  }
}

// ── Helpers ───────────────────────────────────────────────────────────────────

type ExtractedMessage = {
  fromPhone:   string
  messageBody: string
}

/**
 * Extracts fromPhone + messageBody from either:
 *   - Meta Cloud API format  (entry[].changes[].value.messages[])
 *   - Twilio format          (From, Body)
 * Returns null when the payload is not a user text message.
 */
function extractMessage(
  payload: Record<string, unknown>
): ExtractedMessage | null {
  // ── Meta Cloud API format ───────────────────────────────────────────────
  try {
    const entry   = (payload.entry   as Array<Record<string, unknown>> | undefined)?.[0]
    const change  = (entry?.changes  as Array<Record<string, unknown>> | undefined)?.[0]
    const value   = change?.value as Record<string, unknown> | undefined
    const messages = value?.messages as Array<Record<string, unknown>> | undefined
    const msg     = messages?.[0]

    if (msg && typeof msg.from === 'string') {
      const textObj = msg.text as { body?: string } | undefined
      const body    = textObj?.body
      if (body && typeof body === 'string') {
        return { fromPhone: msg.from, messageBody: body }
      }
    }
  } catch {
    // Not Meta format — fall through to Twilio
  }

  // ── Twilio format ───────────────────────────────────────────────────────
  if (typeof payload.From === 'string' && typeof payload.Body === 'string') {
    // Twilio sends E.164 like "whatsapp:+254712345678" — strip prefix
    const from = (payload.From as string).replace(/^whatsapp:\+?/, '')
    return { fromPhone: from, messageBody: payload.Body as string }
  }

  return null
}

/**
 * Looks up the parent's first name and the substrand context for this phone,
 * then returns the acknowledgement message text.
 * Returns null if the lookup fails (non-fatal).
 */
async function buildAcknowledgementForPhone(
  phone:           string,
  outcome:         'demonstrated' | 'struggled' | 'not_attempted',
  teacherNotified: boolean,
): Promise<string | null> {
  try {
    const db = createServiceClient()

    const { data: optIn } = await db
      .from('whatsapp_opt_ins')
      .select('student_id, students(parent_user_id, profiles(first_name))')
      .eq('phone', phone)
      .eq('active', true)
      .limit(1)
      .maybeSingle()

    if (!optIn) return null

    const studentId = optIn.student_id as string

    // Resolve first name from nested profiles join
    const studentRow = optIn.students as unknown as {
      parent_user_id: string
      profiles?: { first_name?: string } | null
    } | null
    const firstName = studentRow?.profiles?.first_name ?? 'your child'

    // Get last known substrand from the learner profile
    const profile = await getLearnerProfile(studentId)

    const observations = profile?.parent_observations ?? []

    let substrand = 'this topic'
    if (observations.length > 0) {
      substrand = observations[observations.length - 1].substrand
    } else {
      const gaps = profile?.confirmed_gaps ?? []
      if (gaps[0]) {
        const gapKey = gaps[0]
        substrand = gapKey.includes(':') ? gapKey.split(':')[1] : gapKey
      }
    }

    return buildAcknowledgement(firstName, outcome, substrand, teacherNotified)
  } catch {
    // Non-fatal — skip the ack rather than crashing the pipeline
    return null
  }
}
