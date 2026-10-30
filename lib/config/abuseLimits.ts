// lib/config/abuseLimits.ts
//
// The one place attempt-limiter thresholds live (lib/security/attemptLimiter.ts,
// backed by public.rate_limit_reserve). Each bucket name is part of the stored
// key — renaming one silently resets every counter in it.

const HOUR_MS = 60 * 60 * 1000

export const ATTEMPT_LIMITS = {
  /** Failed class-code joins per account (POST /api/student/join-class). Successful joins are refunded. */
  classJoinByCode: { bucket: 'class_join_code_failed', limit: 10, windowMs: HOUR_MS },
  /** Class-invite redemptions per account (POST /api/class/join). */
  classInviteJoin: { bucket: 'class_invite_join',      limit: 10, windowMs: HOUR_MS },
} as const satisfies Record<string, { bucket: string; limit: number; windowMs: number }>
