// scripts/create-compass-auto-confirm-account.ts
//
// One-time setup for Compass v2 Wave 2, Phase 11 (conservative auto-confirm).
//
// learner_evidence.reviewed_by is a hard FK to auth.users(id) — there is no
// legal way to call confirmReview() (the only path to reviewed_confirmed,
// per the enforce_evidence_lifecycle_transition trigger) without a real
// auth.users row as the reviewer. This script creates exactly one such row:
// a real but non-human account representing Compass's automated engagement
// -confirmation policy, using the same supabase.auth.admin.createUser()
// path the reference-school seed scripts already use for staff accounts —
// no new account-creation mechanism, no schema change.
//
// This account is never given a password anyone can use to sign in
// interactively (a random unguessable one is set, same as the reference
// -school pattern) and is never linked to teachers/school_users/students —
// it exists solely to be a legal, auditable `reviewed_by` value.
//
// Run once per environment: npx tsx scripts/create-compass-auto-confirm-account.ts
// Then set the printed id as COMPASS_AUTO_CONFIRM_USER_ID in that environment.

import { config } from 'dotenv'
config({ path: '.env.local' })

import type { User } from '@supabase/supabase-js'
import { createServiceClient } from '../utils/supabase/service'

const SYSTEM_ACCOUNT_EMAIL = 'compass-auto-confirm@system.edunexus.internal'

async function main() {
  const supabase = createServiceClient()

  const listResult = await supabase.auth.admin.listUsers()
  if (listResult.error) throw listResult.error
  const already = listResult.data.users.find((u: User) => u.email === SYSTEM_ACCOUNT_EMAIL)
  if (already) {
    console.log(`[compass-auto-confirm] already exists: ${already.id}`)
    console.log(`Set COMPASS_AUTO_CONFIRM_USER_ID=${already.id}`)
    return
  }

  const { data, error } = await supabase.auth.admin.createUser({
    email: SYSTEM_ACCOUNT_EMAIL,
    password: `system-${Math.random().toString(36).slice(2)}${Math.random().toString(36).slice(2)}`,
    email_confirm: true,
    user_metadata: {
      system_account: true,
      purpose: 'compass_v2_engagement_auto_confirm',
    },
  })
  if (error) throw error

  console.log(`[compass-auto-confirm] created: ${data.user.id}`)
  console.log(`Set COMPASS_AUTO_CONFIRM_USER_ID=${data.user.id}`)
}

main().catch(err => {
  console.error('[compass-auto-confirm] failed:', err)
  process.exit(1)
})
