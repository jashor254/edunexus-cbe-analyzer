-- Pilot Operations Sprint PO-1 — Pilot Acquisition Engine (Pilot Critical)
--
-- Additive only. Extends the existing growth_schools table (no new table)
-- with the three research-capture fields docs/growth-os/
-- pilot-acquisition-engine.md's Research Workflow names as useful and not
-- already captured anywhere: contact source, existing ICT activity, and
-- why this school was selected. All three are nullable free text — no
-- scoring, no enum, no required backfill for the schools that already
-- exist without them.

alter table growth_schools
  add column if not exists contact_source text,
  add column if not exists existing_ict_activity text,
  add column if not exists selection_reason text;

-- Rollback: `alter table growth_schools drop column contact_source, drop
-- column existing_ict_activity, drop column selection_reason;` — safe at
-- any time, no other object depends on these columns, no data is lost
-- except the research notes themselves (acceptable rollback cost, same as
-- dropping any other free-text notes field).
