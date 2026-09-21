---
name: assess
description: Pre-implementation architectural and engineering assessment for any EduNexus code change that touches a canonical domain. Run BEFORE writing code — produces the 5-part Phase B assessment (architectural, engineering, small-commit plan, risks, verdict) and gates on ✅/⚠ ADR/❌. Use when the user asks to build, add, change, or fix something in lib/, app/api/, or supabase/migrations/, or types /assess.
---

# /assess — Phase B pre-implementation assessment

You are governing a ratified architecture, not designing one. Assess the request
against the ratified documents, produce the verdict, and stop. Do not write
implementation code in this skill — the assessment is the gate.

## Inputs

`$ARGUMENTS` is the change being proposed. If empty, ask what the user wants
to build in one sentence, then proceed.

## Step 1 — Ground yourself in the ratified docs (read, don't recall)

Read the sections that matter for this request. Never assess from memory of
these documents; they change.

- `docs/architecture/reference-architecture-specification.md` — §3 for the
  canonical domain list (Schools, Teachers, Learners, Guardians, Classes,
  Streams, Subjects, Assessments, Marks, Report Cards, Evidence, Intelligence,
  Permissions, …)
- `docs/architecture/canonical-domain-registry.md` — which domain owns what
- `docs/architecture/deprecation-registry.md` — what must not be extended
- `docs/edunexus-constitution.md` — the 10 articles
- `CLAUDE.md` — Architecture Rules and Security Rules sections
- `docs/architecture/learner-record-layer-decisions.md` — Decisions 5 and 6
  if the request touches evidence, projection, or learner intelligence

If the request does not touch any canonical domain, say so in one line and
skip to a short Engineering Assessment (Step 3) — the full format is for
canonical-domain changes.

## Step 2 — Inspect the actual code paths

Before writing the assessment, look at what exists. Use grep/find on:

- The API routes that would be created or modified under `app/api/`
- The `lib/` modules and `lib/repositories/` files involved
- `lib/core/permissions.ts` — the shared permission service. Any new
  authorization check must extend this, never duplicate it
- Existing migrations in `supabase/migrations/` for the tables involved
- Existing tests for the touched modules

Answer these internally — and state "why" explicitly if any is yes:
- Which domain owns this?
- Does it introduce another identity, repository, service, or API for
  something that already has one?
- Does it duplicate business logic that exists elsewhere?
- Does it violate school ownership or intelligence separation?
- Can an existing domain evolve instead of a new one being created?

## Step 3 — Produce the assessment

Use exactly this structure. Every field gets a real answer, not "N/A" unless
it is genuinely inapplicable.

```
## 1. Architectural Assessment
- Affected canonical domains:
- Constitutional compliance:        (cite article numbers)
- RAS compliance:                   (cite § numbers)
- ADR required?                     Yes / No — reason
- Current sprint / freeze status:   (check memory: Foundation Freeze, PE-1)
- Future impact:

## 2. Engineering Assessment
- DB tables / columns needed:       (new or changed; RLS + index implications)
- Existing lib/ functions reused:
- New lib/ functions needed:        (with explicit return types)
- API routes affected:              (auth.getUser() first, Zod on input)
- Repositories affected:
- Services affected:
- Components affected:              (UI only, zero business logic)
- Security impact:                  (ownership via class_students, never teacher_id;
                                     service-role client only in cron/webhook)
- Testing impact:                   (unit / integration / regression /
                                     authorization / edge-case — all five)
- Deployment risk:
- Backward compatibility:

## 3. Implementation Plan
Small commits. Each compiles alone, passes tests alone, is reversible, and has
exactly one responsibility. Never one "big refactor" commit.

- Commit 1: …
- Commit 2: …
- Commit N: Tests (or tests interleaved per commit if the change is small)

## 4. Risks
- Architectural:
- Business:
- Migration:            (Add → Backfill → Verify → Observe → Deprecate → Delete)
- Security:
- Performance:

## 5. Verdict
✅ Safe to Implement  /  ⚠ Needs ADR  /  ❌ Reject — with the constitutional
reason if rejecting.
```

## ADR triggers — only these require ⚠

Changes a canonical identity · changes canonical ownership · introduces a new
architectural layer or canonical domain · changes Intelligence boundaries ·
changes repository responsibilities · changes security architecture · changes
migration strategy · changes the Constitution · conflicts with the RAS.

Anything else is ✅ or ❌, never ⚠.

## The ten rules every ✅ must satisfy

No exceptions without an ADR:
1. Never create another canonical identity
2. Never create another write path
3. Never duplicate business logic
4. Never duplicate authorization — extend `lib/core/permissions.ts`
5. Never duplicate repositories
6. Never bypass the service layer
7. Never bypass RLS
8. Every feature ships with tests (unit, integration, regression,
   authorization, edge-case)
9. Every migration follows Add → Backfill → Verify → Observe → Deprecate →
   Delete, no skipped steps
10. Every change improves maintainability — if the code got harder to
    understand, the implementation is wrong

## After the verdict

- On ✅: stop and wait for the user to approve the plan before implementing.
  Do not start Commit 1 inside this skill.
- On ⚠: draft the ADR title and one-paragraph rationale; wait for approval.
- On ❌: explain which article or rule is violated and, if one exists, the
  smallest compliant alternative.

## When the work later completes

Remind the user that `docs/engineering/implementation-log.md` needs an entry:
Date · Sprint/Stage · What changed · Architectural documents referenced · ADR
(if any) · Tests added · Rollback considerations. This log is separate from
git log (which lacks the architectural cross-references). It falls behind
easily — check the last entry date and say so if it is stale.
