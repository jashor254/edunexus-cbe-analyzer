-- 20260810174500_restore_erasure_attribution_immutability.sql
--
-- Forward-only. Fixes ONE defect. Touches ONE function.
--
-- ── THE DEFECT ───────────────────────────────────────────────────────────
-- `enforce_evidence_lifecycle_transition()` has carried an "already erased"
-- guard since 20260713190000_phase_minus1_evidence_foundation.sql (recorded
-- live as version 20260714021548). That guard has never once executed.
--
-- A second erasure of an already-erased row writes lifecycle_state = 'erased'
-- onto a row whose lifecycle_state is ALREADY 'erased'. The function's first
-- statement is a same-state early return:
--
--     IF NEW.lifecycle_state = OLD.lifecycle_state THEN RETURN NEW; END IF;
--
-- 'erased' = 'erased', so it returns before reaching the guard below it. The
-- guard is unreachable for the only case it was written to catch.
--
-- `enforce_evidence_immutability()` does not catch it either, and correctly
-- so: its `is_erasure` flag is (OLD.lifecycle_state <> 'erased' AND
-- NEW.lifecycle_state = 'erased'), which is FALSE on a second erase, and the
-- fields it then guards (extracted_name / extracted_external_id / score /
-- payload) were already nulled by the FIRST erasure — so the second write is
-- IS NOT DISTINCT FROM on every one of them and nothing raises.
--
-- `erased_by`, `erased_at` and `erasure_reason` are protected by neither
-- function. Measured consequence (reproduced twice against a learner-detached
-- synthetic row): the second erasure SUCCEEDS and overwrites all three.
-- The append-only evidence_audit_log still records both erasures, so the
-- true attribution remains recoverable — but the row itself misreports who
-- erased it, when, and why.
--
-- This is NOT migration drift. Every historical CREATE OR REPLACE of both
-- functions correctly carried its predecessors forward, and the live
-- definitions are the exact union of every repository change. Nothing was
-- ever lost. This is a control-flow ordering bug that shipped broken.
--
-- ── WHAT THIS MIGRATION DOES ─────────────────────────────────────────────
-- Reproduces the CURRENT LIVE function body verbatim — including the
-- `SET search_path TO 'public'` pinned by 20260804120200 (recorded live as
-- 20260804033719), which a careless CREATE OR REPLACE would silently drop —
-- and adds exactly one guard, correctly ordered ABOVE the same-state early
-- return.
--
-- ── WHAT THIS MIGRATION DELIBERATELY DOES NOT DO ─────────────────────────
--   * does NOT touch enforce_evidence_immutability(), which is already the
--     correct union of Phase -1 + Phase G + Phase C + E2;
--   * does NOT alter learner_evidence's schema, RLS, grants, or triggers;
--   * does NOT edit or renumber any historical migration;
--   * does NOT reject every UPDATE to an erased row. The guard is scoped to
--     writes that actually change erasure attribution, so unrelated updates
--     to an erased row (e.g. a verification_state change) keep their exact
--     current behaviour. We are protecting ERASURE ATTRIBUTION, not freezing
--     every column through this function.
--
-- ── INVARIANT RESTORED ───────────────────────────────────────────────────
-- Once learner evidence has been erased through the authorised mechanism,
-- the erasure is terminal: a subsequent erase request is rejected, and
-- `erased_by` / `erased_at` / `erasure_reason` can never be overwritten.
--
-- ── ROLLBACK ─────────────────────────────────────────────────────────────
-- Re-run this file with the first IF block (the RESTORED GUARD) removed.
-- The remainder is byte-identical to the pre-migration live definition.

CREATE OR REPLACE FUNCTION public.enforce_evidence_lifecycle_transition()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path TO 'public'
AS $function$
BEGIN
  -- ── RESTORED GUARD (the only change in this migration) ────────────────
  -- MUST precede the same-state early return below. A second erasure leaves
  -- lifecycle_state unchanged ('erased' -> 'erased'), so any guard placed
  -- after that return is unreachable — which is exactly the bug being fixed.
  --
  -- Scoped to attribution writes rather than to "any update of an erased
  -- row" so that legitimate unrelated updates to an erased row are not
  -- newly rejected.
  IF OLD.lifecycle_state = 'erased' AND (
       NEW.erased_by      IS DISTINCT FROM OLD.erased_by
    OR NEW.erased_at      IS DISTINCT FROM OLD.erased_at
    OR NEW.erasure_reason IS DISTINCT FROM OLD.erasure_reason
  ) THEN
    RAISE EXCEPTION 'learner_evidence row % is already erased; its erasure attribution is immutable.', OLD.id;
  END IF;

  IF NEW.lifecycle_state = OLD.lifecycle_state THEN
    RETURN NEW; -- no state change, e.g. a verification_state-only update
  END IF;

  -- Retained deliberately. It is now redundant for the double-erase path
  -- (the guard above catches that first), but it remains the correct rule
  -- for any future path that could reach here with OLD.lifecycle_state =
  -- 'erased' and a genuine state change. Keeping it makes this migration a
  -- pure addition rather than a rewrite.
  IF NEW.lifecycle_state = 'erased' THEN
    IF OLD.lifecycle_state = 'erased' THEN
      RAISE EXCEPTION 'learner_evidence row % is already erased.', OLD.id;
    END IF;
    RETURN NEW;
  END IF;

  IF NOT (
    (OLD.lifecycle_state = 'pending_review'    AND NEW.lifecycle_state IN ('reviewed_confirmed', 'reviewed_rejected')) OR
    (OLD.lifecycle_state = 'auto_confirmed'     AND NEW.lifecycle_state IN ('superseded', 'retracted')) OR
    (OLD.lifecycle_state = 'reviewed_confirmed' AND NEW.lifecycle_state IN ('superseded', 'retracted'))
  ) THEN
    RAISE EXCEPTION 'Invalid evidence lifecycle transition % -> % on row % (Evidence Domain Model §2).', OLD.lifecycle_state, NEW.lifecycle_state, OLD.id;
  END IF;

  RETURN NEW;
END;
$function$;
