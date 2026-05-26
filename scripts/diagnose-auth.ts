import * as dotenv from 'dotenv'
import * as path from 'path'
import { createClient } from '@supabase/supabase-js'

dotenv.config({ path: path.resolve(__dirname, '../.env.local') })

const URL  = process.env.NEXT_PUBLIC_SUPABASE_URL as string
const SVC  = process.env.SUPABASE_SERVICE_ROLE_KEY as string
const ANON = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY as string

const sb   = createClient(URL, SVC)
const anon = createClient(URL, ANON)

const DENNIS_ID = '5cb45b89-0473-40f8-be70-0857424432a7'

async function main() {
  console.log('\n━━━ 1. SERVICE ROLE teacher query (new callback)')
  const { data: d1, error: e1 } = await sb
    .from('teachers').select('id').eq('user_id', DENNIS_ID).maybeSingle()
  console.log('   result:', d1 ? `FOUND id=${d1.id}` : 'null', e1 ? `ERR: ${e1.message}` : '')

  console.log('\n━━━ 2. ANON KEY teacher query (old callback)')
  const { data: d2, error: e2 } = await anon
    .from('teachers').select('id').eq('user_id', DENNIS_ID).maybeSingle()
  console.log('   result:', d2 ? `FOUND id=${d2.id}` : 'null', e2 ? `ERR: ${e2.message}` : '(RLS blocked or no row)')

  console.log('\n━━━ 3. Supabase auth config (redirect URLs)')
  const pat = process.env.SUPABASE_PAT
  if (!pat) throw new Error('SUPABASE_PAT env var not set')
  const res = await fetch('https://api.supabase.com/v1/projects/lpxrfbmzncaztpmyqzkc/config/auth', {
    headers: { Authorization: `Bearer ${pat}` },
  })
  const conf = await res.json() as Record<string, unknown>
  console.log('   site_url:      ', conf.site_url)
  console.log('   uri_allow_list:', conf.uri_allow_list || '(empty)')
  console.log('   google_enabled:', conf.external_google_enabled)

  console.log('\n━━━ 4. RLS on teachers table')
  const { data: rlsRows, error: rlsErr } = await sb
    .from('pg_policies' as never)
    .select('policyname, cmd, qual')
    .eq('tablename' as never, 'teachers')
  if (rlsErr) console.log('   pg_policies query blocked:', rlsErr.message)
  else        console.log('   policies:', JSON.stringify(rlsRows, null, 4))
}

main().catch(console.error)
