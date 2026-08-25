# Phase 9.1.8 — Academic Clinic Client Career Parity

**Type:** Audit. No production behavior change beyond one documentation comment.
**Branch:** `main` · **HEAD at start:** `8a0ca5ddf8854c533aa7b8e82edce71c85eac995`

## 1. Verdict

```
PHASE 9.1.8 AUDIT COMPLETE — CLIENT SURFACE NOT LIVE
```

`app/academic-clinic/page.tsx` has **zero inbound navigation links anywhere in the app** — confirmed by an exhaustive search of every `Link`/`href`/`router.push` in `app/` and `components/`, including every sidebar/nav component (`TeacherSidebar.tsx`, `TeacherBottomNav.tsx`, `OrgSidebar.tsx`). It is reachable only by a user or developer typing the URL directly. Building the server-boundary refactor the mission describes for a page nobody can navigate to would be speculative engineering, exactly what the mission's own §2 instruction ("if not live, stop and classify accordingly") anticipates and heads off.

## 2. Client surface before — traced completely

- Fetches `students` (own account only, `user_id = auth.uid()`) and `assessments` directly from the browser via `createClient()` (RLS-scoped, not service-role — no service-role exposure risk exists here to begin with).
- Runs `buildSubjects()`/`resolveEffectiveScores()` (Junior/Senior score merging) client-side.
- Calls `generateReport()`/`generateSeniorGuidance()`/`generateJuniorGuidance()`/`calculateVitals()`/`generateActionPlan()` **directly in the browser** — because this is a plain client component with no `'use server'` boundary, the entire `lib/academicClinic/careerEngine.ts` module (all ~3000 lines, all 40 `CAREER_DATABASE` entries) ships as part of the client JS bundle for this route.
- PDF generation is server-mediated (`POST /api/academic-clinic/pdf`), but only renders the **already-generated** report object — it does not re-run matching.
- **No `dream_career` field is ever selected** (`'subject_scores, grade, created_at, term, year, source'`) — Dream Career analysis is structurally unreachable on this page regardless of any convergence work.
- **No DB writes anywhere in this file** — purely ephemeral React state, confirmed by grep (`.insert(`/`.upsert(`/`.update(` all absent).

## 3. Production reachability

**Dead as a discoverable destination, live as a URL.** Contrast with `app/dashboard/clinic/reports/[studentId]/page.tsx` (Phase 9.1.7's actual convergence target), which has four real, confirmed inbound links: `app/dashboard/assessments/add/page.tsx` (×2), `app/dashboard/assessments/history/page.tsx`, `app/dashboard/clinic/page.tsx`. That page is the genuinely live Academic Clinic report surface; this one is not its equivalent — Phase 9.1.7 already converged the surface that matters.

An older operational audit (`docs/architecture/sprint-10d-operational-activation-audit.md`) listed "Academic Clinic (legacy)" as nav-linked, citing both `app/dashboard/clinic/**` and `app/academic-clinic` in one combined table row. Direct, exhaustive re-verification this session found that claim true for the former and false for the latter — the audit bundled two routes into one row without separately confirming each. A related orphan was found alongside it: `components/ui/empty-states.tsx`'s `AcademicClinicReportEmptyState` component (a "Generate Clinic Report" CTA) takes an `onGenerate` callback with **zero callers anywhere in the app** — also unwired.

## 4. Server boundary chosen

**None built.** No new API route, server action, or client-facing endpoint was added. Building one for an unreachable page would itself be the kind of unrequested, unused infrastructure this project's standing practice explicitly avoids.

## 5. Matching architecture after

Unchanged from before this phase for this specific surface: client-side, `CAREER_DATABASE`-only, no canonical convergence. Every *other* Academic Clinic surface (the `assessmentPipeline.ts` auto-processing pipeline, `app/api/clinic/download/route.tsx`, `app/dashboard/clinic/reports/[studentId]/page.tsx`) already converged in Phases 9.1.6/9.1.7 and is untouched by this phase.

## 6–9. Career #44/#45, dream-career, historical-40, result-parity proofs

**Not performed.** All of these presuppose a server boundary that was not built, for the reason established in §1–§3. Building and testing infrastructure for a page with zero real users to prove parity for would not produce any real-world value — there is no live traffic for these proofs to protect.

## 10/11. Junior/Senior semantics, shortage/minimum-level policy

Unaffected — nothing about matching logic, subject normalization, or `kenyaShortageScore`/`minimumLevels` semantics was touched anywhere in this phase.

## 12–15. Result parity, authorization, performance, failure behavior

Not applicable — no new code path was created to evaluate any of these against.

## 16. Architecture guards

None added — there is no new boundary to guard. The existing Phase 9.1.6/9.1.7 guards (`careerConvergence.architecture.test.ts`, `pathwayParity.test.ts`, `dreamCareerConvergence.test.ts`) remain in force, unaffected, and still passing.

## 17. Tests

No new tests — nothing to regression-test in an unimplemented feature. Full existing standard suite re-run to confirm the one documentation-only edit caused no regression: **1057/1057 pass** (unchanged from Phase 9.1.7's count). `tsc --noEmit` clean. `eslint` clean. `next build` exit 0.

## 18. Files changed

- `app/academic-clinic/page.tsx` — one header comment added, documenting this phase's finding for future maintainers. No logic, imports, or behavior changed.
- `docs/architecture/phase9-1-8-academic-clinic-client-career-parity.md` (this file, new)

## 19. Database changes

```
NONE
```

## 20. Remaining `CAREER_DATABASE` role

```
LEGACY CAREER + CLINIC POLICY MIX
```
Unchanged from Phase 9.1.7's conclusion — this phase found no new evidence to revise it.

## 21. Named limitations (unchanged, restated for continuity)

Unsourced `kenyaShortageScore` · Clinic-specific `minimumLevels` vocabulary · athlete/sports-manager identity collision · no aliases · no semantic dedup · no provenance model · no web research · silent pathway fallback · prompt injection · taxonomy gap · slug identity fragility · telemetry observation window incomplete · **new, scoped to this phase**: `app/academic-clinic/page.tsx` and `components/ui/empty-states.tsx`'s `AcademicClinicReportEmptyState` are confirmed orphaned (zero inbound references) — flagged for a future product decision (reconnect or remove), not resolved here, since that decision belongs to a human, not an audit.

## 22. Discovery readiness

```
NO — Phase 9.1 observation gate remains in force.
```

## Recommendation for whoever picks this up next

Two small, low-risk, high-clarity follow-ups this audit surfaced but did not act on (out of scope for an audit phase, and each is a product/cleanup call, not an engineering one):
1. **Decide the fate of `app/academic-clinic/page.tsx`** — either link it into navigation (and *then* it would genuinely warrant this phase's originally-described server-boundary convergence work) or remove it as dead code. Left as-is here deliberately.
2. **Decide the fate of `AcademicClinicReportEmptyState`** in `components/ui/empty-states.tsx` — same choice, same reasoning.
