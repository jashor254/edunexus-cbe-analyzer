# Institutional Dress Rehearsal — Mwatate Ridge Senior School

**Date:** 2026-08-13
**School:** Mwatate Ridge Senior School (`10fa6eab-7209-485b-880a-bafaf3038277`) — the
synthetic Reference School (`docs/reference-school/`), **not a real school**.
**Purpose:** walk the first full **YES → LIVE** institutional onboarding through the
real product HTTP routes, as founder → principal → teacher, and record every stall
before fixing anything.

**Method.** Every step was driven against a running `next dev` by real authenticated
HTTP requests carrying real `@supabase/ssr` session cookies — no direct DB writes, no
route handlers imported in-process. Sessions were minted per actor with
`auth.admin.generateLink` + `verifyOtp` (no password was set or changed on any
account). Direct SQL was used **read-only**, for before/after observation.

**Fixture integrity after the rehearsal:** 49 members, 407 learners, 9 classes,
144 current teaching assignments — unchanged. The only new rows are one synthetic
payment and the entitlement it activated.

---

## 1. What worked

| # | Step | Route | Result |
|---|------|-------|--------|
| 1 | Founder reaches the canonical school list | `/growth` → "Live Schools & Payments" → `/admin/schools` | Link present and correct |
| 2 | Find the school by name | `GET /api/admin/schools?search=Mwatate` | 200 — one row, 39 active teachers, 49 members |
| 3 | Open the canonical school | `GET /api/admin/schools/{id}/payments` | 200 — entitlement `none`, 0 payments |
| 4 | Record a synthetic institutional payment | `POST /api/admin/schools/{id}/payments` | **201** — KES 40,000, bank transfer, ref `REHEARSAL-SYNTHETIC-001` |
| 5 | Entitlement activation | *(same call)* | **Automatic** — `active`, expires `2027-08-12`. No separate activate step is needed; payment is the trigger |
| 6 | Teacher coverage | `POST /api/tokens/check {feature:'sow_generate'}` | `{allowed:true, tier:'teacher', deductTokens:false, cost:0}` |
| 7 | Coverage genuinely follows entitlement | suspend → probe → re-activate → probe | suspended ⇒ **403 `insufficient_tokens`**; re-activated ⇒ **covered** again |
| 8 | Principal holds school-admin authority | `GET /api/core/teachers?schoolId=…&list=true` | 200 — 49 staff. `headteacher` passes `requireSchoolAdmin` by design |
| 9 | Principal can grow the staff | `POST /api/core/teachers {action:'invite', role:'teacher'}` | 200 — `status: no_account` (correct for an unregistered email) |
| 10 | Teacher's My Teaching | `GET /api/teacher/teaching-assignments` | 200 — `kind:'school'`, 9 assignments, each with class + grade + stream + subject |
| 11 | Teacher's first SOW under coverage | `POST /api/sow/generate` | 200 → job **completed**, 2 lessons generated, KICD-grounded, **0 tokens deducted** |

**The commercial spine holds.** A school pays, entitlement goes live, and every teacher
at that school stops paying Solo Teacher prices within a minute — proven in both
directions, not assumed.

---

## 2. Stalls

### STALL-1 — There is no founder-level handoff. *(structural, blocks real pilots)*

`POST /api/core/teachers {action:'invite'}` is gated by
`requireSchoolAdmin(schoolId)`, which resolves the caller's **own membership at that
school**. The founder holds `requireGrowthUser` (platform admin) and — confirmed live —
**no `school_users` row at Mwatate Ridge at all**. The invite returned **403**.

There is no `requireGrowthUser`-gated path anywhere that can grant school membership.
`updateSchoolUserRole` exists in `lib/core/school-users.ts` but is reachable only
through `teacherOnboarding`'s invite/accept flow — i.e. only by someone who is already
an admin *inside* the school.

Consequence: any school that arrives **without the founder as a member** — seeded,
imported, or created by a script — can never be handed to its principal through the
product. Mwatate Ridge only survived this because a `headteacher` was seeded, and
`headteacher` already satisfies `requireSchoolAdmin`. A real school onboarded the same
way would be stranded.

*Not affected:* a school the founder creates through `/admin/core-schools/new`, where
`createSchool()` makes the creator its `school_admin`.

### STALL-2 — Bulk learner roster import 500s on this school. *(blocks the 400-learner onboarding story)*

```
POST /api/core/learners/import {action:'preview'}  → 500
[core/learners/import] Cannot read properties of null (reading 'trim')
```

Root cause: `lib/core/learnerRoster.ts` builds its class-name index with

