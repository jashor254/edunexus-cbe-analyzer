# Sprint PE-5 — School Discovery Engine v2 (Contact Enrichment)

**Classification**: Pilot Critical. **Status**: shipped, verified on an 8-school sample, then run against the full real 196-school Kirinyaga discovery CSV. CSV generation only — no database writes, no imports, exactly as scoped.

**Operating principles honored**: never invented a value; every extracted value carries a source type + source URL; human review still required before anything is imported; `ready_for_import` was never touched.

---

## 1. Input

`scripts/growth/output/kirinyaga-schools-2026-07-22-annotated.csv` (the 196-school real discovery output from the prior sprint, plus its `flag_reason` review column) — used as-is, source of truth. No re-query of Google Places.

---

## 2. Architecture (modular, per the mission)

```
scripts/growth/enrich/
  types.ts               — SourceType, Confidence, SourcedValue, PageExtraction, EnrichmentResult
  contactExtraction.ts   — pure regex extractors (email/phone/WhatsApp/Facebook/Instagram/LinkedIn/labeled names)
  confidence.ts          — Verified/High/Medium/Low/Unknown rules
  websiteEnrichment.ts   — candidate URL builder (pure) + best-effort homepage/contact/about crawler
  facebookEnrichment.ts  — best-effort public Facebook page fetch (phone/email/WhatsApp/Messenger only)
  enrichSchool.ts         — orchestrates Steps 1-4 for one school row
  report.ts              — quality report (pure, testable without network)
scripts/growth/enrich-contacts.ts   — CLI: reads CSV, runs enrichment, writes enriched CSV + report
scripts/growth/lib/csv.ts           — extended with readCsvTable()/writeCsvTable() (header-agnostic, so this
                                       script works on either the plain discovery CSV or the annotated one)
```

Each concern is independently testable and reusable — Embu/Nyeri/Murang'a/Meru enrichment runs are `npm run growth:enrich-contacts -- <their-csv>`, no code change.

---

## 3. Enrichment Rules (exactly as specified)

