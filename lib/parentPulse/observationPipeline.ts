// lib/parentPulse/observationPipeline.ts
// Parent observation processing pipeline.
// Parses inbound WhatsApp replies from the weekly Parent Pulse and writes
// them into the Learner Model via updateFromParentObservation.
//
// Data flow:
//   WhatsApp inbound webhook → processInboundReply → updateFromParentObservation
//                                                   → whatsapp_inbound_log

import { repos } from '@/lib/repositories'
import { afterParentObservation } from '@/lib/eils'
import type { ParentObservationOutcome } from '@/lib/learnerModel/types'

// ── Types ─────────────────────────────────────────────────────────────────────

export type InboundReply = {
  fromPhone:  string
  rawBody:    string
  receivedAt: string
}

export type ReplyOutcome = ParentObservationOutcome | 'free_form'

type ParsedReply = {
  outcome:   ReplyOutcome
  studentId: string
  substrand: string
  weekOf:    string
  parentId:  string
}

type PhoneContext = {
  studentId: string
  substrand: string
  weekOf:    string
  parentId:  string
}

type ProcessResult = {
  processed: boolean
  outcome?:  ReplyOutcome
  error?:    string
}

// ── 1. parseReplyBody ─────────────────────────────────────────────────────────
// Maps raw WhatsApp text to a structured outcome.
// Accepts numbered choices (1/2/3) and plain language keywords.

export function parseReplyBody(rawBody: string): ReplyOutcome {
  const text = rawBody.trim().toLowerCase()

  // Demonstrated: "1", "1." or keyword phrases for positive understanding
  if (
    /^1\.?$/.test(text) ||
    text.includes('well') ||
    text.includes('understood') ||
    text.includes('explained')
  ) {
    return 'demonstrated'
  }

  // Struggled: "2", "2." or keyword phrases for difficulty
  if (
    /^2\.?$/.test(text) ||
    text.includes('struggled') ||
    text.includes('hard') ||
    text.includes('difficult') ||
    text.includes('fail')
  ) {
    return 'struggled'
  }

  // Not attempted: "3", "3." or keyword phrases for not done
  if (
    /^3\.?$/.test(text) ||
    text.includes("didn't") ||
    text.includes('no time') ||
    text.includes('busy')
  ) {
    return 'not_attempted'
  }

  return 'free_form'
}

// ── 2. resolveParentFromPhone ─────────────────────────────────────────────────
// Looks up the opt-in record for this phone number and resolves the current
// substrand context so we know which topic the reply refers to.
//
// Strategy:
//   1. whatsapp_opt_ins → student_id + parent_user_id
//   2. Most recent parent_observation substrand from learner_profiles
//   3. Fallback: student's first confirmed_gap (if any)

export async function resolveParentFromPhone(
  phone: string
): Promise<PhoneContext | null> {
  // 1. Find the opt-in record for this phone
  const optIn = await repos.notifications.getOptInByPhone(phone)

  if (!optIn) return null

  const studentId = optIn.student_id
  const parentId   = optIn.students?.parent_user_id ?? ''

  if (!studentId || !parentId) return null

  // 2. Pull learner profile to resolve substrand context
  const profile = await repos.learnerModel.getLearnerProfile(studentId)

  const weekOf = currentWeekOf()

  // Most recent parent observation gives us the last substrand sent
  const observations = profile?.parent_observations ?? []

  if (observations.length > 0) {
    const latest = observations[observations.length - 1]
    return {
      studentId,
      substrand: latest.substrand,
      weekOf:    latest.week_of ?? weekOf,
      parentId,
    }
  }

  // 3. Fallback: first confirmed gap as substrand context
  const confirmedGaps = profile?.confirmed_gaps ?? []
  const gapKey = confirmedGaps[0] ?? ''
  // Keys are stored as "subject:substrand" — extract substrand part
  const substrand = gapKey.includes(':') ? gapKey.split(':')[1] : gapKey

  return {
    studentId,
    substrand: substrand || 'general',
    weekOf,
    parentId,
  }
}

// ── 3. processInboundReply ────────────────────────────────────────────────────
// Orchestrates the full pipeline:
//   parse → resolve → update learner model → log → return result

