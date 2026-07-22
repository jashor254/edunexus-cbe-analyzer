# Pilot Execution Sprint PE-4 — School Discovery Engine v1

**Classification**: Pilot Critical. **Status**: shipped, verified end-to-end against the real (staging) database. Supersedes PE-2's discovery CSV schema — see §7 for exactly what changed and why.

**What this is not**: no AI scoring, no ML, no scraping social media, no browser automation, no enrichment APIs, no paid integrations, no automation workflows. Deterministic scripts only, human review mandatory before anything reaches `growth_schools`.

---

## 1. Pipeline

```
Google Places (discover-schools.ts --county=<slug>|all)
  ↓ writes
Discovery CSV (one per county)
  ↓ founder reviews, flips ready_for_import to TRUE on schools worth contacting
(re-run any time: validate-review-csv.ts → fresh Summary Report)
  ↓
prepare-import.ts (filters ready_for_import = TRUE)
  ↓ writes
Import-ready CSV
  ↓
import-schools-csv.ts (writes to growth_schools, skips duplicates)
  ↓
Growth Engine (growth_schools table) → Mission Control
```

No step before the importer writes to the database.

---

## 2. Files Changed

**New — county configuration** (Part 2)
- `scripts/growth/config/types.ts` — `CountyConfig` type (`county`, `slug`, `towns`, `searchTerms`, optional `exclusions`).
- `scripts/growth/config/defaults.ts` — `DEFAULT_SEARCH_TERMS`, shared so the 9-term search-phrase list lives in exactly one place (CLAUDE.md: no duplicate constants).
- `scripts/growth/config/kirinyaga.ts`, `embu.ts`, `nyeri.ts`, `muranga.ts` — one file per county, each just towns + (shared) search terms.
- `scripts/growth/config/index.ts` — the registry (`COUNTY_CONFIGS`, `findCountyConfig()`, `availableSlugs()`). Adding a fifth county is "add a file + one line here," never a `discover-schools.ts` edit (Part 8 of PE-2's original mandate, now realized).
- `scripts/growth/config/config.test.ts` — 4 tests: every config non-empty, every slug lowercase/unique, lookup is case-insensitive, `availableSlugs()` matches the registry.

**Rewritten — CSV schema** (`scripts/growth/lib/schema.ts`)
- New column set: `name, county, town, category_guess, address, phone, website, email, google_rating, review_count, business_status, contact_source, google_maps_url, place_id, contact_quality, discovery_score, notes, ready_for_import` — matches PE-4 Part 8 exactly.
- `ready_for_import` (TRUE/FALSE, defaults FALSE) replaces PE-2's three-state `review_status` (pending/approved/rejected) — the one human decision this sprint's CSV asks for (Part 10).
- PE-2's CRM-adjacent columns (`priority`, `selection_reason`, `existing_ict_activity`, `first_contact_person`, `contact_verified`, `follow_up_needed`) are gone — those already exist on `growth_schools` itself (PO-1's Research Workflow fields) and are filled in through the Growth Engine UI after import, not duplicated in a discovery CSV. PE-4 is explicitly "discovery only, not CRM."

**Rewritten — scoring/classification** (`scripts/growth/lib/quality.ts`)
- `classifySchool()` (Part 4): 8 categories (`Junior Secondary`, `Academy`, `Girls`, `Boys`, `Mixed Day`, `Private Secondary`, `Public Secondary`, `Unknown`) instead of the old 4-value `guessCategory()`. Still a name-only heuristic — never claimed as certain.
- `computeDiscoveryScore()` (Part 5): +20 each for website / phone / email / Google rating present / review count > 10 — a *contactability* score, explicitly not a quality or fit score.
- `computeContactQuality()` (Part 7): High/Medium/Low/Unknown from how many of {phone, website, email} are present.
- `dedupKey()` + `normalizeSchoolName()` (Part 3): a second dedup layer beyond `place_id` — keys on phone, then website, then normalized name, catching the case where Google issues a distinct Place ID for the same real school.
- `buildResearchNotes()` (Part 11): specific auto-generated notes ("No website", "Website unreachable", "Email inferred", "Phone missing", "Currently closed (per Google)") joined into the single `notes` column, instead of one generic line.
- `summarizeDiscovery()` / `formatDiscoverySummary()` (Part 9): schools discovered, duplicates removed, missing phone/email, contact-quality distribution, ready-for-import count, closed schools, remaining duplicate phone/website/place-id groups, CSV path.

**Rewritten — `scripts/growth/discover-schools.ts`**
- `--county=<slug>` or `--county=all` CLI flag (Part 1); missing/unknown county prints usage and the valid slug list, exits 1 — no silent default.
- Google Place Details now also requests `opening_hours` (Part 6: "opening status if available"); `open_now === false` surfaces as a "Currently closed (per Google)" note.
- Email lookup now returns a `source` (`mailto` | `inferred` | `none`) and an `unreachable` flag, feeding `buildResearchNotes()`.
- Composite dedup (`dedupKey()`) runs after `place_id` dedup, incrementing a `duplicatesRemoved` counter.
- Writes both the CSV and a `<file>-summary.md` per county, and prints the summary to console immediately after each county — `--county=all` additionally prints a combined grand-total summary across all counties run.

