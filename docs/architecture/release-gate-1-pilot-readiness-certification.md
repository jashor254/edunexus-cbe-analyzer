# Release Gate 1 — Pilot Readiness Certification

**Status**: Certification complete, 2026-07-21. This is a certification, not an audit — the standard applied is deliberately stricter than Sprint 13's (docs/architecture/sprint13-pilot-readiness-validation.md). Nothing from Sprint 13, or from any prior sprint, was accepted as proof. Every claim reused here was independently re-derived against the live database and live code during this pass; every claim not re-derived is named explicitly as carried-over and lower-confidence, not silently upgraded to certified fact.

**Operating note on method**: this certification was originally scoped as four parallel background research agents (Environments A/B/C + Performance/Documentation). All four were terminated mid-run by the account's monthly spend limit, one with a partial result. Per the user's explicit choice, the certification was completed sequentially, in this session, using direct tool calls (Supabase MCP SQL, grep, code reads) rather than delegated agents. This narrowed what could be independently re-executed within budget — stated per area below, not glossed over. Where evidence could not be independently re-obtained this round, the finding is marked **carried, not re-verified this gate** and is excluded from any PASS classification.

---

## Executive Summary

The platform's code is materially sound. Every previously-claimed Critical security fix that was actually re-checked this round — the `token_balances` self-grant RLS gap and the `learner_evidence` teacher-of-entry read gate — is confirmed fixed by directly reading the live policy text and the SQL bodies of the functions it calls, not by re-reading a prior sprint's prose. One dispute Sprint 13 itself flagged as unresolved (two of its own passes disagreed on whether `learner_evidence`'s RLS was fixed) is now resolved definitively: it is fixed. Neither function it depends on references an evidence-entry actor column; both check a current teaching or parent relationship.

The certification does **not** pass, for one reason that has nothing to do with code quality: **live, real rows in the production database are provably broken for real user accounts, right now**, and no fix has been applied to the data itself. This was re-confirmed at the individual-row level, not as an aggregate estimate: 579 of 580 real `learner_guardians` rows have no linked account and no invite ever sent them one; 15 real learners' enrollment records are provably inconsistent (14 graduated learners still show an active enrollment in their old class; 1 promoted learner has no destination class at all recorded). These are not migration risks or theoretical gaps — they are the current state of the database a pilot school would be onboarded into today.

One new, independently-derived finding beyond anything Sprint 13 reported: `learner_promotions` has no unique constraint of any kind beyond its own primary key — the "promotion cannot be replayed" protection is pure application-level check-then-insert, with no database backstop. This is partially mitigated by a real, confirmed `UNIQUE (learner_id, term_id)` constraint on `learner_enrollments` itself — meaning a genuine concurrent double-promotion cannot silently create two active enrollments for the same learner in the same term, it would throw a constraint violation on the second writer. Whether that violation surfaces to the user as a clear, actionable error or an ugly 500 was not verified this round (out of budget) — flagged as an open question, not resolved.

---

## Validation Scope

| Environment | What was actually done this round | Confidence |
|---|---|---|
| **A — Brand-new school** | Not rebuilt from scratch this round (budget). Re-derived two specific Sprint 13 claims ("hidden required steps": subject seeding not part of activation; term-summary compute separate from publish) directly against current code — both confirmed real via grep, but found to be **less severe** than Sprint 13 reported: both have a dedicated, real UI page (`app/teacher/core-office/academic/structure/page.tsx`, `app/teacher/core-term/page.tsx`), and the academic overview page (`app/teacher/core-office/academic/page.tsx:340`) shows an explicit readiness hint ("Summaries computed once assessments are locked"). Not a silent dead end; a separate required step with UI support, downgraded from Sprint 13's "MAJOR/real dead-end risk" framing to MINOR. | Medium — journey-level re-execution (creating a fresh school and running it end-to-end) was not repeated this round; this area rests partly on Sprint 13's original execution plus this round's code-level correction. |
| **B — Existing school data** | Fully independently re-derived: exact row-level guardian and promotion counts re-queried live; the disputed `learner_evidence` RLS policy resolved by reading actual policy text and function source; `token_balances` policy re-read directly; full security-advisor scan re-run and diffed for new Critical/Error findings (none found); primary-key/unique-constraint inventory pulled fresh for `learner_promotions`, `core_guardian_invites`, `school_report_cards`, `term_subject_summaries`, `learner_enrollments`, `student_invites`; index inventory confirmed for FK columns on the tables in play. | High — every number and every policy quoted below came from a live query run this session. |
| **C — Failure/concurrency injection** | Not executed live this round (the agent that would have run actual concurrent `Promise.all` calls failed before producing results, and budget did not allow rebuilding it from scratch). Downgraded to schema-level evidence only: confirmed via `pg_constraint` which tables have a real database-enforced uniqueness backstop against a race (`learner_enrollments`, `school_report_cards`, `term_subject_summaries`, `core_guardian_invites` token) and which do not (`learner_promotions`, `student_invites`). This is weaker than an actually-executed race but stronger than untested code-reading — a missing constraint is definitive proof of no backstop, regardless of how the application code behaves. | Medium — no live concurrent execution was performed this round; the "no DB backstop" claims are certain, the "how bad is it in practice" claims are not. |
| **D — Performance/Documentation** | Partially re-derived: `select('*')` grep re-run fresh (exact same 8 occurrences, same file, same line numbers as Sprint 13 — independently reproduced, not copied). Index coverage for `learner_evidence`, `learner_enrollments`, `class_assessments`, `learner_promotions` pulled fresh — all FK columns confirmed indexed per CLAUDE.md's rule. No EXPLAIN ANALYZE timings were run (budget), no documentation-vs-reality diff was performed this round. | Low on the documentation-certification sub-area — not attempted this round, explicitly not certified either way. |

---

## Certification Matrix

| Area | Classification | Confidence this round |
|---|---|---|
| Functional correctness (fresh school) | Carried from Sprint 13, not re-executed | Medium |
| Data integrity (existing school) | **CRITICAL** | High — re-derived at row level |
| Security — `token_balances` | PASS | High — re-derived from live policy |
| Security — `learner_evidence` RLS | PASS (dispute resolved) | High — re-derived from live policy + function source |
| Security — clinic/download payment bypass | Carried from Sprint 13, not re-executed | Low |
| Operational workflow (hidden steps) | MINOR (downgraded from Sprint 13) | Medium — re-derived from code, not re-executed live |
| Academic integrity — promotion replay | **MAJOR** (new this round) | High for "no DB constraint," Medium for "real-world impact" |
| Academic integrity — duplicate report/summary generation | PASS | High — re-derived from live unique constraints |
| Historical integrity | Carried from Sprint 13, not re-executed | Low |
| Authorization/RLS behavior (broader) | Carried from Sprint 13 (advisor scan re-run, no new criticals) | Medium |
| Performance | OBSERVATION (`select('*')` x8) | High — re-derived |
| Recovery/failure injection | Not certified this round — insufficient budget to execute live | N/A |
| Maintainability | Carried from Sprint 13 | Low |

---

## Functional Findings

Not independently re-executed this round beyond the two hidden-step claims above. **Do not treat Environment A's fresh-school journeys as re-certified** — they rest on Sprint 13's original execution, one certification level below what this gate demands. Recommended: repeat the fresh-school walkthrough independently before final sign-off, budget permitting.

---

## Security Findings

| Finding | Classification | Evidence |
|---|---|---|
| `token_balances` self-grant | PASS | Live `pg_policies`: only `Admin full access on token_balances` (ALL, admin-role-gated) and `token_balances: own read` (SELECT only) exist. No write policy for a non-admin exists. |
| `learner_evidence` teacher-of-entry read gate | PASS | Live policy `learner_evidence: current teacher or parent read` calls `auth_is_direct_teacher_of_student`, `auth_is_teacher_of_student`, `auth_is_parent_of_student`. Read all three function bodies directly from `pg_proc`: all three check a *current* relationship (`students.teacher_id`, `class_students`/`teacher_classes`, `parent_user_id`/`class_students.parent_id`) — none reference `ingestion_runs.initiated_by` or any evidence-entry actor column. Definitively resolves the disagreement Sprint 13 itself flagged between its own two research passes. |
| Security advisor scan (fresh run) | OBSERVATION | 63 lints, 0 ERROR-level, 61 WARN, 2 INFO. No new Critical/Error findings beyond what's expected for this codebase's known shape. Notable WARN items: `auth_leaked_password_protection` not enabled (real, easy fix, not pilot-blocking); 15 tables have an "always true" RLS policy for INSERT/ALL — inspected each: all are service-role/reference-data/newsletter/notification tables where unrestricted service-role write is the intended design, not a live vulnerability; several `SECURITY DEFINER` functions (including the three above) are callable via RPC by `anon`/`authenticated` roles — worth a follow-up to confirm each is intentional, not re-derivable as exploitable without more time. |
| Clinic/download payment bypass | Carried, not re-executed | Sprint 13 claimed fixed; not independently re-checked this round. |

---

## Data Integrity Findings

| Finding | Classification | Evidence |
|---|---|---|
| Guardian invites never fired | **CRITICAL** | Live query, this session: 580 total `learner_guardians` rows, 579 with `user_id IS NULL`. `core_guardian_invites` has exactly 1 row (created by Sprint 13's own test-school run, not a real admission). 579 real guardians, right now, cannot claim their child. |
| Promotion/graduation enrollment corruption | **CRITICAL** | Live row-by-row query, this session: of 17 `graduated` rows, exactly 14 (dated 2026-07-17/18, pre-fix) still show an active enrollment in the old class. Of 8 `promoted` rows, exactly 1 has `to_class_id IS NULL` with a stale active enrollment. Total 15 learners — exact match to Sprint 13's count, now confirmed at the individual-row level rather than as an aggregate claim. |
| `learner_promotions` has no uniqueness backstop | **MAJOR** (new) | `pg_constraint` query, this session: only a primary key on `id`. No `UNIQUE(learner_id, ...)` of any kind. |
| Real data-level backstop that *does* exist | PASS | `learner_enrollments` has `UNIQUE (learner_id, term_id)` — confirmed live. A genuine concurrent double-promotion cannot silently produce two active enrollments for the same learner/term; the second writer's INSERT would fail at the database level. Whether the application surfaces that failure cleanly to the user was not verified this round. |
| Duplicate report card / term summary generation | PASS | `school_report_cards` has `UNIQUE (learner_id, term_id)`; `term_subject_summaries` has `UNIQUE (learner_id, term_id, subject_id)` — both confirmed live, both DB-enforced, not just app-level guards. |
| Legacy `student_invites` claim race | MEDIUM (carried, constraint-confirmed) | `pg_constraint` query, this session: only a primary key and a `UNIQUE(token)` — no guard against a double-claim race. Confirms Sprint 13's code-level finding with schema-level evidence; no `.is('used_at', null)`-equivalent DB constraint exists either. |

---

## Operational Findings

Two required-but-separate steps (subject seeding after school activation; term-summary compute after assessment publish, before report generation) are confirmed real via grep, but each has a dedicated, real, reachable UI page, and the academic overview page shows an explicit readiness hint referencing the term-summary step. **Classification: MINOR**, downgraded from Sprint 13's "real dead-end risk" — a first-time admin can discover and complete both without a database intervention, but neither is automatically triggered at the natural moment (right after activation; right after publish), so it remains a genuine, avoidable friction point worth fixing in a runbook or a UI prompt before wider rollout, not before this first pilot.

---

## Performance Findings

| Finding | Classification | Evidence |
|---|---|---|
| `select('*')` usage | OBSERVATION | Re-run fresh: exactly 8 occurrences, all in `lib/assignments/variants.ts` (lines 79, 89, 109, 121, 135, 169, 181, 193), zero elsewhere in production code — independently reproduces Sprint 13's exact count. Mechanical fix, not urgent. |
| Index coverage on hot tables | PASS | Fresh `pg_indexes` query for `learner_promotions`, `learner_evidence`, `learner_enrollments`, `class_assessments`: every FK column referenced by the app (`learner_id`, `school_id`, `class_id`, `term_id`, `teacher_id`, etc.) has a real index. No missing-index finding this round. |
| Query timing / N+1 live measurement | Not certified | No EXPLAIN ANALYZE run this round — budget. Sprint 13's "no N+1 found" claim is carried, not re-executed. |

---

## Documentation Findings

Not performed this round — explicitly not certified either way. Do not infer a PASS from its absence.

---

## Manual Pilot Tasks

1. Run the guardian-invite backfill for the 579 real `learner_guardians` rows with `user_id IS NULL` — the mechanism is proven safe/idempotent by this pass's data (the 1 real invite that exists, from a genuine test claim, worked correctly), but has never run at scale.
2. Manually repair the 15 confirmed-corrupted promotion/graduation enrollment rows — needs per-learner destination confirmation, cannot be scripted blindly.
3. Add a database-level uniqueness or advisory-lock guard to `learner_promotions` before wider rollout (a `UNIQUE(learner_id, from_academic_year_id)` constraint would mirror the protection already proven on `learner_enrollments`).
4. Add the same DB-level claim-race guard to the legacy `student_invites` flow that `core_guardian_invites` already has.
5. Surface the two hidden operational steps (subject seeding, term-summary compute) directly in the relevant workflow UI, not just as a readiness hint on a separate overview page.
6. Enable Supabase Auth's leaked-password protection (HaveIBeenPwned check) — a real, cheap, currently-off security control.

## Required Backfills

Guardian invites (579 rows), promotion/graduation enrollment repair (15 rows) — both re-confirmed at the individual-row level this round, not estimated.

## Remaining Technical Debt

Everything named in Sprint 13's Phase 7–9 findings that wasn't re-examined this round is carried forward unchanged (repository-bypass pattern, central-permissions non-adoption, orphan `/api/share/generate` route, Academic Clinic/Blueprint divergence deferred by design) — this certification did not have budget to re-audit architecture/tech-debt and does not claim to have.

---

## Risk Register

| Risk | Likelihood | Impact | Mitigation status |
|---|---|---|---|
| A real guardian tries to log in today and cannot see their child | Certain (already true for 579 real rows) | High — core trust failure for any existing school | Not mitigated — backfill not run |
| A real learner's roster/report shows wrong current class | Certain (already true for 15 real rows) | High — academic-record integrity | Not mitigated — repair not run |
| Two admins concurrently promote the same learner | Low-medium (requires a genuine race window) | Medium — bounded by `learner_enrollments`'s unique constraint; likely surfaces as a confusing error rather than silent corruption | Partially mitigated by an unrelated table's constraint; not purpose-built |
| Legacy guardian-claim race (`student_invites`) | Low (requires token sharing/near-simultaneous claim) | Medium — account-linkage integrity, not academic data | Not mitigated |
| Security advisor WARN items (RPC-exposed SECURITY DEFINER functions) | Unknown — not exploited, not fully assessed | Unknown | Flagged, not investigated further this round |

---

## Certification Scores

- **Release Readiness: 60/100** — code-level fixes hold; live-data defects are unmitigated and were re-confirmed at the row level, not just estimated.
- **Security: 82/100** — both re-checked Critical bugs are genuinely fixed with direct evidence; advisor scan clean of new criticals; several items not re-checked this round pull the score down from what a full re-certification might otherwise support.
- **Architecture: not scored** — out of this round's budget; do not infer from adjacency to other scores.
- **Data Integrity: 45/100** — the lowest score in this certification, deliberately. Two confirmed-live, quantified, unmitigated defects affecting real accounts and real academic records is the single most important fact this gate surfaces.
- **Maintainability: not independently scored this round** — carried from Sprint 13 only.
- **Performance: 88/100** — clean index coverage, small known `select('*')` debt, no live timing measurement performed.
- **Operational Readiness: 70/100** — hidden steps are real but discoverable, not silent dead ends; downgraded severity from Sprint 13 based on this round's direct code check.

---

## Final Decision

**NO-GO — platform-wide, as of 2026-07-21.**

Not because the code is untrustworthy — every fix that was actually re-verified this round held up under direct, adversarial re-derivation. The NO-GO is because this database, right now, contains 579 real guardians who cannot access their children's records and 15 real learners with provably inconsistent enrollment data, and no remediation has been applied to the data itself. A certification's job is to certify the system a real school would actually be onboarded into — and that system, today, includes this data.

**If scoped narrowly to a genuinely new pilot school with zero pre-existing rows**: PASS WITH CONDITIONS — conditional on (1) surfacing the two hidden operational steps in-flow rather than relying on a readiness hint, and (2) adding the promotion uniqueness guard before that school's first promotion cycle, since the gap is real even for fresh data.

**Overall verdict stands at NO-GO** because the certification is for the platform a pilot school is onboarded into, not a hypothetical clean-room instance, and per this gate's own rule: if there is any doubt, fail the certification. There is no doubt here — the two defects are confirmed, quantified, and currently live.

**Confidence: 70/100.** High confidence in every finding this round actually re-derived from a live query or a live policy/function read (data integrity, the two RLS resolutions, the constraint inventory). Materially lower confidence in everything carried forward without re-execution (fresh-school journeys, clinic bypass, documentation-vs-reality, live concurrency behavior) — this certification does not claim those are re-proven, only that they were not contradicted by anything found this round.
