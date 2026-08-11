// lib/compass/deliveryBinding.ts
//
// Phase 2.6 / G-08 — binds a teacher-delivered Compass intervention to the
// exact Compass session that consumed it.
//
// The question this exists to answer is:
//
//     "Which Compass session consumed this teacher intervention?"
//
// Before this, nothing could. `blueprint_compass_deliveries.status` was
// always `available` and `compass_session_id` was always null, so the
// closest available answer was "any session this learner had in this
// subject" — which answers "did Mary do Maths Compass", not "did Mary do
// the intervention I sent her".
//
// ── DURABLE vs EPHEMERAL ───────────────────────────────────────────────────
//   `compass_bridge`                  ephemeral handoff — queued teacher
//                                     intent, cleared once consumed
//   `blueprint_compass_deliveries`    durable provenance ledger — survives
//
// The bridge carries only a `deliveryId` REFERENCE. It is never the
// historical source of truth, which is why clearing it (after the first
// message, as Compass has always done) cannot make an intervention
// untraceable: by then the delivery row itself holds the session id.
//
// ── NO HEURISTIC BINDING ───────────────────────────────────────────────────
// A session binds only to a delivery the bridge explicitly names. There is
// no "newest available delivery", no "same-subject delivery discovered by
// search", no inference from the mere presence of a teacher suggestion. A
// learner-directed session stays learner-directed.

import { repos } from '@/lib/repositories'
import { resolveLegacyStudentId } from '@/lib/core/identity'
import { normalizeSubjectKey } from '@/lib/pathwayCalculator'
import type { BlueprintCompassDeliveryRow } from '@/lib/repositories/blueprintCompassDelivery.repository'

/** Why a session did or did not claim a delivery — returned for tests and debugging, never surfaced to a learner. */
export type DeliveryBindOutcome =
  | { bound: true; delivery: BlueprintCompassDeliveryRow }
  | { bound: false; reason:
      | 'no_teacher_direction'      // bridge has no live teacher suggestion
      | 'no_delivery_id'            // teacher intent predates Phase 2.6, or was set by the plain topic route
      | 'delivery_not_found'
      | 'not_available'             // already started/completed, or claimed concurrently
      | 'learner_mismatch'
      | 'subject_mismatch'
    }

/**
 * Attempts to bind the delivery named by this learner's Compass bridge to a
 * real, already-created Compass session.
 *
 * Every condition in Phase 2.6 §6 must hold; any failure simply means "this
 * session is not the one that consumed a teacher intervention", which is a
 * completely normal state (an open, learner-directed session) and never an
 * error. Learner-directed Compass is never blocked by a failed bind.
 *
 * Safe to call on every session start: the claim itself is an atomic
 * conditional update in the repository, so a repeated first message, a
 * browser retry, two tabs, or a resumed session all converge on one binding.
 *
 * @param learnerId  legacy `students.id` — the space Compass sessions live in
 * @param sessionId  a Compass session that already exists
 * @param subject    the subject the session is ACTUALLY about
 */
export async function bindDeliveryToSession(
  learnerId: string,
  sessionId: string,
  subject: string,
  bridge: Record<string, unknown>,
): Promise<DeliveryBindOutcome> {
  // 1 + 2. Explicit teacher direction naming an explicit delivery.
  if (bridge.teacherSuggested !== true) return { bound: false, reason: 'no_teacher_direction' }
  const deliveryId = typeof bridge.deliveryId === 'string' ? bridge.deliveryId : null
  if (!deliveryId) return { bound: false, reason: 'no_delivery_id' }

  // If this session already owns the delivery, we are resuming — do not
  // re-bind, do not reset status, do not touch provenance.
  const existing = await repos.blueprintCompassDeliveries.findByCompassSessionId(sessionId)
  if (existing && existing.id === deliveryId) return { bound: true, delivery: existing }

  // 3. The delivery must really exist.
  const delivery = await repos.blueprintCompassDeliveries.findById(deliveryId)
  if (!delivery) return { bound: false, reason: 'delivery_not_found' }

  // 4. Only an unconsumed delivery may be claimed. (Re-checked atomically
  // below — this is the early, cheap read, not the guarantee.)
  if (delivery.status !== 'available' || delivery.compass_session_id !== null) {
    return { bound: false, reason: 'not_available' }
  }

  // 5. Learner identity. The delivery is keyed on Core `learners.id`; a
  // Compass session is keyed on legacy `students.id`. They are reconciled
  // through the one existing bridge (`students.external_id`) — never assumed
  // equal, and never matched by name or recency.
  const deliveryLegacyLearnerId = await resolveLegacyStudentId(delivery.learner_id)
  if (deliveryLegacyLearnerId !== learnerId) return { bound: false, reason: 'learner_mismatch' }

  // 6. Subject must match the session's ACTUAL subject, using the same
  // canonical normalization the rest of Compass uses. A teacher's Maths
  // objective must never be consumed by a Kiswahili session the learner
  // opened for themselves.
  if (normalizeSubjectKey(delivery.subject) !== normalizeSubjectKey(subject)) {
    return { bound: false, reason: 'subject_mismatch' }
  }

  // 7 + 8. The atomic claim. `available -> started` happens at most once;
  // a concurrent caller gets null rather than overwriting the winner.
  const claimed = await repos.blueprintCompassDeliveries.claimAvailable(deliveryId, sessionId)
  if (!claimed) return { bound: false, reason: 'not_available' }

  return { bound: true, delivery: claimed }
}

/**
 * Marks the delivery this session consumed as `completed` — "the learner
 * finished the Compass session associated with this intervention".
 *
 * COMPLETION IS NOT MASTERY. It says a session ended, nothing more. Whether
 * the learner actually learned anything remains an Evidence Domain
 * judgement: the session's mastery claim is still tier-1 `pending_review`
 * until a teacher confirms it, and whether the intervention *worked* remains
 * a separate Blueprint action review. Those three lifecycles stay separate
 * on purpose.
 *
 * Matched on the exact bound session id, never on learner + subject +
 * recency. Returns null when this session does not own a started delivery,
 * which makes a repeated end call a harmless no-op.
 */
export async function completeDeliveryForSession(sessionId: string): Promise<BlueprintCompassDeliveryRow | null> {
  const delivery = await repos.blueprintCompassDeliveries.findByCompassSessionId(sessionId)
  if (!delivery) return null
  return repos.blueprintCompassDeliveries.completeForSession(delivery.id, sessionId)
}