export async function processInboundReply(
  inbound: InboundReply
): Promise<ProcessResult> {
  try {
    const outcome = parseReplyBody(inbound.rawBody)

    const context = await resolveParentFromPhone(inbound.fromPhone)

    if (!context) {
      // Unknown phone — log and exit cleanly
      await logInbound({
        phone:        inbound.fromPhone,
        rawBody:      inbound.rawBody,
        receivedAt:   inbound.receivedAt,
        parsedReply:  outcome,
        processed:    false,
        errorMessage: 'No opt-in found for phone',
      })
      return { processed: false, error: 'No opt-in found for phone' }
    }

    const parsed: ParsedReply = { outcome, ...context }

    // Free-form replies — log and skip model update (needs human review)
    if (outcome === 'free_form') {
      await logInbound({
        phone:       inbound.fromPhone,
        rawBody:     inbound.rawBody,
        receivedAt:  inbound.receivedAt,
        parsedReply: 'free_form',
        studentId:   context.studentId,
        parentId:    context.parentId,
        processed:   true,
      })
      return { processed: true, outcome: 'free_form' }
    }

    // Structured outcome — update EILS + Learner Model
    await afterParentObservation({
      studentId:  parsed.studentId,
      substrand:  parsed.substrand,
      outcome:    outcome as ParentObservationOutcome,
      weekOf:     parsed.weekOf,
      recordedAt: inbound.receivedAt,
    })

    await logInbound({
      phone:       inbound.fromPhone,
      rawBody:     inbound.rawBody,
      receivedAt:  inbound.receivedAt,
      parsedReply: outcome,
      studentId:   context.studentId,
      parentId:    context.parentId,
      processed:   true,
    })

    return { processed: true, outcome }
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    console.error('[observationPipeline] processInboundReply error:', message)

    // Best-effort log — don't let a log failure surface as a processing error
    try {
      await logInbound({
        phone:        inbound.fromPhone,
        rawBody:      inbound.rawBody,
        receivedAt:   inbound.receivedAt,
        parsedReply:  'free_form',
        processed:    false,
        errorMessage: message,
      })
    } catch {
      // Non-fatal — log failure doesn't change the pipeline outcome
    }

    return { processed: false, error: message }
  }
}

// ── 4. buildAcknowledgement ───────────────────────────────────────────────────
// Constructs the reply message sent back to the parent on WhatsApp.

export function buildAcknowledgement(
  firstName: string,
  outcome:   ParentObservationOutcome,
  substrand: string
): string {
  switch (outcome) {
    case 'demonstrated':
      return (
        `Thank you! This tells us ${firstName} understands ${substrand} at home ` +
        `— we'll build on this strength.`
      )
    case 'struggled':
      return (
        `Thank you for letting us know. ${firstName}'s teacher has been notified. ` +
        `We'll adjust focus next week.`
      )
    case 'not_attempted':
      return (
        `No problem at all. This week's suggestion: Ask ${firstName} to show you ` +
        `one thing they learned at school. Any subject, 2 minutes.`
      )
  }
}

// ── Helpers ───────────────────────────────────────────────────────────────────

type InboundLogParams = {
  phone:        string
  rawBody:      string
  receivedAt:   string
  parsedReply:  ReplyOutcome
  studentId?:   string
  parentId?:    string
  processed:    boolean
  errorMessage?: string
}

async function logInbound(params: InboundLogParams): Promise<void> {
  await repos.notifications.insertWhatsAppInboundLog({
    phone:         params.phone,
    raw_body:      params.rawBody,
    received_at:   params.receivedAt,
    parsed_reply:  params.parsedReply,
    student_id:    params.studentId    ?? null,
    parent_id:     params.parentId     ?? null,
    processed:     params.processed,
    error_message: params.errorMessage ?? null,
  })
}

// Returns the ISO date string for the Monday of the current week.
// Used as `week_of` when no prior observation context is available.
function currentWeekOf(): string {
  const now      = new Date()
  const day      = now.getDay()                    // 0=Sun, 1=Mon...
  const diffToMon = (day === 0 ? -6 : 1 - day)    // Monday = start of week
  const monday   = new Date(now)
  monday.setDate(now.getDate() + diffToMon)
  monday.setHours(0, 0, 0, 0)
  return monday.toISOString().split('T')[0]
}
