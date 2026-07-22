-- Sprint PE-6 — Pilot Targeting Engine (Pilot Critical)
--
-- Additive only. Four new nullable/defaulted columns on growth_schools:
--
--   whatsapp_number  — PE-5v2's enrichment CSV already discovers this
--                      (wa.me links), but growth_schools had nowhere to
--                      store it; "Has WhatsApp" is an explicit, distinct
--                      Founder Priority Score factor (PE-6's own Input
--                      section: "Discovery CSV fields already imported").
--   discovery_score  — PE-4's 0-100 contactability heuristic, computed at
--                      discovery time but never persisted (PE-4 explicitly
--                      called it CSV-only). PE-6 lists it as a scoring
--                      input, so it now needs a home once a school is
--                      imported.
--   contact_quality  — PE-4's High/Medium/Low/Unknown completeness label,
--                      same story as discovery_score.
--   starred          — Sprint PE-6 Part "Manual Boost": the one piece of
--                      state in this sprint that is genuinely new
--                      (founder-only, cannot be derived from anything
--                      else), not a re-import of already-computed data.

alter table growth_schools
  add column if not exists whatsapp_number text,
  add column if not exists discovery_score int,
  add column if not exists contact_quality text,
  add column if not exists starred boolean not null default false;

-- Rollback: `alter table growth_schools drop column whatsapp_number, drop
-- column discovery_score, drop column contact_quality, drop column
-- starred;` — safe at any time, no other object depends on these columns.
