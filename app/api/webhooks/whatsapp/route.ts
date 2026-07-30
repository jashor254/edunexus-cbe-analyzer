// app/api/webhooks/whatsapp/route.ts
//
// Minimal WhatsApp Cloud API webhook — infrastructure preparation for the
// migration off the WhatsApp Business App number.
//
// GET  — Cloud API verification handshake (hub.mode / hub.verify_token / hub.challenge)
// POST — signature verification only; does not parse, store, or act on message content.
//
// Intentionally does NOT: send messages, ingest learner evidence, touch
// Supabase, or reply to users. That logic stays in the existing
// app/api/whatsapp/inbound route until the Cloud API migration itself happens.

import { NextRequest, NextResponse } from 'next/server'
import { createHmac, timingSafeEqual } from 'node:crypto'

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

  if (process.env.NODE_ENV !== 'production') {
    console.log('[webhooks/whatsapp] event received', {
      object: isRecord(payload) ? payload.object : undefined,
    })
  }

  return NextResponse.json({ ok: true }, { status: 200 })
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
