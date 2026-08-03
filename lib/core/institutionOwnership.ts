/**
 * Phase 0 — Institution Ownership Enforcement (RAS §3 Permissions domain).
 *
 * The single reusable resolver for "which school owns this teacher's new
 * institutional writes." Every institutional Class/Learner-creation route
 * must call {@link resolveOwningSchool} instead of inventing its own
 * ownership logic — this module exists so that decision is never
 * re-implemented per route (same rationale as `lib/core/permissions.ts`'s
 * header: one function per decision, not a copy-pasted check per action).
 *
 * Scope: this resolves ownership for *new* writes only. It does not
 * backfill historical `teacher_classes`/`students` rows (still `school_id
 * = NULL` until the separate, later historical-migration sprint), does not
 * repoint any foreign key, and does not retire or drop any table.
 *
 * Resolution order:
 *  1. An existing active `school_users` membership for this user — the
 *     deterministic, already-canonical answer. Reuses
 *     `repos.schools.findSchoolUserByUserId`, the same lookup
 *     `lib/core/school.ts::ensureSchoolMembership` already uses, so this
 *     never re-implements that query.
 *  2. No separate pending/accepted email-token invitation path exists for
 *     schools today (`lib/core/teacherOnboarding.ts` uses
 *     `school_users.is_active` itself as the pending/accepted state
 *     machine, not a separate invitation table) — so an accepted
 *     invitation already surfaces as an active `school_users` row and is
 *     covered by step 1. See this module's implementation report,
 *     "Contradictions found," for why no separate step exists here.
 *  3. Deliberately does NOT call `lib/core/school.ts::ensureSchoolMembership`
 *     (fuzzy, case/whitespace-insensitive school-*name* matching against
 *     the free-text name a teacher typed at signup). That mechanism
 *     auto-attaches by name similarity, which this resolver's contract
 *     explicitly forbids (never infer institution ownership from fuzzy
 *     text matching). If `ensureSchoolMembership` already ran elsewhere
 *     (`app/api/teacher/profile`) and found a real match, its result is
 *     already a real `school_users` row and step 1 picks it up for free —
 *     no duplication, no reliance on fuzzy matching inside this resolver.
 *  4. No safe deterministic relationship found — atomically provision one
 *     new school via the `provision_teacher_school` Postgres function
 *     (transaction-scoped advisory lock keyed on the user id; see that
 *     function's own header comment for the concurrency guarantee). Never
 *     returns null/undefined: a school always exists after this call
 *     succeeds. An RPC failure is a genuine infrastructure error, not an
 *     ownership-ambiguity case — it is the only way this function throws.
 *
 * Why auto-provisioning here is safe (unlike backfilling historical rows,
 * where two colleagues may already have separate accounts describing the
 * same real school): this only fires on a teacher's first institutional
 * write. There is no pre-existing sibling data yet to reconcile against —
 * the duplicate-school detection/merge problem stays correctly scoped to
 * the later historical-migration sprint, not this one.
 */
import { createServiceClient } from '@/utils/supabase/service'
import { repos } from '@/lib/repositories'
import { IdentityResolutionError } from '@/lib/core/errors'
import type { School } from '@/types/core'

export type OwningSchoolResolution = {
  schoolId: string
  /** True only when this call itself provisioned a brand-new school (not "was a school created at some earlier point"). */
  created: boolean
}

/**
 * Resolves (or, on a teacher's genuine first institutional write,
 * atomically provisions) the school that owns this user's new
 * institutional writes. Never returns a null/undefined `schoolId`.
 *
 * @param userId Authenticated user id (from `requireAuthentication`).
 * @param provisionalNameHint A display name to use only if a new school
 *   must be provisioned (e.g. "{teacher full name}'s School (pending
 *   setup)") — never derived from any free-text field that could match an
 *   existing school by name; naming a genuinely new school is not the same
 *   operation as matching an existing one, and this resolver must never do
 *   the latter (see step 3 above).
 */
export async function resolveOwningSchool(
  userId: string,
  provisionalNameHint: string
): Promise<OwningSchoolResolution> {
  const existing = await repos.schools.findSchoolUserByUserId(userId)
  if (existing) {
    return { schoolId: existing.school_id, created: false }
  }

  const db = createServiceClient()
  const { data, error } = await db.rpc('provision_teacher_school', {
    p_user_id: userId,
    p_school_name: provisionalNameHint,
  })

  if (error || !data) {
    throw new IdentityResolutionError(
      `resolveOwningSchool: could not resolve or provision an owning school — ${error?.message ?? 'no data returned'}`
    )
  }

  const school = data as School
  // created:true only means "this exact call's RPC invocation ran the
  // INSERT branch" is not observable from the return value alone (the
  // function returns the same shape either way) — callers that need to
  // distinguish "just created" from "already existed" should compare
  // school.provisioning_source, the durable signal, rather than trust a
  // return flag this function can't honestly compute without a second
  // round trip. Exposed here as best-effort based on that field.
  return { schoolId: school.id, created: school.provisioning_source === 'teacher_first_write_auto_provision' }
}
