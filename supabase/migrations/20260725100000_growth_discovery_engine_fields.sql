-- Pilot Execution Sprint PE-2 — Pilot Discovery Engine (Pilot Critical)
--
-- Additive only. Extends growth_schools with the fields the Google Places
-- discovery workflow (scripts/growth/discover-schools.ts) collects but the
-- table previously had nowhere to store: phone/website/email are currently
-- only representable per-contact (growth_contacts, which requires a
-- full_name we usually don't have from Places), and there was no way to
-- dedupe an import against a Google Place ID at all.
--
-- google_place_id gets a partial unique index so the importer's dedup check
-- is enforced at the database level too, not just in application code.

alter table growth_schools
  add column if not exists phone text,
  add column if not exists website text,
  add column if not exists email text,
  add column if not exists google_place_id text,
  add column if not exists google_maps_url text,
  add column if not exists google_rating numeric(2, 1),
  add column if not exists google_review_count int,
  add column if not exists business_status text;

create unique index if not exists growth_schools_google_place_id_idx
  on growth_schools (google_place_id)
  where google_place_id is not null;

-- Rollback: `drop index if exists growth_schools_google_place_id_idx;
-- alter table growth_schools drop column phone, drop column website, drop
-- column email, drop column google_place_id, drop column google_maps_url,
-- drop column google_rating, drop column google_review_count, drop column
-- business_status;` — safe at any time, no other object depends on these
-- columns.
