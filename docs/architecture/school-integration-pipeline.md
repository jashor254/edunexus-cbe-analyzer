# School Integration Pipeline

Status: DRAFT — architecture decision, not yet executed.

Depends on: [Reference School](../reference-school/README.md) (v1, frozen —
proves the Core schema shape), [Learning Intelligence Migration Strategy](learning-intelligence-migration-strategy.md)
(Phase 0 depends on this document existing).

## Purpose

This is the missing piece the whole project has been building toward: how
does a real school's **existing structured data** actually get into
EduNexus's Core School Operating System, so the Learning Intelligence
Layer can plug into it? Everything so far — the Reference School, the
Core schema, the migration strategy — assumed data would somehow arrive in
`schools`/`learners`/`school_users`/`classes`. This document defines how.

It also settles the developer-platform audit finding directly: nothing
existing can do this today. `integration_connections`/`sync_pipeline` is a
dead stub pointed at the legacy schema; devportal's working gateway solves
outbound delivery to third parties, not inbound school data. This document
is the decision to build new, Core-native infrastructure rather than
resurrect either.

---

## 1. What "Existing Structured Data" Actually Means

For most Kenyan schools today, "existing structured data" is not a live
SIS API — it's Excel/CSV registers (admission lists, class lists, fee
registers), sometimes a basic school-management desktop app with export,
rarely a real API. A small number of better-resourced schools may run
Google Classroom, or (longer-term) a proper SIS with webhook/API
capability. The integration pipeline needs to support the common case
first, not the rare one.

**Three integration modes, in the order they should actually be built:**

1. **CSV/spreadsheet import** — a school admin uploads a roster (students,
   guardians, classes) exported from whatever they already use. This is
   the realistic v1: no third-party API to negotiate, no OAuth flow, works
   for every school regardless of what system they're on.
2. **Direct API push** — a school (or a vendor on their behalf) calls an
   EduNexus ingestion endpoint directly, authenticated with a school-scoped
   API key. Same underlying pipeline as CSV import (both produce the same
   normalized payload), just a different entry point.
3. **Third-party connector (Google Classroom, Canvas, Moodle, custom
   webhook)** — the `integration_type` enum the abandoned migration
   already anticipated is the right *shape* for this, just wrong scope
   (developer-owned, legacy-schema-targeted). Building actual OAuth
   connectors is deferred until a real school asks for one — building
   Google Classroom sync before anyone needs it is exactly the kind of
   premature generalization this project has consistently avoided.

**Decision: build mode 1 (CSV import) and mode 2 (API push) as one shared
pipeline now. Defer mode 3 until a real school requests it.**

---

## 2. Why Not Resurrect `integration_connections`

The existing table's identity model is wrong at the foundation, not just
incomplete:
- `developer_id` FK → `developer_profiles`, with RLS scoped to
  `auth.uid() = developer_id`. A school integration is owned by a
  **school**, not a developer account — patching this means changing the
  FK, the RLS policy, and every assumption built on "the developer owns
  this," which is most of the table.
- `sync_pipeline`'s columns (`external_id`, `integration_connection_id`)
  were added to **legacy** `teacher_classes`/`students`/`class_assessments`,
  not Core. Reusing them means either duplicating them onto Core tables
  (two sets of the same columns, confusing) or migrating the legacy
  columns over (more work than starting clean, for columns nothing has
  ever used).
- No write endpoint was ever built against it, so there's no working
  behavior to preserve by reusing the table — only a schema shape, and
  that shape encodes the wrong owner.

**Decision: new tables, Core-native from the start. `integration_connections`
and its `sync_pipeline` columns are left as dead schema — not deleted (no
harm in unused columns existing), not built upon.**

---

## 3. New Schema

- **`school_integrations`** — replaces `integration_connections`'
  role, correctly scoped: `id`, `school_id` (FK → `schools`, NOT NULL),
  `integration_type` (`csv_import` | `api_push` | `google_classroom` |
  `canvas` | `moodle` | `custom_webhook` — same enum shape as before,
  correctly owned), `status` (`pending` | `active` | `paused` | `revoked`),
  `created_by` (FK → `auth.users`, the school admin who set it up),
  `last_sync_at`, `config` jsonb (connector-specific settings).
- **`school_integration_api_keys`** — one or more API keys per
  `school_integrations` row. Reuses the hashing/validation *pattern*
  already written (and unused) in `lib/organizations/api-keys.ts` — that
  code is sound, it's just never been wired to anything; this finally
  gives it a real caller, scoped to `school_id` instead of an
  organization.
- **`school_integration_imports`** — one row per import batch (CSV upload
  or API push): `integration_id`, `status` (`processing` | `completed` |
  `failed` | `partial`), `row_count`, `error_count`, `errors` jsonb
  (per-row validation failures), `imported_by`, timestamps. This is the
  audit trail — every import is inspectable after the fact, never silent.
- **`external_id` + `school_integration_id`** columns added to the Core
  tables that need idempotent upsert from an external source: `learners`,
  `classes`, `learner_guardians`. Same idea as the abandoned migration's
  columns, but on the right tables, with a unique constraint on
  `(school_id, school_integration_id, external_id)` so re-running the same
  import (a school re-uploading a corrected CSV) upserts rather than
  duplicates.

---

## 4. Ingestion Pipeline

Both CSV import and direct API push produce the same normalized payload
and go through the same processing path — the entry point differs, the
pipeline doesn't:

```
CSV upload  ──┐
              ├──▶ Normalize to shared payload shape ──▶ Validate ──▶ Upsert into Core ──▶ school_integration_imports record
API push    ──┘
```