**Updated — downstream pipeline**
- `scripts/growth/validate-review-csv.ts` — re-validates any (possibly hand-edited) discovery CSV, writes a fresh Summary Report.
- `scripts/growth/prepare-import.ts` — filters to `ready_for_import = TRUE` rows (was `review_status = approved`).
- `scripts/growth/import-schools-csv.ts` — checks `ready_for_import` instead of `review_status`; `notes` now maps to `growth_schools.notes` (PE-2's `research_notes` column is gone from the CSV); `selection_reason`/`existing_ict_activity` are inserted as `null` (filled in later via the Growth Engine UI, not collected at discovery time). `discovery_score`/`contact_quality` are **not** persisted — no `growth_schools` columns exist for them (no migration this sprint; see §5).

**Tests**
- `scripts/growth/lib/csv.test.ts` — unchanged, still 6/6 passing (CSV parsing is schema-agnostic).
- `scripts/growth/lib/quality.test.ts` — fully rewritten, 25 tests: classification (7), discovery score (3), contact quality (4), dedup (3), research notes (3), summary (3), covering every new scoring/classification rule.
- `scripts/growth/config/config.test.ts` — new, 4 tests (registry integrity).
- **33/33 tests pass.** `npx tsc --noEmit` and `npx eslint scripts/growth` both clean.

---

## 3. Verification (Part 10, Kirinyaga)

1. **CLI argument handling**: `--county=not-a-county` → prints the valid slug list, exits 1, no network call made. No `--county` flag at all → prints usage, exits 1. Both confirmed without spending an API call.
2. **Clean CSV + summary**: built a 4-row synthetic Kirinyaga-shaped CSV (1 ready-for-import Girls school with full contact info, 1 low-signal school with missing website/email, 1 Google-closed school, 1 school sharing a phone number with the first) standing in for a real Google Places run (no API key spent). `validate-review-csv.ts` correctly reported: 4 discovered, 1 missing phone, 3 missing email, contact-quality distribution High 1 / Low 2 / Unknown 1, 1 marked ready for import, 1 closed school flagged (not dropped), 1 duplicate-phone pair flagged.
3. **Deduplicated schools / ready_for_import gate**: `prepare-import.ts` correctly filtered to exactly the 1 `ready_for_import=TRUE` row.
4. **Real import, without touching other production data**: confirmed `growth_schools` had 0 rows beforehand. Ran the **actual** `import-schools-csv.ts` script (not a reimplementation) against the real Supabase project — it inserted the 1 approved school, attributed to the real founder row already in `growth_users` (no synthetic user needed this time). Re-ran the same command a second time: the place_id dedup guard correctly skipped it as a duplicate (`0 imported / 1 duplicates skipped`). Queried the row directly: `category` = `"Girls"` (new classifier), `pipeline_stage` = `research`, `status` = `active` — exactly what Mission Control's dashboard query (`growthRepos.schools.list()`) reads. Deleted the synthetic school row afterward by `google_place_id`; confirmed `growth_schools` back to 0 rows. The real founder's `growth_users` row was never touched.

---

## 4. Performance Impact

None to the running app — these are one-off scripts, not app runtime code. Discovery itself is bounded by Google's rate limits (250ms delay between Place Details calls, unchanged from PE-2) × (towns × search terms) per county; multi-county `--county=all` runs counties sequentially, so total wall time scales linearly with the number of counties selected — acceptable for a tool a founder runs occasionally, not continuously.

---

## 5. Technical Debt

- `discovery_score` and `contact_quality` are CSV-only artifacts — not persisted to `growth_schools` (no migration this sprint, since neither the mission nor CLAUDE.md's process approved one). If the founder later wants to sort/filter the Growth Engine UI by contactability post-import, that would need a deliberate follow-up migration, not an oversight to silently "fix."
- Embu/Nyeri/Murang'a town lists are seeded from general knowledge of each county's well-known towns, not independently verified against a canonical source — same caveat as Kirinyaga's original list (PE-2), easy to edit in each county's config file if a town is missing or misspelled.
- `buildResearchNotes()`'s "Website unreachable" and "Email inferred" signals both depend on a single fetch of the school's homepage — a slow-but-working site could occasionally time out and be misreported as unreachable. Same best-effort tradeoff PE-2 already accepted for `bestEffortEmail()`.
- `--county=all` runs every configured county in one process; there's no `--county=kirinyaga,embu` (comma-separated subset) — not requested, easy to add later if needed.

---

## 6. Rollback Strategy

- **Config files**: purely additive, deleting `scripts/growth/config/` reverts to a single-county script — but `discover-schools.ts` now imports from it, so a full rollback means reverting `discover-schools.ts` to its PE-2 shape too (in git history).
- **Schema/scoring changes**: all CSV-only, no database migration this sprint — reverting `lib/schema.ts`/`lib/quality.ts` to their PE-2 versions has zero data-loss risk, nothing is persisted beyond the CSV files on disk.
- **Downstream scripts**: `validate-review-csv.ts`/`prepare-import.ts`/`import-schools-csv.ts` changes are all additive field renames (`review_status`→`ready_for_import`, `research_notes`→`notes`) — reverting is a straight file revert with no schema implication, since `growth_schools` itself was not changed this sprint.
- **Imported data**: every row the importer writes is a normal `growth_schools` row, editable/deletable through the existing Growth Engine UI exactly like a hand-added school.
