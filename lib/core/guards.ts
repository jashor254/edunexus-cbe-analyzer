/**
 * Shared invariant guards (RAS §10 Engineering Rules — "never duplicate these
 * again"). These are TypeScript assertion functions: services and permission
 * checks call them instead of writing `if (!x) throw new Error(...)` inline.
 * Each one throws the specific {@link EduNexusError} subclass that names what
 * was missing, so a caught error always tells you which identity failed to
 * resolve, not just that "something" was null.
 */
import type {
  CurrentUser,
  ResolvedSchool,
  ResolvedTeacher,
  ResolvedStudent,
  ResolvedParent,
} from '@/lib/core/identity'
import { UnauthorizedError, IdentityResolutionError, ResourceOwnershipError } from '@/lib/core/errors'

export function assertAuthenticated(user: CurrentUser | null): asserts user is CurrentUser {
  if (!user) throw new UnauthorizedError()
}

export function assertSchool(school: ResolvedSchool | null): asserts school is ResolvedSchool {
  if (!school) throw new IdentityResolutionError('School could not be resolved.')
}

export function assertTeacher(teacher: ResolvedTeacher | null): asserts teacher is ResolvedTeacher {
  if (!teacher) throw new IdentityResolutionError('This account has no teacher record.')
}

export function assertLearner(student: ResolvedStudent | null): asserts student is ResolvedStudent {
  if (!student) throw new IdentityResolutionError('This account has no learner record.')
}

/** Asserts the user is a parent of at least one learner — either guardian system counts. */
export function assertParent(parent: ResolvedParent): asserts parent is ResolvedParent {
  if (parent.studentIds.length === 0 && parent.coreLearnerIds.length === 0) {
    throw new ResourceOwnershipError('This account is not linked to any learner as a parent/guardian.')
  }
}