- **Normalized payload shape**: `{ learners: [...], classes: [...],
  guardians: [...], enrollments: [...] }` — each entity shaped to match
  its Core table's required fields plus an `external_id` for idempotency.
- **Validation** happens before any write: required fields present,
  referenced classes/grades exist (or are created inline for classes,
  since a school's own class names won't match Core's `grade_id`/
  `stream_id` FKs automatically — see §5), duplicate `external_id`s within
  one batch rejected outright.
- **Upsert, not insert**: matching on `(school_id, school_integration_id,
  external_id)` means re-importing an updated roster corrects existing
  records instead of creating duplicates — this is what makes CSV import
  usable as an ongoing sync mechanism (schools re-export and re-upload
  periodically) rather than a one-time migration tool.
- **Partial success is a valid outcome**: if 40 of 45 rows in a class
  import succeed and 5 fail validation, the batch completes as `partial`
  with the 5 failures recorded in `school_integration_imports.errors` —
  it does not roll back the 40 good rows because 5 were malformed.

---

## 5. The Mapping Problem

A school's existing data won't speak Core's vocabulary — "Form 3 Blue" vs.
`grade_id`+`stream_id`, a home-grown subject list vs. Core's global
`subjects` catalogue, free-text guardian relationship strings vs. the
`learner_guardians.relationship` CHECK constraint. This is the part of
integration that can't be fully automated:

- **First import for a new school** requires a one-time mapping step:
  the school (or an EduNexus onboarding person) maps their grade/stream/
  subject names onto Core's canonical `grades`/`subjects`/their own
  `streams`/`classes`. This mapping is stored (`school_integrations.config`)
  and reused for every subsequent import from that connection.
  the mapping is stored (`school_integrations.config`) and reused for
  every subsequent import from that connection.
- **Unmapped values** (a subject name that doesn't match anything in the
  catalogue) surface as validation failures (§4), not silent guesses —
  consistent with every other module's "flag, don't assume" pattern
  throughout this project.

---

## 6. Relationship to the Migration Strategy

This pipeline is what makes [Phase 0](learning-intelligence-migration-strategy.md#phase-0--real-user-data-migration-new--the-gap-in-the-original-plan)
of the migration strategy executable, not just a stated intention:

```
School's existing data (CSV / API / connector)
        ↓
  School Integration Pipeline  (this document)
        ↓
  Core School Operating System  (schools/learners/school_users/classes/...)
        ↓
  Domain Models → LearnerContext  (migration strategy, Phases 3-4)
        ↓
  Learning Intelligence Layer  (migration strategy, Phases 5+)
```

For Phase 0 specifically, the real pioneer beta teachers' legacy
`students`/`teacher_classes` data can be run through this same pipeline
as a one-time `api_push` (or even a generated CSV export from the legacy
tables), rather than writing a separate one-off migration script — the
same validation/upsert/audit-trail machinery applies whether the source
is a real external school or EduNexus's own legacy tables.

---

## 7. Edge Cases

- **Duplicate school signs up twice**: `school_integrations` is
  many-per-school (a school could have both a CSV connection and a later
  API connection) — not a blocker, just tracked as separate integration
  records against the same `school_id`.
- **Import references a class that doesn't exist yet**: classes are
  created inline during import if the mapping (§5) resolves a valid
  `grade_id`/`stream_id`/`academic_year_id` combination that doesn't yet
  have a `classes` row — this is the one case where import *creates*
  Core structure rather than only upserting into existing structure,
  since real schools won't have pre-created their Core classes before
  their first import.
- **Revoked integration**: `school_integrations.status = 'revoked'`
  invalidates its API keys immediately (checked at auth time, not just at
  the UI level) but does not delete previously-imported data — imported
  rows remain in Core, only future imports through that connection are
  blocked.
- **Re-import after manual edits in EduNexus**: if a school admin
  hand-edited a learner's record in EduNexus after import, and the next
  CSV re-import contains conflicting data for the same `external_id`, the
  import overwrites it — last-write-wins, no merge logic. This is a
  known simplification (flagged, not silently hidden) rather than
  building conflict resolution before any real school has hit this case.

---

## 8. Module Boundaries

**In scope:** `school_integrations`, `school_integration_api_keys`,
`school_integration_imports`, the CSV/API ingestion pipeline, validation,
idempotent upsert, the grade/subject/stream mapping step.

**Explicitly out of scope:** Third-party OAuth connectors (Google
Classroom, Canvas, Moodle — deferred until requested), conflict resolution
for concurrent edits, real-time webhook receivers from external SIS
(the `custom_webhook` enum value exists for future use, no receiver built
now), any Learning Intelligence logic (this pipeline's job ends at Core
data being correctly populated).

**Data ownership:** This pipeline owns `school_integrations`,
`school_integration_api_keys`, `school_integration_imports`, and the
`external_id`/`school_integration_id` columns on `learners`/`classes`/
`learner_guardians`. It writes to but does not own `learners`/`classes`/
`learner_guardians`/`learner_enrollments` themselves (Core's existing
ownership per the Reference School's frozen Module 3 stands).

---

## Open items for review

1. **Onboarding UX for the mapping step (§5)** — should this be a
   guided UI (school admin walks through matching their grade names to
   Core grades) or an EduNexus-staff-assisted process for early schools,
   automated only once enough schools have gone through it manually to
   know the common patterns? Recommend starting staff-assisted, given
   there's no real school onboarded yet to design a self-serve UI against.
2. **Where do API keys get issued from** — a school admin dashboard
   (doesn't exist yet) or an internal EduNexus tool for now? Recommend
   internal tool for the first real schools, same reasoning as above.
3. Once resolved, this document is ready for the same freeze review the
   Reference School modules went through, before any schema/code work
   begins.
