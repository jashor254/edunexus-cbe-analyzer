# Pilot Discovery Engine

**Sprint**: Pilot Execution Sprint PE-2. **Classification**: Pilot Critical. **Status**: shipped, verified end-to-end against the real (staging) database with synthetic data, cleaned up after.

**What this is not**: no AI scoring, no lead scoring, no automatic emails/WhatsApp, no CRM automation, no social scraping, no browser automation, no direct database writes from discovery. Every step up to founder approval only ever touches CSV files on disk.

---

## 1. Pipeline

```
Google Places (discover-schools.ts)
  ↓ writes
Master Review CSV
  ↓ founder edits review_status/priority/notes by hand
(re-run any time: validate-review-csv.ts → Validation Report)
  ↓
prepare-import.ts (filters review_status = approved)
  ↓ writes
Import-ready CSV
  ↓
import-schools-csv.ts (writes to growth_schools, skips duplicates)
  ↓
Growth Engine (growth_schools table)
  ↓
Mission Control (`app/(growth)/growth/page.tsx`, reads via `growthRepos.schools.list()`)
```

No step before the importer writes to the database. Human approval (setting `review_status` to `approved` in the CSV) is the only gate between discovery and import.

---

## 2. Files Changed / Added

**Migration**
- `supabase/migrations/20260725100000_growth_discovery_engine_fields.sql` — additive columns on `growth_schools`: `phone`, `website`, `email`, `google_place_id`, `google_maps_url`, `google_rating`, `google_review_count`, `business_status`, plus a partial unique index on `google_place_id`. Applied to the project.

