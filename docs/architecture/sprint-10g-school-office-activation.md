# Sprint 10G — School Office Activation

## Mission

Sprint 10E activated Core's operational workflows (Teachers, Admissions). Sprint 10F unified them into a single "School Operations" landing page. Sprint 10G activates that page as the permanent **Administrative Workspace** — the "School Office" — giving admin-tier users (`school_admin`, `headteacher`, `deputy_headteacher`) a real, gated entry point instead of landing on the generic teacher dashboard, and closes the last two workspace sections (School Profile, Academic Structure) the brief asked for.

No new educational logic was built. No new database tables, columns, or roles were introduced.

## Phase 1 — Architectural Validation (before any code)

Verified, read-first, against the actual code:

- `SchoolUserRole` (`types/core.ts:27`) already has exactly three admin-tier values: `school_admin`, `headteacher`, `deputy_headteacher`. No new role was needed or added.
- `requireSchoolAdmin()`/`requireSchoolStaff()` (`lib/core/permissions.ts`) already gate every admin-tier write path correctly — untouched by this sprint.
- `getUserRoles()` (`lib/auth/getRole.ts`) — the canonical role lookup used by `proxy.ts` and every layout — has **no knowledge of `school_users`/Core admin roles at all**; it only distinguishes `teacher | parent | student` from `profiles.role`/`teachers`. This is why no admin-tier user was ever routed anywhere but the generic teacher/parent dashboard. Confirmed this file's own doc comment deliberately avoids importing `lib/repositories` (20+ repositories) because it runs on every navigation through `proxy.ts` — any fix had to respect that constraint, not route around it.
- **Critical finding, caught before writing any code**: `app/teacher/core-readiness/page.tsx`'s own header comment already declared it to be "the one canonical landing page for every Core operational screen" (Sprint 10F). Building a new `app/teacher/core-office/` page as the brief's literal file path suggested would have created exactly the duplicate-dashboard outcome this sprint's own constraints forbid. Flagged to the user before writing code; user chose **rename in place** over building a second hub.
- `buildPrincipalDashboard()`/`getSchoolAcademicReadiness()` remain untouched — not read by this sprint's UI (the existing readiness aggregation already surfaced on the renamed page uses `/api/core/academic-readiness`, not `buildPrincipalDashboard`).

No new authority model was required. No ADR triggered — see Approval below.

## What changed

1. **Renamed** `app/teacher/core-readiness/page.tsx` → `app/teacher/core-office/page.tsx` (same component, same data, same gating). A redirect shim was left at the old path so any existing link/bookmark still resolves.
2. **Added two sections** to the (now core-office) page, reusing existing routes only:
   - **Academic Structure** — reads `GET /api/core/academic-years`, lists academic years and marks the current one. Closes the one Sprint 10D finding that had "no route at all" now getting a UI (well, its sibling academic-years listing did have a route; this just gives it a screen).
   - **School Profile** — reads `GET /api/core/school`, displays name, motto, type, curriculum, county, NEMIS code, contacts, address. No new schema, no new endpoint.
3. **Admin-tier landing routing**: added `getSchoolAdminMembership()` to `lib/auth/getRole.ts` — a direct `school_users` query (not routed through `lib/repositories`, to preserve the hot-path constraint above), reusing the existing `ADMIN_TIER_ROLES` constant (`lib/core/adminTierRoles.ts`) instead of a fourth copy of the three-role array.
   - `proxy.ts`: `/dashboard` now redirects admin-tier members to `/teacher/core-office` ahead of the existing plain-teacher redirect; `/teacher/core-office` specifically is additionally reachable by admin-tier members who have no teacher-role profile at all (e.g. a non-teaching headteacher), which every other `/teacher/*` route still does not allow — a deliberately narrow widening, scoped to one path.
   - `app/(auth)/login/page.tsx`: `resolveDestination()` now checks `/api/core/my-membership` (existing Sprint 10A route) before falling through to the profile-based teacher/parent resolution, and lands admin-tier users on `/teacher/core-office`.
   - `app/teacher/layout.tsx`: mirrors the same admin-tier allowance as defense-in-depth (matches this file's existing "second check, not a second source of truth" pattern) and renders the sidebar even for an admin-tier user with no `teachers` row.
4. **Navigation**: the "School Office" nav entry (renamed from "School Operations") is now admin-tier-gated — computed once in `app/teacher/layout.tsx` (server component, one `getSchoolAdminMembership` call) and passed down as a prop to `TeacherSidebar` → `TeacherBottomNav`, rather than each nav component doing its own client-side membership fetch (would have duplicated the existing `/api/core/my-membership` read pattern already used inside the page itself).
5. **Teacher workflow unchanged**: the plain-teacher branch of every redirect and every other `/teacher/*` route is untouched — teachers with no admin-tier membership see identical behavior to before this sprint.

## Reuse — nothing duplicated

Every number and every section on the School Office page comes from a route that already existed before this sprint: `/api/core/academic-readiness`, `/api/core/teachers`, `/api/core/school`, `/api/core/academic-years`, and `fetchClassTermStatuses()`. No new `lib/` business logic was written — `getSchoolAdminMembership()` is a query, not a decision; all admin-tier decisions still flow through `lib/core/permissions.ts`, untouched.

## Future placeholders (explicitly not implemented)

Promotion, Attendance, Departments, Guidance, Timetable, Finance — none of these were touched, per the brief's stop conditions. No screen, no route, no schema for any of them.

## Testing

- `lib/auth/getRole.test.ts` (new, 4 tests, integration-style against real synthetic rows on the live Supabase project): admin-tier membership resolves correctly; a teacher-tier member, a deactivated admin membership, and a non-member all correctly resolve to `null`.
- `lib/core/permissions.test.ts` (21 tests, pre-existing) re-run in full as a regression check — all passing, confirming `requireSchoolAdmin`/`requireSchoolStaff` and cross-school isolation are unaffected.
- `npx tsc --noEmit` — clean.
- `npx eslint` on every changed file — zero new warnings/errors (two pre-existing `TeacherBottomNav.tsx` warnings, unrelated lines, unchanged by this sprint).

## Phase 8 — re-audit

- No orphaned route: the old `/teacher/core-readiness` URL still resolves (redirect), nothing links to it as a dead end.
- No duplicate nav entries: exactly one "School Office" entry per nav component, admin-tier-gated.
- No duplicate hub page: the rename means there is exactly one operational landing page, not two.
- No duplicate authorization: `getSchoolAdminMembership()` is a read-only query used only for routing/nav-visibility decisions; every actual permission decision still runs through the untouched `lib/core/permissions.ts`.
- No duplicate role array introduced: the login page and `getRole.ts` both import the existing `ADMIN_TIER_ROLES` constant rather than redefining it.

## Approval

**✅ Safe to implement, as executed.** No canonical identity changed, no new write path, no new role, no schema change, no Constitution/RAS conflict. The one architectural risk this sprint's Phase 1 caught (a second hub page) was resolved by renaming in place rather than duplicating, per explicit user decision — no ADR needed.

## Technical debt discovered (not fixed here — out of scope)

- The three-role admin-tier array now exists as: `lib/repositories/teacher.repository.ts`'s `isSchoolAdmin()`, `lib/core/permissions.ts`'s `SCHOOL_ADMIN_ROLES`, and `lib/core/adminTierRoles.ts`'s `ADMIN_TIER_ROLES` (values identical, not contradictory) — a future sprint could consolidate to one source, not done here to avoid touching working, tested code outside this sprint's scope.
- RAS §3 still describes `lib/core/permissions.ts` as "reserved, not yet built" — stale, should be updated in a documentation-only pass.
