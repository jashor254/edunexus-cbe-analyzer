-- Canonical structural schema fingerprint for the EduNexus local bootstrap.
--
-- Field classification (per H1M-SNAPSHOT-3 audit):
--   STABLE STRUCTURAL   -- included as-is
--   GENERATED-NAME      -- excluded; replaced by semantic definition
--   RUNTIME/VOLATILE     -- excluded entirely (OIDs, timestamps, row counts)
--   ORDER-SENSITIVE      -- neutralized via explicit `order by` on the final union
--
-- TABLE/COLUMN        STABLE STRUCTURAL  (information_schema.columns; one row
--                      per column, no join fan-out risk)
-- CONSTRAINT           GENERATED-NAME for conname (Postgres auto-derives it
--                      from table+column+suffix; empirically collision-free
--                      here, but the *name* is not what determines behavior).
--                      Represented instead by pg_get_constraintdef(oid), which
--                      canonically encodes column set / referenced
--                      table+columns / ON DELETE/UPDATE actions.
-- INDEX                GENERATED-NAME for indexname when auto-derived;
--                      represented by pg_get_indexdef() with the index-name
--                      token stripped out, preserving uniqueness, indexed
--                      columns/expressions, access method, and predicate.
-- FUNCTION             ROOT CAUSE of the original mismatch: the prior query
--                      joined information_schema.routines to pg_proc BY NAME
--                      ONLY. With real overloads (deduct_tokens x2,
--                      deduct_ai_token x2) this is a many-to-many join with
--                      no defined pairing order -- confirmed empirically to
--                      produce 92 rows for 88 real functions. Fixed by
--                      driving entirely off pg_proc.oid (the true identity)
--                      and using pg_get_function_identity_arguments(oid) for
--                      the signature instead of a name-keyed join.
-- TRIGGER              STABLE STRUCTURAL via information_schema.triggers,
--                      keyed by (table, trigger_name, timing, event) with
--                      action_statement (names the function) included.
-- VIEW                 View name is a semantic API surface, kept. Definition
--                      via pg_get_viewdef(oid, true) (canonical, whitespace-
--                      normalized by Postgres itself) plus reloptions
--                      (security_invoker etc).
-- RLS                  relrowsecurity/relforcerowsecurity -- STABLE STRUCTURAL.
-- POLICY               policyname is user-chosen (meaningful), kept. roles
--                      array sorted explicitly (ORDER-SENSITIVE otherwise).
--
-- Explicitly EXCLUDED as RUNTIME/VOLATILE: OIDs, pg_get_functiondef's
-- internal object addressing, created_at/updated_at column VALUES (not
-- schema), any row counts, sequence current-value state.
--
-- Everything is emitted as one `line` per object property and the whole set
-- is sorted before hashing, neutralizing ORDER-SENSITIVE query-result order.

select md5(string_agg(line, E'\n' order by line)) as fingerprint
from (

  select 'TABLE:'||table_name||':'||column_name||':'||data_type||':'||is_nullable
         ||':'||coalesce(column_default,'')||':'||coalesce(is_generated,'')
         ||':'||coalesce(generation_expression,'') as line
  from information_schema.columns where table_schema='public'

  union all
  select 'CONSTRAINT:'||conrelid::regclass::text||':'||contype::text||':'||pg_get_constraintdef(oid)
  from pg_constraint where connamespace='public'::regnamespace

  union all
  select 'INDEX:'||schemaname||'.'||tablename||':'||indexdef_normalized
  from (
    select schemaname, tablename,
           regexp_replace(indexdef, 'INDEX\s+\S+\s+ON', 'INDEX <name> ON') as indexdef_normalized
    from pg_indexes where schemaname='public'
  ) sub

  union all
  select 'RLS:'||relname||':'||relrowsecurity||':'||relforcerowsecurity
  from pg_class where relnamespace='public'::regnamespace and relkind='r'

  union all
  select 'POLICY:'||tablename||':'||policyname||':'||cmd||':'
         ||(select string_agg(r, ',' order by r) from unnest(roles) r)
         ||':'||coalesce(qual,'')||':'||coalesce(with_check,'')
  from pg_policies where schemaname='public'

  union all
  select 'FUNCTION:'||p.proname||'('||pg_get_function_identity_arguments(p.oid)||'):'
         ||md5(pg_get_functiondef(p.oid))
  from pg_proc p
  join pg_namespace n on n.oid = p.pronamespace
  where n.nspname='public'

  union all
  select 'TRIGGER:'||event_object_table||':'||trigger_name||':'||action_timing
         ||':'||event_manipulation||':'||action_statement
  from information_schema.triggers where trigger_schema='public'

  union all
  select 'VIEW:'||c.relname||':'||array_to_string(coalesce(c.reloptions,'{}'),',')
         ||':'||pg_get_viewdef(c.oid, true)
  from pg_class c where c.relnamespace='public'::regnamespace and c.relkind='v'

) t;
