// Run with: npx tsx scripts/grant-tokens.ts
import * as dotenv from 'dotenv'
import * as path from 'path'
import { createClient } from '@supabase/supabase-js'

dotenv.config({ path: path.resolve(__dirname, '../.env.local') })

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL as string,
  process.env.SUPABASE_SERVICE_ROLE_KEY as string
)

const TARGET_EMAIL = 'stanleynjanekenya@gmail.com'
const TOKENS       = 50000

async function main() {
  // Look up user via admin auth API
  const { data: authList, error: listErr } = await supabase.auth.admin.listUsers()
  if (listErr) { console.error('Failed to list users:', listErr.message); process.exit(1) }

  const match = (authList?.users ?? []).find((u: { email?: string | null }) => u.email === TARGET_EMAIL)
  if (!match) {
    console.error(`❌  User not found: ${TARGET_EMAIL}`)
    process.exit(1)
  }

  console.log(`Found user: ${match.id}  (${match.email})`)

  // Check existing balance
  const { data: existing } = await supabase
    .from('token_balances')
    .select('balance')
    .eq('user_id', match.id)
    .single()

  const prev = existing?.balance ?? 0
  console.log(`Current balance: ${prev}`)

  // Upsert to 50,000
  const { error: upsertErr } = await supabase
    .from('token_balances')
    .upsert({ user_id: match.id, balance: TOKENS }, { onConflict: 'user_id' })

  if (upsertErr) { console.error('Upsert failed:', upsertErr.message); process.exit(1) }

  console.log(`✅  Balance set to ${TOKENS.toLocaleString()} tokens for ${TARGET_EMAIL}`)
}

main()
