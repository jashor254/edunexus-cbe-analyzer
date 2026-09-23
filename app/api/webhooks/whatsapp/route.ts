// app/api/webhooks/whatsapp/route.ts
//
// WhatsApp Cloud API webhook — the one URL Meta is actually configured to
// call (its verify token and app secret are the only WhatsApp webhook env
// vars that exist in .env.local / Vercel: WHATSAPP_WEBHOOK_VERIFY_TOKEN and
// WHATSAPP_APP_SECRET).
//
// GET  — Cloud API verification handshake (hub.mode / hub.verify_token / hub.challenge)
// POST — signature verification, then parses the inbound message and runs it
//        through the parent-pulse observation pipeline, sending an
//        acknowledgement back when the pipeline produces a structured outcome.
//
// app/api/whatsapp/inbound/route.ts re-exports this file's GET/POST so the
// pipeline still runs if that URL is what ends up registered instead.

import { NextRequest, NextResponse } from 'next/server'
import { createHmac, timingSafeEqual } from 'node:crypto'
import { processInboundReply, buildAcknowledgement } from '@/lib/parentPulse/observationPipeline'
import { sendWhatsApp } from '@/lib/whatsapp/sender'
import { createServiceClient } from '@/utils/supabase/service'
import { getLearnerProfile } from '@/lib/learnerModel/queries'
import { logger } from '@/lib/observability/logger'

export const runtime = 'nodejs'

export async function GET(req: NextRequest): Promise<NextResponse> {
  const { searchParams } = req.nextUrl

  const mode      = searchParams.get('hub.mode')
  const token     = searchParams.get('hub.verify_token')
  const challenge = searchParams.get('hub.challenge')

  const expectedToken = process.env.WHATSAPP_WEBHOOK_VERIFY_TOKEN

  if (mode === 'subscribe' && !!expectedToken && token === expectedToken && !!challenge) {
    return new NextResponse(challenge, {
      status: 200,
      headers: { 'Content-Type': 'text/plain' },
    })
  }

  return new NextResponse('Forbidden', { status: 403 })
}

export async function POST(req: NextRequest): Promise<NextResponse> {
  const rawBody = await req.text()

  const appSecret = process.env.WHATSAPP_APP_SECRET
  const signatureHeader = req.headers.get('x-hub-signature-256')

  if (!appSecret || !isValidSignature(rawBody, signatureHeader, appSecret)) {
    console.error('[webhooks/whatsapp] rejected: missing or invalid signature')
    return NextResponse.json({ error: 'invalid_signature' }, { status: 401 })
  }

  let payload: unknown
  try {
    payload = JSON.parse(rawBody)
  } catch {
    console.error('[webhooks/whatsapp] rejected: malformed JSON')
    return NextResponse.json({ error: 'invalid_json' }, { status: 400 })
  }

  logger.debug('[webhooks/whatsapp] event received', {
    object: isRecord(payload) ? payload.object : undefined,
  })

  // Once the request is authenticated, never return a non-200 — a non-200
  // makes Meta retry delivery indefinitely. Business-logic failures below
  // are logged and swallowed instead.
  try {
    const extracted = isRecord(payload) ? extractMessage(payload) : null
    if (!extracted) {
      // Not a message event (could be a status update or delivery receipt)
      return NextResponse.json({ ok: true }, { status: 200 })
    }

    const { fromPhone, messageBody } = extracted
    const receivedAt = new Date().toISOString()

    const result = await processInboundReply({ fromPhone, rawBody: messageBody, receivedAt })

    if (result.processed && result.outcome && result.outcome !== 'free_form') {
      const ack = await buildAcknowledgementForPhone(
        fromPhone,
        result.outcome as 'demonstrated' | 'struggled' | 'not_attempted',
        result.teacherNotified ?? false,
      )
      if (ack) {
        try {
          await sendWhatsApp(fromPhone, ack)
        } catch (err) {
          console.error('[webhooks/whatsapp] ack send failed', { fromPhone, message: err instanceof Error ? err.message : String(err) })
        }
      }
    }

    return NextResponse.json({ ok: true, outcome: result.outcome ?? null }, { status: 200 })
  } catch (err) {
    console.error('[webhooks/whatsapp] pipeline error:', err instanceof Error ? err.message : String(err))
    return NextResponse.json({ ok: false, error: 'internal_error' }, { status: 200 })
  }
}

function isValidSignature(
  rawBody: string,
  signatureHeader: string | null,
  appSecret: string,
): boolean {
  if (!signatureHeader || !signatureHeader.startsWith('sha256=')) {
    return false
  }

  const expected = 'sha256=' + createHmac('sha256', appSecret).update(rawBody).digest('hex')

  const receivedBuffer = Buffer.from(signatureHeader)
  const expectedBuffer = Buffer.from(expected)

  if (receivedBuffer.length !== expectedBuffer.length) {
    return false
  }

  return timingSafeEqual(receivedBuffer, expectedBuffer)
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null
}

// ── Message extraction ───────────────────────────────────────────────────────

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