```ts
classByName.set(normaliseKey(c.class_name), c.id)   // normaliseKey = (v: string) => v.trim()…
```

but **all 9 of this school's classes have `class_name = NULL`** and carry their name in
`display_name` instead. The parameter is typed `string` while the column is nullable, so
the type gave no warning and the null reaches `.trim()`.

This is not fixture-specific: it fires for **any** school whose classes were created
with `display_name` only, and it takes down roster import entirely — before a single row
is read — behind the generic message *"Could not process this roster."*

### STALL-3 — `/api/sow/generate` validates three context fields; the pipeline needs five. *(medium)*

The route's Zod schema requires only `learningArea`, `grade`, `curriculumMode`
(`.passthrough()`), but `lib/sow/lessonPipeline.ts` also dereferences
`context.learningAreaName` and `context.gradeName`. Each missing field returns
**200 + a jobId**, then fails inside the background job with a raw TypeError:

| Missing field | Job failure |
|---|---|
| `learningAreaName` | `Cannot read properties of undefined (reading 'toLowerCase')` |
| `gradeName` | `Cannot read properties of undefined (reading 'replace')` |

Three separate generations were burned discovering this chain. The teacher UI always
sends both fields, so this is a contract/robustness gap rather than a live blocker —
but the failure is invisible at request time and unreadable when it lands.

### STALL-4 — A job that generates nothing is marked `completed`. *(low)*

A `lessonStructure` without `firstWeek`/`lastWeek` produces `total: 0` (NaN slot
arithmetic never trips `buildTermSchedule`'s range guard), the route answers **200**, and
the job finishes with outer `status: "completed"` wrapping inner
`result.status: "failed"`, 0 lessons. Job status and job result disagree.

### STALL-5 — Coverage is cached for 60s. *(low, by design — worth knowing)*

`checkFeatureAccess` caches per user+feature for `CACHE_TTL_MS = 60_000`. A teacher on a
school that just went live can be told to pay for up to a minute afterwards. Both cache
waits in this rehearsal were real.

### STALL-6 — The founder's screens do not flag the reference school as a fixture. *(low, but it bit this session)*

`isLikelyTestFixture()` matches only `SYNTHETIC_`/`DEBUG` prefixes, so Mwatate Ridge
returns **`likelyTestFixture: false`** and presents exactly like a real paying
institution. This rehearsal recorded KES 40,000 against it with no warning anywhere in
the flow. The one school guaranteed to be paid against in every rehearsal is the one
school the badge does not cover.

### STALL-7 — The principal is a "Solo Teacher" in their own workspace. *(observation)*

`GET /api/teacher/teaching-assignments` as the headteacher returns `{kind: 'solo'}` —
the principal of a 407-learner school. Related: only **39 of 49** members have a
`teachers` row (the 39 teachers do; the head, 2 deputies and 7 admins do not), and
`/api/sow/generate` hard-requires one, so an admin-tier user who also teaches is
refused with a bare 403.

---

## 3. Operator errors (mine, not the product's)

Recorded so the log isn't read as evidence against working code:

- Probed `/api/tokens/check` with `GET`; it is POST-only (405). This lost the true
  pre-payment coverage reading, so the flip was reconstructed afterwards by suspending
  and re-activating entitlement through the real route — a stronger test, but it means
  no observation exists of the school's original `school_not_entitled` state.
- Sent `mode` instead of `action` to the roster import (422), and joined
  `class_subjects.teacher_id` to `auth.users` before noticing it FKs `school_users.id` —
  which briefly and wrongly suggested the 144 teaching assignments were orphaned. They
  are sound: 16 active teachers hold all 144.

---

## 4. State left behind

- `schools.school_entitlement_status = 'active'`, expires `2027-08-12` — **left live
  deliberately**; this is the LIVE end state the rehearsal was for.
- One `school_payments` row, ref `REHEARSAL-SYNTHETIC-001`, notes marking it synthetic.
- Four `jobs` rows from SOW attempts (one completed, three failed per STALL-3/4).
- No fixture data was added, removed or edited. Nothing was fixed.

## 5. Suggested order of work

1. **STALL-2** — one-line null guard; it blocks the headline onboarding capability.
2. **STALL-1** — decide the handoff model: either a `requireGrowthUser` membership-grant
   path, or a documented rule that every school is created founder-owned.
3. **STALL-3** — move `learningAreaName`/`gradeName` into the route's Zod contract.
4. **STALL-6** — teach the fixture badge about the Reference School by name.
5. **STALL-4 / 5 / 7** — as capacity allows.
