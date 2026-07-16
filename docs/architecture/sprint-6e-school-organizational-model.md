# Sprint 6E — School Organizational Operating Model Audit

**Mode: READ ONLY.** No code, schema, migration, route, repository, service, or test was modified. Every claim is marked VERIFIED (confirmed by direct code/schema inspection this session, or restated unchanged from a prior sprint's VERIFIED finding and cited back to it), LIKELY (strong indirect evidence, not exhaustively confirmed), or UNKNOWN (flagged rather than guessed).

**Builds on**: Sprint 6A (canonical academic entities), 6B (academic structure reconciliation), 6C (academic operating model — entity-level), 6D (workflow model — "what are the workflows"). Sprint 6E asks a different question: **who performs those workflows** — the organizational-actor and authority layer underneath 6D's process traces.

---

## Executive Summary

EduNexus's real, reachable organizational model has **exactly one fully realized actor: the teacher**, and **one fourth, completely separate "admin" concept nobody else in this audit series has named**: a platform-operator role (`ADMIN_EMAILS` env-var allowlist, `app/admin/page.tsx:25`) distinct from Core's `school_admin`/`headteacher`/`deputy_headteacher` and from the legacy `teachers.role` text column. Core's institutional admin-tier roles — `school_admin`, `headteacher`, `deputy_headteacher` — exist as a real, DB-enforced enum (`types/core.ts:26-31`, backed by a `CHECK` constraint, `20260629_core_foundation.sql:221-224`) and are checked correctly by a real authorization layer (`lib/core/permissions.ts`), but **have zero UI representation and, more decisively, no reachable production path that ever grants `headteacher` or `deputy_headteacher` to anyone** — the only role-granting code path (`updateSchoolUserRole`, `lib/core/school-users.ts:44`) has no caller anywhere in `app/`. `school_admin` itself is only ever auto-granted to whoever creates a school (`lib/core/school.ts:31`), and Core's own school-creation route has no UI caller either (`lib/core/school.ts:54-55`'s own code comment: *"Core has no onboarding UI today (no page calls any app/api/core/* route)"*). **In the live, reachable product, the entire institutional-administration tier is inert.**

The clearest concrete evidence of what a "real school" was designed to look like — never wired to the live authority model — is the Reference School seed pipeline (`scripts/reference-school/03-seed-staff.ts:29-38`), which names nine distinct real-world titles (Principal, two flavors of Deputy Principal, Dean of Studies, Examinations Officer, Finance Officer, Admissions Officer, ICT Administrator, School Secretary) and collapses **all of them** into just three of the five `SchoolUserRole` enum values, five of the nine mapped identically to `school_admin` with no distinguishing authority whatsoever. The organizational richness a Kenyan secondary school actually has is present as *seed-script labels only* — never as a modeled authority distinction anywhere in `lib/core/permissions.ts` or the RLS layer.

---

## Part 1 — Current Organizational Structure

For each actor: where represented, how identified, canonical table, authority, current consumers.

| Actor | Represented | Identified by | Canonical table | Authority | Consumers |
|---|---|---|---|---|---|
| **Student** | Two identities, unreconciled (Stage 0.5, restated) | `students.user_id` (legacy, self-portal) or `learners.id` (Core, isolated) | `students` (499 rows, de facto canonical) / `learners` (405 rows, Core) | `requireStudent` — self-record only, no write authority over academic content | `lib/core/identity.ts::resolveStudent`, `app/api/student/**` |
| **Teacher** | **VERIFIED, the one fully realized actor** | `teachers.user_id` | `teachers.id` — ADR-0002 ratified canonical | `requireClassTeacher` (ownership of `teacher_classes`), `canManageAssessment`, self-service class/subject/assessment authority | `lib/core/permissions.ts`, nearly every `app/api/teacher/**` route |
| **Parent** | **VERIFIED, three non-communicating linking mechanisms** (restated from Sprint 6D Workflow 9) | `students.parent_user_id`, `class_students.parent_id`, or Core `learner_guardians` | none singular — three tables | `requireParent` — read-only over own linked learner's records; no write authority over academic content found anywhere in this session's search (Part 8) | `app/api/parent/**` |
| **School Admin** | **VERIFIED, real enum value, zero reachable grant path** | `school_users.role = 'school_admin'` | `school_users` | Full admin-tier authority per `lib/core/permissions.ts` (`SCHOOL_ADMIN_ROLES`) | Only auto-granted to a school's creator (`lib/core/school.ts:31`); no UI ever calls the creating route |
| **Headteacher** | **VERIFIED, enum value exists, provably ungrantable in production** | `school_users.role = 'headteacher'` | `school_users` | Identical admin-tier authority to `school_admin` in every `SCHOOL_ADMIN_ROLES`-gated check | **None** — `updateSchoolUserRole` (the only function that can set this value) has zero callers anywhere under `app/` (grep-confirmed this session) |
| **Deputy Headteacher** | Same as Headteacher | `school_users.role = 'deputy_headteacher'` | `school_users` | Same as `school_admin`/`headteacher` in every check **except** `app/api/core/school/route.ts:98-104`, which explicitly excludes `deputy_headteacher` from its PATCH gate (`['school_admin', 'headteacher']` only — flagged, not fixed, in Sprint 1B per the implementation log) | Same ungrantable-in-production finding as Headteacher |
| **Class Teacher** | **VERIFIED — an ownership relationship, not a role** (see Part 5) | `teacher_classes.teacher_id = teachers.id` | `teacher_classes` | Full authority over one's own class's assessments/marks/roster | `requireClassTeacher`, `canManageAssessment`, `canManageClass` |
| **Subject Teacher** | **VERIFIED absent as a distinct concept** | n/a | n/a | Subject "allocation" is implicit in content-creation, not a persisted assignment (restated, Sprint 6D Workflow 5) | n/a |
| **Guardian** | Same as Parent — Core's `learner_guardians` is the institutionally-correct, functionally-isolated variant | `learner_guardians.guardian_user_id` (inferred column shape, table confirmed live via `repos.schools.listGuardianLearners`) | `learner_guardians` | Read access to Core `learners` records only | `app/api/reports/report-card/mine/route.ts` |
| **System / Cron** | **VERIFIED, 17 scheduled routes, `CRON_SECRET`-gated** | No user identity — bearer secret only | n/a — acts via `createServiceClient()` | Full, unattended, RLS-bypassing write authority over whatever tables each cron touches (confirmed writes: `monday_panel_cache`, `notification_log`, `generation_jobs`, `substrand_health`, `organization_subscriptions`, `records_of_work`, `row_entries`, `ai_call_logs`) | Nothing reviews cron output before it takes effect — several (`billing-renewals`, `generate-record-of-work`) mutate financial/academic-content state with no dedicated audit-log insert of their own |
| **Service Role** | **VERIFIED, the platform's dominant de facto actor** | n/a | n/a | Bypasses RLS entirely | **115 of 126** `app/api/**/route.ts` files call `createServiceClient()` — not limited to cron/webhook routes as CLAUDE.md prescribes; the large majority of ordinary user-facing routes run with RLS bypassed, authorization enforced only in application code |
| **Evidence Moderator** | **VERIFIED absent** | n/a | `assessment_quality_flags` exists in schema, zero application-code references (re-confirmed this session — restated from Sprint 6C) | n/a | n/a — evidence review is done by the class teacher (`confirmReview`/`rejectReview`) or a system account (`COMPASS_AUTO_CONFIRM_CONFIG`), never a distinct moderator persona |
| **Academic Clinic** | A deterministic reporting pipeline, not an actor with authority — restated from AI-boundary research below | n/a | `student_clinic_reports`, `student_learning_context` | None — produces content for a teacher or parent to read | `lib/academicClinic/assessmentPipeline.ts` |
| **Learning Compass** | Two roles at once: an AI tutor (fully autonomous, see Part 7) and an evidence producer (gated, see Part 7) | n/a | `learner_evidence` (via Compass session pipeline) | Direct, unreviewed content generation to the student (chat) + gated evidence writes (mastery claims require teacher confirm) | `app/api/learn/route.ts` |
| **AI (DeepSeek)** | **VERIFIED, single entry point** | n/a | n/a | Varies by caller — see Part 7 | `lib/ai/deepseek.ts::callDeepSeek`/`streamDeepSeek` — grep-confirmed no route or component calls the SDK directly, the CLAUDE.md rule holds in practice |
| **Platform Operator ("Admin")** | **NEW this session — a fourth, wholly separate admin concept** | `process.env.NEXT_PUBLIC_ADMIN_EMAILS` (client-side allowlist check, `app/admin/page.tsx:25,51`) | n/a — no table, an env var | Platform-wide operator access (`/admin`, `/admin/pilot`, `/admin/cleanup`, `/admin/core-schools/new`) | Founder/operator tooling — not a school role at all, and notably the *only* UI page that touches Core's school-creation path (`core-schools/new`) is gated by this env-var mechanism, not by any `SchoolUserRole` |

---

## Part 2 — Authority Map

Built from `lib/core/permissions.ts`, the RLS inventory (this session), and Sprint 6D's workflow traces. "Owner" = the actor whose action is decisive; "Consumers/co-actors" = others who read or are gated by the same resource.

| Responsibility | Owner (VERIFIED) | Overlap? | Duplicated? | Missing? |
|---|---|---|---|---|
| Admission | Class teacher (legacy path, real usage) — restated 6D | Core's isolated `app/api/core/learners` path duplicates this at school-staff-tier | **Yes** — two pipelines, no reconciliation | No formal Administration-only admission decision exists (6D Q7) |
| Promotion | `learner_promotions` (Core) / `student_promotions` (legacy) — both API-only, zero UI (restated 6D) | Both admin/teacher gated per route, but neither is reachable | **Yes**, and both dormant | No recommending-vs-certifying actor split (6D Q8) |
| Withdrawal | School-admin-tier, Core only (`lib/core/learners.ts::withdrawLearner`) | None — no legacy equivalent | No | **Yes** — no UI caller found; also incomplete (6D: `learners.status` never updated) |
| Transfer | School-admin-tier, Core only (`lib/core/transfers.ts`) | None — no legacy equivalent | No | **Yes** — no UI caller found (restated 6D) |
| Assessment (create/mark) | Class teacher, via `canManageAssessment` (admin-tier OR class teacher) | Admin-tier can also act — genuine, intentional overlap | No | No |
| Assessment publish | Same as above (`canManageAssessment`) | Same | No | No second-reviewer/moderation step (restated 6D) |
| Report Cards — generate | `generateReportCards` (Core), inside `runEndOfTerm` — admin-gated | None | No | Reachable only via a dormant endpoint (6D Workflow 15) |
| Report Cards — publish | `canPublishReport` — **admin-tier only, deliberately not extended to class teachers** (`lib/core/permissions.ts:151-161`) | None — the one place ownership was deliberately narrowed rather than widened | No | No |
| Attendance | **VERIFIED absent entirely** — no table, no route, restated from 6C | n/a | n/a | **Yes, completely** |
| Discipline | **VERIFIED absent as a domain** (restated 6C) — only a projection-category enum value and an unrelated `learning_behaviour` capability column exist | n/a | n/a | **Yes, completely** |
| Communication (parent) | Fragmented across three linking mechanisms (Part 1) + two independent notification triggers (`lib/notifications/notify.ts`, `lib/whatsapp/sender.ts`) | Every mechanism operates independently; no shared "who is this parent" resolution used by all three | **Yes — three duplicated ownership records** for the same relationship | No single actor/route owns reconciling them (restated 6D Q5) |
| Timetable | **VERIFIED absent** (restated 6C) | n/a | n/a | **Yes, completely** |
| Subjects | Four representations (restated 6B) — no single owner; whichever module a teacher is using at the moment decides | All four coexist, unreconciled | **Yes** | Persisted subject-to-teacher allocation record — **Yes, missing** (6D Workflow 5) |
| Classes | `teacher_classes` (de facto canonical, teacher self-service) vs. Core `classes` (isolated, admin-tier `canManageClass`) | Genuine parallel ownership, not reconciled | **Yes** | No |
| Streams | Not separately investigated this session beyond 6B's finding that Grade has 3 representations — **UNKNOWN** whether Streams has any independent representation beyond Class; not re-derived here |
| Curriculum | `lib/curriculum/subjects.ts` hardcoded catalogue actually drives the real teacher UI (restated 6B/6C) — no administrative owner, effectively a code-owned constant | n/a | n/a (it's the one subject representation with unambiguous, if unofficial, ownership: whoever edits that file) | No admin-facing curriculum management UI found |
| Learning Evidence | Teacher (`confirmReview`/`rejectReview`) for AI-inferred claims; system account (`COMPASS_AUTO_CONFIRM_CONFIG`) for engagement facts (Part 7) | Two distinct actors by evidence type, cleanly separated by trust tier — the most correctly-modeled authority split found in this audit | No | No — this is the one area confidently NOT missing an owner |
| Analytics (Compass/Clinic/Career) | Read-only derivation from Evidence/Projection — no write authority of its own; **VERIFIED, restated below (Part 8)**: no analytics route was found writing to `school_report_cards` or any report-of-record table | n/a | n/a | n/a |
| Career Guidance | AI (`lib/career/*`) generates and **persists directly** to `careers`/`career_matches` with no human owner in the request path at all (Part 7) | None — no teacher/admin co-actor found in this pipeline | No | **A human ownership/review step is missing** — flagged, not new to this sprint alone but sharpened by this session's AI-boundary research |

**Can ownership overlap?** Yes, in two different ways found this session: *intentional* overlap (Assessment: admin-tier OR class teacher, both legitimate) and *unreconciled duplicate* overlap (Admission, Promotion, Classes, Subjects — two pipelines that don't know about each other, not a designed shared-authority model).

**Is ownership duplicated?** Yes, for the seven items marked above — consistent with and largely restating Sprint 6C/6D's inventories, viewed here through the "who," not "what," lens.

**Is ownership missing?** Yes — Attendance and Discipline have no owner because no domain exists at all; Communication has no *reconciling* owner despite three parallel owners each covering part of the relationship; Career Guidance has no *human* owner in its live request path.

---

## Part 3 — Real School Comparison

**Determination, using only in-repository evidence: EduNexus currently assumes a teacher-driven school, not an administration-driven or genuinely hybrid one.**

Evidence for teacher-driven:
- The one actor with full, self-service, reachable authority over Admission, Class Allocation, Teacher Assignment (self-assignment), Assessment, and Evidence is the class teacher (Parts 1–2, restated 6C/6D).
- Every institutional-administration concept that exists in schema/permissions form (`school_admin`, `headteacher`, `deputy_headteacher`) is **provably unreachable in production** — this session's new finding (Part 1) sharpens 6C's "not separated as domains" into "the administration tier exists in code but has no path to ever be populated with a real person."
- The only UI surface resembling "administration" (`app/admin/**`) is gated by a platform-operator email allowlist, not by any school-level role — it manages EduNexus's own business (pilot schools, cleanup, revenue stats), not a specific school's administration.

Evidence against a hybrid reading: a genuine hybrid model would show *some* administrative actions reachable by a real admin actor even if incomplete. This audit found none — Withdrawal, Transfer, Promotion, Graduation, and End-of-Term (all correctly gated to admin-tier roles in code) are uniformly unreachable by any UI (restated 6D), and the roles required to reach them cannot be granted to anyone in the first place (Part 1, new this session). The absence is total, not partial, which is why "hybrid" is rejected as a description of the *current, reachable* system — the code contains the seeds of a hybrid design (correctly-scoped admin-tier permission checks throughout `lib/core/permissions.ts`) that is simply never activated by any onboarding or UI path.

**This is not evaluated as a defect** — per 6C's own conclusion, restated: it may accurately reflect how a small, 50-teacher pioneer pilot school actually operates today, where a single class teacher plausibly *is* the whole institution's contact point for their class. What this sprint adds is that the "administration tier" is not merely underused, it is **structurally inert** — no sequence of real actions by a real user can currently populate it.

---

## Part 4 — Organizational Gaps

Restated from Sprint 6C's exhaustive entity-level search (not re-derived — see 6C §School-Entity Gap Analysis for the full evidence per row): Departments, Faculties, Subject Heads, Dean of Studies, Exam Office, Timetable, Attendance, Pastoral, House System, Boarding, Academic Coordinators, and Invigilation are all **VERIFIED absent**. Moderation exists as a dormant schema fragment only (`assessment_quality_flags`).

**New this session — the "accidentally implied" category 6C did not have evidence for**: the Reference School seed script (`scripts/reference-school/03-seed-staff.ts:29-38`) names real Kenyan-school organizational titles that 6C's absent-entity search correctly found **no schema or permission trace of**, because they exist only as seed-data labels:

| Title (seed label only) | Mapped `SchoolUserRole` | Distinct authority in `lib/core/permissions.ts`? |
|---|---|---|
| Principal | `headteacher` | No — identical to `school_admin` everywhere except the one narrower PATCH gate (Part 1) |
| Deputy Principal – Academics | `deputy_headteacher` | No |
| Deputy Principal – Administration | `deputy_headteacher` | No — **the same enum value represents two different real titles with different scope, collapsed to one** |
| Dean of Studies | `school_admin` | No |
| Examinations Officer | `school_admin` | No |
| Finance Officer | `school_admin` | No |
| Admissions Officer | `school_admin` | No |
| ICT Administrator | `school_admin` | No |
| School Secretary | `school_admin` | No |
| Subject Teacher (×39) | `teacher` | No — matches the already-established finding that Subject Teacher has no distinct representation (Part 1) |

**Classification for this sprint's schema**: every title in this table is **accidentally implied** — present as a human-readable label in a fixture script (used to seed a realistic reference school for testing/demo purposes), with zero corresponding authority distinction anywhere the platform actually enforces permissions. A person seeded as "Finance Officer" and a person seeded as "Admissions Officer" are, to every `lib/core/permissions.ts` check, the identical actor.

---

## Part 5 — Role vs. Permission

**Finding: the codebase mixes three separate, non-communicating notions of "role," plus one pure-ownership relationship, and does not consistently model any of them as "permissions" in a capability sense.**

1. **`UserRole` (`lib/auth/getRole.ts:4`)** — `'teacher' | 'parent' | 'student'` only. This is the **platform-wide, UI-routing role** — it decides post-login redirect (`getRoleRedirect`) and gates `app/dashboard`/`app/teacher` layouts. It has **no admin-tier value at all** — `school_admin`/`headteacher`/`deputy_headteacher` do not exist in this type. Backed by `profiles.role`/`profiles.secondary_role` (supports one declared "dual role," e.g. a teacher who is also a parent).
2. **`SchoolUserRole` (`types/core.ts:26-31`)** — the 5-value Core enum (`school_admin | headteacher | deputy_headteacher | teacher | parent`), backed by a real DB `CHECK` constraint and consumed exclusively by `lib/core/permissions.ts`/RLS. This is a genuine **role** in the classical sense (a named, enumerated, schema-enforced membership category) — but as Part 1 established, three of its five values are provably ungrantable in production, so functionally only `teacher` and (rarely, since Core onboarding is itself unreachable) `school_admin` are ever real.
3. **`teachers.role` (legacy, free text)** — a third, separate role-shaped column, distinct from both of the above, read by `resolveTeacher` as `legacyRole` and explicitly annotated in code as "not to be confused with `SchoolUserRole`" (`lib/core/identity.ts:51`).
4. **Class Teacher — VERIFIED, this is ownership, not a role or a permission.** It is a foreign-key relationship (`teacher_classes.teacher_id = teachers.id`), checked by `requireClassTeacher`, which resolves "is this the owner of this specific resource," not "does this person hold a named organizational title." A teacher is "the class teacher" of exactly the classes they created; nothing distinguishes this from ordinary row ownership (contrast with a real school's "class teacher" being an *assigned*, often administratively-granted, responsibility distinct from merely being a teacher who created a roster).

**Direct answers**:
- **Is "teacher" a role, or simply someone with permissions?** Both, depending on layer — a genuine `UserRole`/`SchoolUserRole` value at the identity/RLS layer, but every actual capability check (`canManageAssessment`, `canManageClass`, `requireClassTeacher`) additionally requires resource ownership on top of the role, so holding the role alone grants almost nothing without also owning the specific `teacher_classes` row in question.
- **Is "class teacher" a role, a permission, or merely ownership?** **Merely ownership** — confirmed above, no separate role/permission construct exists for it.
- **Headteacher** — a real, schema-enforced role value, but one that (Part 1) cannot currently be granted to anyone through any reachable path — a role that exists in the type system and the database constraint but not, in practice, in the world.
- **Parent** — both a `UserRole` value (platform routing) and a `SchoolUserRole` value (Core RLS/permissions), but the actual parent-of-this-specific-child *authority* is, like Class Teacher, resolved by ownership (one of the three linking mechanisms, Part 1), not by the role value itself — the role says "this person is *a* parent somewhere," the ownership link says "this person is *the* parent of *this* learner."
- **Guardian** — Core's institutionally-correct name for the same ownership relationship as Parent's `learner_guardians` mechanism; not a separate role, a separate *table* for the same relationship.
- **School Admin** — the one role value with a real, if narrow, live grant path (auto-assigned to a school's creator) — genuinely a role, though its practical reach is currently limited by Core onboarding's own unreachability (Part 3).

**Overall**: the codebase models **permissions** correctly and consistently (`lib/core/permissions.ts`'s `require*`/`can*` functions are a genuine capability-check layer, well-designed per Sprint 1A's own stated purpose), models **roles** partially and redundantly (three separate, non-communicating role-shaped fields), and does not model **responsibilities** (a named person accountable for a domain, e.g. "the Examinations Officer") at all — responsibilities exist only as seed-script labels (Part 4), never as a codeable construct distinct from role or ownership.

---

## Part 6 — Future Department Model

Exploratory only, per scope — no recommendation beyond what is directly evidenced.

Using the Reference School seed titles (Part 4) as the only in-repository evidence of an intended real-world structure, the nine titles sort cleanly into four buckets that already loosely correspond to this audit's own admin/academics framing (restated from 6C) plus two buckets 6C did not name:

- **Administration**: Dean of Studies, Examinations Officer, Admissions Officer, School Secretary — all seeded as `school_admin`, and all four are, by real-world function, administrative/registrar-adjacent roles. **Evidence**: seed labels only; zero code-level distinction exists today.
- **Academics**: Deputy Principal – Academics — seeded as `deputy_headteacher`, the one seed title explicitly scoped to academics rather than general administration. **Evidence**: the seed script itself distinguishes this from "Deputy Principal – Administration" by title text alone, even though both collapse to the identical enum value.
- **Operations**: ICT Administrator, Finance Officer — neither maps to an academic or pure-registrar function in a real school; both are infrastructure/business-operations roles. **Evidence**: seed labels only.
- **Student Welfare**: **VERIFIED, no evidence found anywhere in this session's search** — no seed title, table, or route corresponds to a welfare/pastoral/guidance-and-counselling function. This bucket has zero repository evidence of any kind, consistent with 6C's "Pastoral: VERIFIED absent" finding.

**Determination**: Administration and Academics are the only two buckets with any repository evidence at all (seed titles) beyond 6C's structural findings; Operations has weak (two-title) evidence; Student Welfare has none. No recommendation is made about whether or how to build any of these — this section only reports where the seed-script evidence, if taken as an intended future shape, would land.

---

## Part 7 — AI Responsibility Boundaries

Full detail researched this session across every AI call site (`lib/ai/deepseek.ts` confirmed as the sole DeepSeek entry point — no route or component calls the SDK directly). Condensed classification:

| Subsystem | Classification | Basis |
|---|---|---|
| Evidence lifecycle — mastery/AI-inferred claims | **Approval required** | Lands `pending_review`; only a teacher's `confirmReview`/`rejectReview` (`app/api/teacher/classes/[classId]/compass/evidence/[evidenceId]/route.ts:76-77`) advances it — DB trigger enforces the transition |
| Evidence lifecycle — engagement facts, teacher-attested uploads | **Automation** | System-account auto-confirm (`lib/compass/autoConfirm.ts`, `lib/holiday/returnAutoConfirm.ts`), with a runtime guard that refuses to auto-confirm mastery-typed rows |
| Projection (`lib/projection/recompute.ts`) | **Not an AI subsystem** | Zero DeepSeek calls in the engine — deterministic aggregation over already-confirmed evidence only |
| Learning Compass — chat tutor | **Fully autonomous / assistant, child-facing, no review** | `app/api/learn/route.ts:371,524` streams AI text live to the student with no teacher-in-the-loop step |
| Academic Clinic pipeline | **Not an AI subsystem** | Deterministic report backbone; Career Intelligence layers AI narrative on top of it separately |
| Career Intelligence (report/matches/profile generation) | **Fully autonomous** | AI output written directly to `careers`/`career_matches` (`lib/career/matchEngine.ts:97`, `lib/career/careerEngine.ts:191`) and served straight to student/parent with zero human review anywhere in the request path (`app/api/career/intelligence-report/route.ts`, `app/api/career/match/route.ts`) |
| Adaptive Learning / Differentiation | **Approval required (by design, not by AI presence)** | No DeepSeek call found in the differentiation path itself, but a genuine draft→teacher-approve gate exists (`app/api/teacher/classes/[classId]/differentiation/approve/route.ts`) — the cleanest human-gate pattern found anywhere in this audit |
| Holiday Planner | **Mixed — advisor + automation fallback** | Teacher-approve gate, plus a documented 3-day auto-publish fallback (memory: Holiday Plans Publish Gate) |
| Lesson Plan / SOW / Remedial / Slides / Kiswahili Insha | **Advisor / assistant** | All teacher-facing; teacher reads/edits before any downstream use |
| Academy AI Judge | **UNKNOWN, flagged for follow-up** | Scores a student's own reflection/mission submission directly in the API response (`app/api/academy/reflect/route.ts`, `app/api/academy/mission/complete/route.ts`); downstream review path not traced this session |

**Rule violations found (CLAUDE.md "AI / DeepSeek Rules" — always set `max_tokens` explicitly), not fixed, per scope**: `lib/career/matchEngine.ts:79,147` and `lib/career/autoReportGenerator.ts:177` call `callDeepSeek` with no options object, so no `max_tokens` is set for any of the three.

**Highest-priority child-facing-without-review findings** (informational — no fix, per scope): the Compass chat tutor and the entire Career Intelligence pipeline are the two subsystems where AI-generated content reaches a student or parent with no teacher step anywhere between generation and display — Career Intelligence additionally *persists* that content to the database before any human ever sees it.

**Evidence Moderator, re-confirmed**: no such actor exists (Part 1) — restated here because Part 7's own subsystem, Evidence, is the one place a moderator-shaped role would plausibly belong, and none was found.

---

## Part 8 — Organizational Boundary Violations

Researched exhaustively this session across `app/api/teacher/**`, `app/api/parent/**`, `app/api/school/**`, and any non-Core route touching `schools`.

- **Teacher routes writing to `learners`/`school_users`/admission-type Core tables**: **none found.** Every `.from()` call inside `app/api/teacher/**` resolves to legacy/teacher-domain tables only (full list captured in research: `assessments`, `assignments`, `class_students`, `students`, `teacher_classes`, `teachers`, etc.) — no Core admission surface is touched.
- **Parent routes writing to academic-content tables**: **none found as a direct write**, with one flagged edge case: `app/api/parent/assessments/process/route.ts:69-75` runs the same `runAssessmentPipeline()` a teacher would, writing `student_learning_context`/`student_clinic_reports` — but this is explicitly, by its own code comment, a self-service path for a **teacherless** student whose parent is the only available data-enterer, not a parent overwriting a teacher-owned record. Flagged for visibility, not classified as a violation.
- **Analytics/`app/api/school/**` writing to `school_report_cards` or any report-of-record table**: **none found.** Only `lib/repositories/school.repository.ts` and `lib/core/endOfTerm.ts` reference `school_report_cards` anywhere in the codebase.
- **Non-Core routes writing to `schools` directly**: **none found.** All access is mediated through `lib/repositories/school.repository.ts`, consistent with CLAUDE.md's "all DB calls go through `lib/`" rule.

**Two structural findings outside the four checked categories, surfaced by this session's research and worth recording here as boundary-adjacent**:
- **`SCHOOL_ADMIN_ROLES` is independently defined twice** — identically, `['school_admin', 'headteacher', 'deputy_headteacher']` — in both `lib/core/permissions.ts:42` and `lib/core/context.ts:30`. Not a domain-crossing violation, but a direct instance of CLAUDE.md's "no duplicate constant definitions across files" rule, discovered while building Part 1's authority map.
- **RLS-level ownership-by-actor anti-pattern on `learner_evidence`**: the `learner_evidence_own_teacher` policy (`20260707_evidence_domain.sql:126-134`) gates access by *who ran the ingestion* (`ingestion_runs.initiated_by`/`teacher_id`), not by current teach-relationship — the exact anti-pattern CLAUDE.md prohibits at the application-code level (*"Never add a query filter that uses `teacher_id` to gate read access to evidence... belonging to a learner the current teacher doesn't teach"*), but present here at the **database RLS layer** instead. Likely inert in practice since the large majority of routes use the service-role client and bypass RLS entirely (Part 1's Service Role finding), but present in the schema regardless.

---

## Part 9 — Future School Operating System Readiness

**Evidence-based determination: EduNexus today is architecturally closest to an SIS (Student Information System) core wrapped in an LMS-shaped teaching surface, with no ERP layer, evolving toward — but not yet resembling — an integrated School Operating System.**

- **SIS-shaped evidence**: Core's schema (`schools`, `school_users`, `academic_years`, `terms`, `learners`, `learner_enrollments`, `learner_promotions`, transfers, report cards) is a textbook SIS data model, correctly normalized, RLS-enforced, role-gated — restated from 6A–6D. It is simply unreachable by any UI today (Part 3).
- **LMS-shaped evidence**: the actually-used, teacher-facing surface (SOW, lesson plans, assessments, records of work, Learning Compass tutoring, evidence/mastery tracking) is a genuine LMS feature set, and it is where all real production usage lives (restated from every prior sprint in this series).
- **No ERP layer exists**: Finance (`mpesa_payments` is token/subscription billing for the platform itself, not school-fee/finance management), HR, procurement, or facilities concepts were not found anywhere in this or prior sprints' searches — "Finance Officer" exists only as a seed-script label (Part 4) with zero corresponding schema.
- **Toward an integrated School Operating System, but not there**: the permission layer (`lib/core/permissions.ts`), identity layer (`lib/core/identity.ts`), and event system (`lib/events`, referenced in `lib/core/school.ts:22-29`) are all genuinely cross-cutting, well-designed foundations that a real Operating System would need — but they currently govern a system where, per Part 3, the administrative half is structurally inert and the two halves (Core/legacy) do not share data. The clearest single piece of evidence for "evolving toward, not yet at" is `lib/core/school.ts:54-58`'s own code comment, which states outright that Core has no onboarding UI and that a silently-created school "can never be viewed, corrected, or managed by anyone" — a precise, self-documented description of a system with SIS-grade data modeling and zero operational reachability.

No conclusion beyond this is drawn — this section reports the shape found, not a target or a roadmap.

---

## What This Document Does Not Do

Per its own scope: it does not propose fixing the ungrantable-headteacher gap, the duplicated `SCHOOL_ADMIN_ROLES` constant, the RLS ownership-by-actor policy, or any department/role model. It does not recommend which of Part 6's four buckets should be built first, or whether any should be built at all. No ADR is raised — no entirely new canonical-domain question was discovered (the `SchoolUserRole` enum, `teachers.id`, and `students`/`learners` identity questions were all already ratified or documented by ADR-0002 and Stage 0.5; this sprint found *reachability* gaps in an already-ratified model, not a new canonical-identity conflict).

---

## Validation

Explicitly confirmed this session:
- **0** production files modified
- **0** schema changes
- **0** migrations
- **0** repository, route, or service edits
- **0** tests modified
- Only this document and the implementation log entry were written.

## Stop Condition

STOP after this audit. No implementation performed. No permission refactor, department creation, attendance/timetable/dashboard/workflow-engine/notification/AI/schema work performed. No ADR raised. Awaiting further instruction before any Sprint 6F.
