// lib/core/identityTypes.ts
//
// EduNexus has two live learner identity spaces. This module makes the
// difference visible to the compiler so it cannot be crossed by accident.
//
// The two spaces (IDENTITY-1 Phase 0, 2026-08-14)
// ----------------------------------------------
//   LearnerId = `learners.id`
//     The canonical institutional record, created 2026-06-29 in
//     core_foundation.sql. `school_id NOT NULL`, admission number, NEMIS UPI,
//     institutional lifecycle (active/transferred/graduated/archived/deceased).
//     Owns learner_enrollments, learner_guardians, and 22 learner_* domains.
//
//   StudentId = `students.id`
//     The older consumer-origin identity (`added_by` defaults to 'parent',
//     carries parent contact and WhatsApp opt-in, has a nullable school). It
//     predates the migration history entirely. Still the identity that the
//     entire intelligence stack is built on: Evidence, Projection, Compass,
//     Career Intelligence and Academic Clinic all key on it.
//
// Do not read canonicity from the English words. `learners` is the newer and
// institutionally canonical table; `students` is the legacy one. The type names
// name DATABASE IDENTITY DOMAINS, not preferred UI vocabulary — the product may
// still say "Learner Progress Report" or "child" wherever that reads better.
//
// The trap this closes
// --------------------
// Three columns are NAMED for one space and CONTAIN the other:
//
//   learner_evidence.learner_id            → FK to students(id)
//   learner_projections.learner_id         → FK to students(id)
//   evidence_projection_events.learner_id  → FK to students(id)
//
// Those FKs are real and enforced, and the RLS over them correctly resolves
// through `students`, so Postgres already refuses a mismatched write. But
// nothing above the database refused it, so the failure surfaced as a foreign
// key error or a silently empty result rather than as a compile error. These
// brands move that rejection to compile time. The column names are NOT being
// changed — at the TypeScript layer their values are simply typed `StudentId`,
// which is what they actually are.
//
// Why brands and not classes or wrappers
// --------------------------------------
// `string & { readonly __brand }` is erased at runtime: a StudentId IS a string
// at execution, so it serializes, logs, compares and travels through Supabase
// query builders with zero behavioural change. Phase 1 changes no runtime
// behaviour anywhere, and this representation is why that is possible.
//
// The asymmetry is deliberate and is what keeps the blast radius small: a
// branded id is assignable TO a plain `string` parameter (it is a subtype), but
// a plain `string` is NOT assignable to a branded parameter. So every existing
// plain-string consumer keeps compiling untouched, and only the places that
// SUPPLY an identity into a hardened boundary have to say which space it came
// from. That is exactly the set of call sites worth auditing.

declare const LEARNER_ID_BRAND: unique symbol
declare const STUDENT_ID_BRAND: unique symbol

/** `learners.id` — the canonical institutional learner record. */
export type LearnerId = string & { readonly [LEARNER_ID_BRAND]: true }

/** `students.id` — the legacy consumer/intelligence identity. */
export type StudentId = string & { readonly [STUDENT_ID_BRAND]: true }

// ── Construction ─────────────────────────────────────────────────────────────
//
// These are the ONLY sanctioned way to enter a branded space, so that every
// crossing has a named, reviewable trust origin instead of a bare `as` cast
// scattered through the codebase.
//
// Legitimate trust origins, and nothing else:
//   1. A value read from the column itself (`learners.id`, `students.id`)
//   2. The output of a resolver in lib/core/identity.ts
//   3. A route parameter already validated as a UUID whose space is known from
//      the query that consumes it — never from the URL segment's wording
//
// A URL path containing "/student/" proves nothing: `/student/blueprint/[learnerId]`
// takes a Core `learners.id`. Follow the query, not the noun.

/**
 * Tag a value known to be a `learners.id`.
 *
 * Runtime behaviour: returns the input unchanged. This performs NO validation —
 * it is a compile-time assertion that the caller has already established the
 * value's origin. Use it at the point where that origin is visible, never to
 * silence an error further downstream.
 */
export function asLearnerId(id: string): LearnerId {
  return id as LearnerId
}

/**
 * Tag a value known to be a `students.id`.
 *
 * Same contract as {@link asLearnerId}: no validation, compile-time only, and
 * it belongs where the value's origin can actually be seen.
 */
export function asStudentId(id: string): StudentId {
  return id as StudentId
}

/** Nullable convenience for resolver returns, which are frequently `T | null`. */
export function asLearnerIdOrNull(id: string | null | undefined): LearnerId | null {
  return id == null ? null : asLearnerId(id)
}

export function asStudentIdOrNull(id: string | null | undefined): StudentId | null {
  return id == null ? null : asStudentId(id)
}

/**
 * An identity that may legitimately arrive from either space.
 *
 * Reserved for the small number of guardian/visibility checks that
 * deliberately accept both — `requireParent` is called with a `LearnerId` from
 * the Core guardian-invite flow and with a `StudentId` from the legacy parent
 * flow, and checks the caller against both link tables. That is existing,
 * intended behaviour, verified against its callers, and Phase 1 preserves it
 * exactly rather than narrowing it.
 *
 * This is NOT a general-purpose escape hatch. Using it anywhere the space is
 * actually known defeats the point of the brands — prefer the specific type,
 * and reach for this only where a function genuinely serves both.
 */
export type AnyLearnerIdentity = LearnerId | StudentId

/**
 * Membership test across an identity list, widening both sides to `string`.
 *
 * The guardian checks in `lib/core/permissions.ts` deliberately test one id
 * against BOTH a `StudentId[]` and a `LearnerId[]` — see {@link AnyLearnerIdentity}.
 * At runtime a branded id IS a string, so this is exactly the comparison that
 * already happened; the widening is confined here rather than repeated as an
 * inline cast at each call site.
 *
 * This deliberately does NOT prove the id belongs to that space — it answers
 * "is this exact value in this list", which is all the authorization checks
 * ask. It is not a substitute for typing a parameter correctly.
 */
export function identityIsIn(
  list: readonly (LearnerId | StudentId)[],
  id: AnyLearnerIdentity,
): boolean {
  return (list as readonly string[]).includes(id as string)
}

/**
 * A learner resolved in both spaces at once.
 *
 * `studentId` is nullable because a legitimately-enrolled Core learner may have
 * no legacy shadow row yet — a newly-admitted learner with no assessment
 * history is the common case, not an error. Every consumer degrades explicitly
 * on null rather than treating it as a failure.
 */
export type ResolvedIdentityPair = {
  learnerId: LearnerId
  studentId: StudentId | null
}