- **Step 1**: if a website exists, crawl homepage + `/contact`, `/contact-us`, `/about`, `/about-us` (best-effort — a 404/timeout on one candidate isn't a failure of the whole crawl). Extract email/phone/WhatsApp/Facebook/Instagram/LinkedIn/principal/deputy/ICT/admissions from each page independently, each value keeping its exact source page.
- **Step 2**: `official_email` is only searched for if the original CSV's `email` column was blank. If it already had a value, the crawl only ever *cross-confirms* it (→ `Verified`) — never surfaces a differing "second guess" email.
- **Step 3**: `official_phone` — website first; Facebook is only ever consulted as a fallback, and only when the original CSV had no phone **and** the website crawl found none either.
- **Step 4**: Facebook extraction is structurally limited to phone/email/WhatsApp/Messenger-availability regexes over the page's plain HTML — there is no post/comment/follower scraping capability in the code at all, not just by policy.
- **Step 5 (Google Maps re-verification)**: **not implemented this pass** — deliberately deferred, see §6 Technical Debt.
- **Confidence**: Verified (cross-confirmed) > High (dedicated contact page) > Medium (homepage/about) > Low (Facebook) > Unknown (nothing found). One `contact_confidence` column per row, the best confidence among whatever was actually found.
- **Never overwrite**: verified against the real output — 0 mismatches when diffing every original column (`name`, `phone`, `email`, `website`, `ready_for_import`, `flag_reason`, …) between the input and output CSVs across all 196 rows.

---

## 4. New CSV Columns (exactly as specified, appended after the input's existing columns)

`official_email, official_phone, whatsapp_number, facebook_url, contact_page, principal_name, deputy_name, ict_contact, admissions_contact, email_source, phone_source, website_source, facebook_source, contact_confidence, last_verified`

---

## 5. Verification

**8-school sample first** (per the mission's explicit gate — "do not execute the full enrichment until the sample output looks correct"):
- Bridge International Academy - Kutus: already had an email → crawl found the *same* email on the official site → `Verified`.
- Bridge International Academy - Ndorome: no original email → crawl found one on the shared corporate site → `Medium` (not cross-confirmed).
- Both Bridge branches picked up a Facebook URL from the site footer.
- Schools with no real contact page correctly showed `Unknown` rather than a guessed value.
- Reviewed and approved before proceeding to the full run.

**Full 196-school run** (real Kirinyaga discovery data, no mocks):
- 0 mismatches in every pre-existing column, confirmed by diffing input vs. output.
- Every `official_email`/`official_phone` value cross-checked by hand against its `*_source` URL — all traceable, all cross-confirmations correct (`Kirinyaga University`, `MWEA APEX COLLEGE`, `New Era Complex`, `Rapids Camp`, `SAGANA TECHNICAL TRAINING INSTITUTE` all correctly landed on `Verified` because their crawled email matched what discovery already had).
- One real data-quality finding surfaced by the crawl itself, not invented: "Co-op Kwa Jirani Kirinyaga Plains Academy Ltd" — its `website` field (from discovery) points to Co-op Bank's corporate site, and the crawl faithfully extracted Co-op Bank's own `customerservice@co-opbank.co.ke` from it. This row was already flagged `suspected website mismatch` in Phase 2's review — that flag carried through untouched, so a human reviewing this row sees both signals together, not a false confidence.

`npx tsc --noEmit`, `npx eslint scripts/growth`, and `npx tsx --test` across `scripts/growth/**/*.test.ts` (60 tests) all clean.

---

## 6. Quality Report (real numbers, Kirinyaga, 2026-07-22)

```
Schools processed: 196
Schools enriched (gained at least one new contact fact): 9
Emails added: 5
Phones added: 0
WhatsApp numbers found: 1
Facebook pages found: 9
Principal names found: 0
ICT contacts found: 0
Manual review required (some contact info, but low/unknown confidence): 90
Still missing all contact methods: 95

Before vs After
Email coverage: 7/196 -> 12/196
Phone coverage: 101/196 -> 101/196 (unchanged — see below)
```

**Honest read of these numbers**: the enrichment yield is modest, and that is itself the sprint's most important real finding, not a bug. Most Kirinyaga secondary school websites (where they exist at all) are single sparse pages with no dedicated `/contact` page, and Facebook's unauthenticated-fetch response is almost always a stripped login-wall page with no usable contact info in the raw HTML — both of these were flagged as expected-low-yield risks in the code's own comments before the run, and the real run confirmed it. Phone coverage didn't move at all because Step 3's Facebook fallback only triggers when *both* the original CSV and the website crawl have zero phone — a narrow, correctly-conservative condition per the mission's rules, and one that essentially never fired here since 101/196 schools already had a phone from Google Places, and among the remainder, none had a website *and* a discoverable Facebook link with a phone number sitting in plain HTML.

Full report: `scripts/growth/output/contact-enrichment-report.md`. Enriched CSV: `scripts/growth/output/kirinyaga-schools-2026-07-22-enriched.csv`.

---

## 7. Files Changed

- **New**: `scripts/growth/enrich/{types,contactExtraction,confidence,websiteEnrichment,facebookEnrichment,enrichSchool,report}.ts` + matching `.test.ts` files (except `enrichSchool.ts`, which is network-dependent and validated via the sample/full runs instead of a mocked unit test).
- **New**: `scripts/growth/enrich-contacts.ts` (CLI).
- **Extended**: `scripts/growth/lib/csv.ts` — added `readCsvTable()`/`writeCsvTable()` (header-preserving, schema-agnostic), plus 2 new tests in `csv.test.ts`.
- **`package.json`**: added `growth:enrich-contacts` script.
- No changes to `discover-schools.ts`, `validate-review-csv.ts`, `prepare-import.ts`, `import-schools-csv.ts`, or any `lib/growth/` domain code — this sprint is additive tooling only, per its own "no production database writes, no imports" scope.

---

## 8. Technical Debt

- **Step 5 (Google Maps re-verification) is not implemented.** The mission itself frames it as conditional ("if Google Maps contains newer information") and this sprint separately says "do not query Google Places again unless absolutely necessary" — the two together read as "build this only if it's needed," and nothing in the 196-school run surfaced a case where it would have mattered. If a future run needs it, it's a bounded addition: one Place Details call per row behind an opt-in `--recheck-places` flag, comparing against `phone`/`website`, never auto-applying.
- **Facebook enrichment has a near-zero real hit rate** by design of Facebook's own anti-scraping posture, not a bug in this code — a plain unauthenticated `fetch()` almost never sees a page's real contact info. If this ever needs to materially improve, the honest options are the Facebook Graph API (requires app review + a business's permission) or a headless browser (explicitly out of scope per PE-4's non-goals) — neither was pursued here since PE-5v2's own scope is "no paid integrations, no browser automation, no enrichment APIs."
- **Labeled-name extraction (principal/deputy/ICT/admissions) found zero matches across all 196 real schools.** This is consistent with the sites actually crawled (very few have any staff-directory-style page at all), but it also means this part of the engine is effectively unverified against a real positive case — the unit tests exercise it against canned HTML, not a real page that actually contains a labeled name. Worth a targeted look if a specific school known to list its principal by name is ever found, to confirm the extractor really does fire correctly in the wild.
- **`Co-op Kwa Jirani Kirinyaga Plains Academy Ltd`-style mismatches remain possible** — the engine faithfully extracts whatever a `website` field points to; if that field itself is wrong (a Google Places mismatch from Phase 2), enrichment will confidently return real-but-wrong contact info. This is exactly why `flag_reason` carries through untouched and confidence is never inflated to `Verified` in these cases (no cross-confirmation exists) — but it is still a real risk a human must catch, not something the pipeline can catch for itself.

---

## 9. Rollback Strategy

- All of this sprint's code is new, additive files (`scripts/growth/enrich/`, `scripts/growth/enrich-contacts.ts`) plus two new pure functions in `lib/csv.ts` — deleting them has zero effect on any other script in the pipeline (`discover-schools.ts` through `import-schools-csv.ts` never call anything in `enrich/`).
- The enriched CSV is a separate output file (`*-enriched.csv`) — the original discovery/annotated CSVs are untouched and remain the ones `prepare-import.ts`/`import-schools-csv.ts` would use if the founder chooses not to adopt the enriched version at all.
- No database or `ready_for_import` state changed — rollback of this sprint has no data-loss risk of any kind, only files on disk.
