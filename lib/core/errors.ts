/**
 * Canonical error hierarchy for the Operating Layer (RAS §8).
 *
 * Every identity/permission failure across the platform throws one of these,
 * never a bare `Error` or an inline `NextResponse.json({ error: ... }, { status })`.
 * A route's job is to catch one of these and map `.status`/`.code` onto the
 * HTTP response — never to decide the status code itself.
 *
 * `UnauthorizedError` (401) means "we don't know who you are."
 * Every other error here means "we know who you are, and the answer is no" (403),
 * except `IdentityResolutionError`, which means "we know you're authenticated,
 * but the institutional record we need doesn't exist" (404) — a different failure
 * mode from authorization, and one worth distinguishing so a route can tell a
 * student-portal user "your account isn't linked to a student record yet"
 * instead of a generic "forbidden."
 */

export abstract class EduNexusError extends Error {
  abstract readonly code: string
  abstract readonly statusCode: number

  constructor(message: string) {
    super(message)
    this.name = this.constructor.name
  }
}

/** No authenticated user could be resolved (`auth.getUser()` returned null). */
export class UnauthorizedError extends EduNexusError {
  readonly code = 'UNAUTHORIZED'
  readonly statusCode = 401

  constructor(message = 'Authentication required.') {
    super(message)
  }
}

/**
 * Base class for every "you are authenticated, but not allowed to do this"
 * failure. Prefer one of the specific subclasses below over throwing this
 * directly — the subclass tells a caller *why*, which matters for both
 * error-page copy and for debugging authorization gaps like the ones found
 * in the Stage 0 census (a route that should have rejected a request but
 * didn't is much easier to catch in review when the code says
 * `throw new PermissionDeniedError(...)` instead of a bare 403).
 */
export class ForbiddenError extends EduNexusError {
  readonly code: string = 'FORBIDDEN'
  readonly statusCode = 403

  constructor(message = 'You do not have permission to perform this action.') {
    super(message)
  }
}

/** The resource belongs to a different school than the acting user's context. */
export class SchoolMismatchError extends ForbiddenError {
  readonly code = 'SCHOOL_MISMATCH'

  constructor(message = 'This resource belongs to a different school.') {
    super(message)
  }
}

/** The user has no active `school_users` membership for the school in question. */
export class MembershipRequiredError extends ForbiddenError {
  readonly code = 'MEMBERSHIP_REQUIRED'

  constructor(message = 'You are not a member of this school.') {
    super(message)
  }
}

/** The user has membership, but their role does not grant the requested capability. */
export class PermissionDeniedError extends ForbiddenError {
  readonly code = 'PERMISSION_DENIED'

  constructor(message = 'Your role does not permit this action.') {
    super(message)
  }
}

/** The user is not the owner/actor-of-record for this specific resource (e.g. not this class's teacher, not this learner's guardian). */
export class ResourceOwnershipError extends ForbiddenError {
  readonly code = 'RESOURCE_OWNERSHIP'

  constructor(message = 'You are not the owner of this resource.') {
    super(message)
  }
}

/**
 * The user is authenticated, but the institutional identity we needed
 * (a teacher row, a student row, a school) does not exist or could not be
 * found. Distinct from authorization failures: this means "we don't know
 * who you are institutionally," not "we know, and the answer is no."
 */
export class IdentityResolutionError extends EduNexusError {
  readonly code = 'IDENTITY_RESOLUTION_FAILED'
  readonly statusCode = 404

  constructor(message = 'Could not resolve the required identity.') {
    super(message)
  }
}

/** True for any error this module defines — useful for a single catch-and-map in a route. */
export function isEduNexusError(err: unknown): err is EduNexusError {
  return err instanceof EduNexusError
}
