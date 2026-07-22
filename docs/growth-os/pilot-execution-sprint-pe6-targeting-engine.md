# Sprint PE-6 — Pilot Targeting Engine

**Classification**: Pilot Critical. **Status**: shipped, verified against real Supabase data (synthetic rows, created and cleaned up — `growth_schools` was and remains empty pending the founder's own `ready_for_import` review).

**Operating principles honored**: every point on the Founder Priority Score is a named, visible factor (`lib/growth/targeting/score.ts`'s `SCORE_POINTS`); no school is ever filtered out of the ranked list, only reordered; nothing is auto-rejected; the founder's own star always wins.

---

## 0. A Real Blocker, Surfaced First

PE-6 asks to "run against the existing imported schools" and demonstrate ranking behavior on them. `growth_schools` had 0 rows at the start of this sprint — the enriched Kirinyaga CSV from PE-5v2 was never actually imported; Phase 2's manual `ready_for_import` review (from the earlier "First Real Discovery Run" sprint) was paused, not completed. Flagged this to the founder before building anything; they chose to do that review themselves and import when ready. The targeting engine below is built and fully tested (unit + real-DB integration with synthetic rows) so it works correctly the moment real rows exist — no further code changes needed once the founder's import lands.

---

## 1. Database Changes (additive only, applied)

`supabase/migrations/20260722100000_growth_targeting_engine_fields.sql` — 4 new columns on `growth_schools`:

| Column | Why |
|---|---|
| `whatsapp_number` | PE-5v2's enrichment CSV already finds this (wa.me links); PE-6 names "Has WhatsApp" as an explicit, distinct scoring factor — needed a home once imported. |
| `discovery_score` | PE-4's 0-100 contactability heuristic, computed at discovery time but deliberately not persisted then. PE-6 lists it as a scoring input. |
| `contact_quality` | PE-4's High/Medium/Low/Unknown completeness label — same story. |
| `starred` | The one genuinely new piece of state this sprint adds (Manual Boost) — a founder override that can't be derived from anything else. |

Applied directly to the live project after confirming `growth_schools` was empty (0 rows, so zero migration risk).

---

## 2. Architecture

```
lib/growth/targeting/
  types.ts       — ScoreFactor, FounderPriorityScore, SchoolTargetingContext, TargetedSchool, RouteStep
  score.ts       — computeFounderPriorityScore() — the only place points are awarded, fully documented
  nextAction.ts  — deriveNextAction() — one concrete next step per school
  route.ts       — buildTodaysRoute() — sequencing (not navigation) over the top-ranked schools
lib/growth/services/targeting.ts   — orchestrator: batches growth_schools/contacts/follow_ups/activities
                                      (no query-in-a-loop), computes every school's score, sorts, builds the route
app/api/growth/targeting/route.ts  — GET, gated by requireGrowthUser like every other Growth OS route
app/(growth)/growth/page.tsx       — Mission Today rewritten to render ranked school cards + Today's Route +
                                      quick filters + a full inspectable list + manual ⭐ starring
```

Each scoring/next-action/route module is a pure function over plain data — independently unit-testable without a database, and the one place the mission's "no hidden scoring" rule is enforced structurally (a factor can't be awarded without appearing in the returned `factors` array).

---

## 3. Founder Priority Score (0-100, every point named)

```
Contactability:      phone +15, WhatsApp +15, email +5, website +5
Research quality:    selection reason +10, existing ICT activity +10, both present (bonus) +5
Discovery signal:    discovery_score >= 60 +10, contact_quality High +5
Momentum:            no outreach yet (fresh) +10, follow-up overdue +20, in discovery stage +10,
                     demo scheduled/completed +15, pilot interest expressed +20
Manual Boost:        ⭐ founder starred +25
```

Capped at 100. Buckets (rule-based thresholds, not ML): `score >= 70` → 🔥 Contact Today, `>= 45` → 📅 Schedule This Week, `>= 20` → ⏳ Waiting, else → 🚫 Low Priority. **A starred school is always 🔥 Contact Today regardless of its numeric score** — the mission's "these always appear near the top" is enforced as a bucket override, not just a point bonus, and the ⭐ factor line in the UI explains why a lower score can still show the top bucket.

---

## 4. Mission Today, Today's Route, Filters, Manual Boost

- **Mission Today** now shows up to 6 ranked school cards (🔥/📅 only), each with bucket, score, every satisfied "why" factor, and a concrete next action — matching the mission's own worked example format exactly.
- **Today's Route**: a numbered sequence (not navigation) over the same ranked schools, one action type (WhatsApp/Call/Email/Physical Visit) and a rough time estimate (2/5/3/20 min) per stop.
- **Quick filters**: Public, Private, Junior Secondary, Secondary, Has WhatsApp, Has Phone, Needs Visit, Research Complete, Contacted, Discovery, Demo, Pilot — client-side, multi-select (AND), applied over the full school list, never hiding anything permanently (toggle off to see everyone again).
- **Full ranked list**: every active school, always visible (never hidden, per the mission), each row expandable to show its complete factor breakdown — "no black box."
- **Manual Boost**: a ⭐ button on every card/row, `PATCH /api/growth/schools/[id]` with `{ starred }` (reused the existing generic schools PATCH route + `updateSchoolSchema`, no new endpoint needed).

---

## 5. Verification

**Unit tests** (`lib/growth/targeting/{score,nextAction,route}.test.ts`, 18 tests):
- **The mission's explicit requirement, proven directly**: "a school with verified phone + WhatsApp scores strictly higher than one with no usable contact method."
- Every point traceable to a factor (`score === sum of satisfied factors' points`), capped at 100.
- Starred forces 🔥 Contact Today even at a near-zero raw score, and the score itself isn't silently inflated.
- Next-action phrasing: overdue follow-up beats pilot/demo/discovery beats fresh-contact channel selection (WhatsApp > Call > Email > research) beats already-contacted follow-up phrasing; contact name/role used when known.
- Today's Route: channel selection priority, excludes ⏳/🚫 buckets, respects a max-steps cap, numbered from 1.

**Integration tests against the real database** (`lib/growth/services/targeting.integration.test.ts`, 3 tests, synthetic rows created and cleaned up):
- A real phone+WhatsApp school outranks a real no-contact school (both appear — never hidden).
- A real starred-but-bare school sorts before a real higher-scoring unstarred school.
- Today's Route only includes actionable schools, correctly numbered.

All 3 pass against the live Supabase project. `growth_schools` confirmed at 0 rows before and after (real founder's `growth_users` row untouched).

`npx tsc --noEmit`, `npx eslint`, and `npx next build` all clean. 78 pure-logic tests pass across the whole `lib/growth`/`scripts/growth` tree (18 new this sprint).

---

## 6. Files Changed

- **New migration**: `supabase/migrations/20260722100000_growth_targeting_engine_fields.sql`.
- **New**: `lib/growth/targeting/{types,score,nextAction,route}.ts` + matching `.test.ts` files.
- **New**: `lib/growth/services/targeting.ts` + `targeting.integration.test.ts`.
- **New**: `app/api/growth/targeting/route.ts`.
- **Extended**: `lib/growth/types.ts` (4 new `GrowthSchool` fields, `NewGrowthSchool`, `GrowthSchoolPatch.starred`), `lib/growth/repositories/school.repository.ts` (`SCHOOL_COLS`, `SchoolInsert`, `SchoolUpdate`), `lib/growth/repositories/contact.repository.ts` (new `listFirstContactPerSchool()`, batched — no query-in-a-loop), `lib/growth/services/schools.ts` (carries the 3 new insert fields + `starred` patch through), `lib/growth/validation/schools.ts` (`starred` on `updateSchoolSchema`).
- **Extended**: `scripts/growth/import-schools-csv.ts` — carries `whatsapp_number` through from the PE-5v2 enriched CSV (optional field, plain PE-4 CSV still imports fine without it).
- **Rewritten**: `app/(growth)/growth/page.tsx` — Mission Today section, Today's Route, filters, full list, star toggle. Sections 2 (Mission Progress) through 8 (Platform Admin) are unchanged from PE-3/PE-2.5.

---

## 7. Technical Debt

- **"Physical Visit" has no address to route to.** `growth_schools` has no address column (only the discovery CSV had one, never persisted) — Today's Route can recommend a visit as the channel of last resort, but can't tell the founder where to go. If this becomes a real friction point, adding an `address` column would need its own small migration.
- **Labeled principal/deputy/ICT/admissions names aren't yet wired into scoring.** PE-5v2's enrichment can find these, but no `growth_contacts` row is auto-created from them, and the Founder Priority Score doesn't currently look at contact *names* for scoring (only for next-action phrasing, via `growth_contacts`). A future pass could treat "principal name known" as its own factor.
- **Discovery-score/contact-quality overlap with the discrete phone/website/email factors is real and intentional**, not hidden — both are named line items in the mission's own factor list, so both are kept and labeled, accepting that a school can earn points for the same underlying fact twice (once for having a phone, again via a high discovery score that phone contributed to). Documented in `score.ts`'s top comment.
- **Filters are client-side over the already-fetched full list** — fine at Growth Engine's real scale (a handful of counties, hundreds of schools), would need server-side filtering/pagination if that scale changes by an order of magnitude.

---

## 8. Rollback Strategy

- **Migration**: `alter table growth_schools drop column whatsapp_number, drop column discovery_score, drop column contact_quality, drop column starred;` — safe at any time, no other object depends on these columns, and (at time of writing) zero rows exist to lose data from.
- **Code**: `lib/growth/targeting/`, `lib/growth/services/targeting.ts`, and `app/api/growth/targeting/` are all new, additive files — deleting them plus reverting `app/(growth)/growth/page.tsx` to its pre-PE-6 version (in git history) fully restores the PE-3 Mission Today behavior with zero schema implication (the 4 new columns can stay or go independently of the UI).
- **Importer**: `scripts/growth/import-schools-csv.ts`'s `whatsapp_number` read is optional and additive — reverting it has no effect on any CSV that doesn't have that column.
