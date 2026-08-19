// scripts/backfillLearnerIdentities.ts
//
// Phase 2D Step 4/5 — deterministic, idempotent backfill: every existing
// `learners` row with no `learner_identity_id` gets a fresh, unmatched
// `learner_identities` row (see lib/core/learnerIdentity.ts::backfillLearnerIdentities
// for the full rationale/invariants).
//
// Deliberately does NOT `dotenv.config({ path: '.env.local' })` like other
// backfill scripts in this directory — that file points at the PRODUCTION
// Supabase project (NEXT_PUBLIC_SUPABASE_URL=https://lpxrfbmzncaztpmyqzkc...).
// This script's target is controlled entirely by whatever
// NEXT_PUBLIC_SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY are already set in
// the invoking shell — for Phase 2D that must be the local Docker Supabase
// instance, passed explicitly on the command line, e.g.:
//
//   NEXT_PUBLIC_SUPABASE_URL=http://127.0.0.1:54321 \
//   SUPABASE_SERVICE_ROLE_KEY=<local service role key> \
//   npx tsx scripts/backfillLearnerIdentities.ts
//
// Production backfill is explicitly OUT OF SCOPE for Phase 2D (spec Step
// 23) — this script must never be pointed at NEXT_PUBLIC_SUPABASE_URL
// resolving to the known production project ref.

import { backfillLearnerIdentities } from '../lib/core/learnerIdentity'
import { createServiceClient } from '../utils/supabase/service'
import { KNOWN_PRODUCTION_PROJECT_REF, extractProjectRef } from '../utils/supabase/productionRef'

async function main(): Promise<void> {
  // Explicit, unconditional production guard for this script specifically
  // — the createServiceClient() guard in utils/supabase/service.ts only
  // fires under NODE_TEST_CONTEXT (a `node --test` process). This is an
  // ordinary `npx tsx` script, not a test, so that guard is inert here.
  // Phase 2D Step 23 forbids production backfill outright, so this script
  // refuses unconditionally rather than relying on the test-only guard.
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL ?? ''
  if (extractProjectRef(url) === KNOWN_PRODUCTION_PROJECT_REF) {
    console.error('backfillLearnerIdentities: refusing to run — NEXT_PUBLIC_SUPABASE_URL resolves to the known production project. Phase 2D backfill is local-Docker-only.')
    process.exit(1)
  }

  const db = createServiceClient()
  const before = await db.from('learners').select('id', { count: 'exact', head: true })
  const beforeMissing = await db.from('learners').select('id', { count: 'exact', head: true }).is('learner_identity_id', null)

  console.log(`learners total: ${before.count}`)
  console.log(`learners missing learner_identity_id before backfill: ${beforeMissing.count}`)

  const result = await backfillLearnerIdentities()
  console.log('backfill result:', JSON.stringify(result))

  const afterMissing = await db.from('learners').select('id', { count: 'exact', head: true }).is('learner_identity_id', null)
  const identities = await db.from('learner_identities').select('id', { count: 'exact', head: true })
  const links = await db.from('learner_identity_links').select('id', { count: 'exact', head: true })

  console.log(`learners missing learner_identity_id after backfill: ${afterMissing.count}`)
  console.log(`learner_identities total: ${identities.count}`)
  console.log(`learner_identity_links total: ${links.count}`)
}

main().then(() => process.exit(0)).catch(err => { console.error(err); process.exit(1) })