**Domain layer** (`lib/growth/`, per CLAUDE.md — all DB access stays here, scripts never call Supabase directly)
- `types.ts` — `GrowthSchool`/`NewGrowthSchool` carry the 8 new fields.
- `repositories/school.repository.ts` — `SCHOOL_COLS`/`SchoolInsert` extended; new `findByPlaceId()` (the importer's primary dedup key).
- `repositories/growthUser.repository.ts` — new `findSole()`: the importer runs as a script with no authenticated caller, so it resolves the one Mode-1 founder row instead of trusting an unverified id.
- `services/schools.ts` — `createSchool()` passes the new fields through.

**Scripts** (`scripts/growth/`)
- `lib/csv.ts` — shared quote-everything CSV read/write (no new dependency; RFC4180-ish, handles embedded commas/quotes/BOM).
- `lib/schema.ts` — the one CSV column schema every script shares (`REVIEW_CSV_HEADER`), so discover/validate/prepare/import can never drift out of sync with each other.
- `lib/quality.ts` — `computeConfidence()` (Part 4) and `validateRows()`/`formatValidationReport()` (Part 5).
- `discover-schools.ts` — rewritten: 9 search terms × 9 Kirinyaga towns, all founder-review + quality columns, closed listings kept (not discarded) and flagged instead.
- `validate-review-csv.ts` — new. Reads any (possibly hand-edited) master CSV, writes a Validation Report next to it.
- `prepare-import.ts` — new. Filters a reviewed CSV to `review_status = approved` rows only, writes the import-ready CSV.
- `import-schools-csv.ts` — new. Imports approved rows, dedupes by `google_place_id` then fuzzy name, never overwrites, prints an Import Summary.

**Tests**
- `scripts/growth/lib/csv.test.ts` (6 tests) — quoting, embedded commas/quotes, BOM stripping, record-keying.
- `scripts/growth/lib/quality.test.ts` (8 tests) — all three confidence cases, duplicate detection, missing-field counts, closed-school retention, approved/confidence-distribution counting.
- All 14 pass (`npx tsx --test scripts/growth/lib/csv.test.ts scripts/growth/lib/quality.test.ts`). `npx tsc --noEmit` and `npx eslint scripts/growth lib/growth` both clean.

**package.json** — 3 new scripts: `growth:validate-schools`, `growth:prepare-import`, `growth:import-schools` (alongside the existing `growth:discover-schools`).

---

## 3. CSV Schema

24 columns, in this order (`scripts/growth/lib/schema.ts`):

| Group | Columns |
|---|---|
| Discovery (Part 2) | `name, county, town, address, phone, website, email, google_maps_url, place_id, contact_source, google_rating, review_count, business_status, category_guess` |
| Quality (Part 4) | `confidence, confidence_reason` |
| Founder review (Part 3) | `review_status, priority, research_notes, selection_reason, existing_ict_activity, first_contact_person, contact_verified, follow_up_needed` |

`review_status` defaults to `pending`; every other review column defaults blank. Nothing is ever inferred into a review column.

---

## 4. Validation Rules (Part 5)

Computed over the full row set, reported, **never** used to drop a row from the CSV:
- Duplicate phone numbers / websites / Google Place IDs (grouped by value, reported with the school names sharing it)
- Missing phone / missing website / missing email (counts)
- Schools marked `CLOSED_PERMANENTLY` or `CLOSED_TEMPORARILY` by Google (listed by name)
- Confidence distribution (High / Medium / Low counts)

Confidence rule (Part 4, exactly as specified — never invented beyond these three cases):
- **High**: has both a website and a phone number ("Official website + phone + Google listing.")
- **Medium**: phone only, or website only
- **Low**: neither ("Name only — no verified phone or website.")

---

## 5. Importer Behavior (Part 7)

For each row in the import-ready CSV:
1. Skip (as `rejected`) if `review_status` isn't `approved` — belt-and-braces re-check even though `prepare-import.ts` already filtered.
2. Skip (as `invalid`) if `name` is blank.
3. Skip (as `duplicate`) if `google_place_id` matches an existing `growth_schools` row.
4. Skip (as `duplicate`) if a fuzzy name match exists (reuses the same `findByNameFuzzy()` the UI's "Add School" form already uses).
5. Otherwise insert, attributed to the sole `growth_users` founder row (`findSole()`).

Prints an Import Summary in the sprint's exact format: `N rows reviewed / N imported / N duplicates skipped / N rejected / N invalid`, plus the list of skipped duplicates/invalid rows.

---

## 6. Part 8 — Expansion to a New County

Change exactly `COUNTY`, `AREAS`, `SEARCH_TERMS` at the top of `discover-schools.ts`. No other file changes — every downstream script (validate/prepare/import) is county-agnostic; it only ever reads the CSV schema, never `COUNTY` itself.

---

## 7. Verification (Part 10)

Ran the full pipeline against a hand-built 4-row sample CSV (1 approved, 1 rejected, 1 pending, 1 duplicate-phone row, 1 closed school) standing in for a real Google Places run (no API key was spent):

1. `validate-review-csv.ts` correctly reported: 4 discovered, 1 approved, 1 duplicate phone pair, 1 closed school, confidence distribution High 1 / Medium 2 / Low 1.
2. `prepare-import.ts` correctly filtered to exactly the 1 approved row.
3. Ran the importer's exact insert/dedup logic against the **real Supabase project** (confirmed `growth_schools` had 0 rows beforehand): created a synthetic founder, imported the 1 approved school, re-ran the `google_place_id` dedup check (confirmed it now finds the row), confirmed the imported row appears in `growthRepos.schools.list()` — the same query Mission Control's dashboard reads — with `pipeline_stage=research, status=active` as expected for a freshly-imported school. Deleted the synthetic school, founder, and auth user afterward; confirmed both `growth_schools` and `growth_users` are back to 0 rows.

---

## 8. Technical Debt

- `import-schools-csv.ts` does one dedup round-trip (2 queries) per row rather than batching — acceptable at CSV-import volumes (tens to low hundreds of rows per run, run rarely), but would need batching (`.in()`) if county-wide imports ever reach four figures.
- `bestEffortEmail()` (unchanged from the original script) fetches each school's homepage HTML directly with a regex — no change from before this sprint; still the cheapest option for "best effort," still not reliable.
- No automated test exercises `discover-schools.ts`'s Google Places calls or `import-schools-csv.ts`'s DB writes directly (both require live external services); coverage is at the pure-function layer (`quality.ts`, `csv.ts`) plus the manual end-to-end verification in §7. A future pass could add a `mock fetch` test for the Places pagination loop if that logic grows more complex.

---

## 9. Rollback Strategy

- **Migration**: `drop index if exists growth_schools_google_place_id_idx; alter table growth_schools drop column phone, drop column website, drop column email, drop column google_place_id, drop column google_maps_url, drop column google_rating, drop column google_review_count, drop column business_status;` — safe at any time, no other object depends on these columns.
- **Scripts**: all new files under `scripts/growth/`; deleting them (and the 3 new `package.json` script entries) fully reverts this sprint's tooling with no effect on any other part of the app.
- **Imported data**: every row the importer writes is a normal `growth_schools` row, editable/deletable through the existing Growth Engine UI exactly like a hand-added school — no special "imported" state to migrate away from.
