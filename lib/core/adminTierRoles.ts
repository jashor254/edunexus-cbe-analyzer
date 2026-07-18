// The three Core SchoolUserRole values (types/core.ts) that carry
// admin-tier authority client-side — mirrors the exact set
// lib/repositories/teacher.repository.ts's isSchoolAdmin() checks
// server-side. Extracted here (Sprint 10E) so new admin-tier screens don't
// each redefine the same literal array.
export const ADMIN_TIER_ROLES: string[] = ['school_admin', 'headteacher', 'deputy_headteacher']
