/**
 * Lists all tables in the old jashor-app Supabase DB with row counts.
 * Uses the PostgREST OpenAPI spec (no special auth needed beyond service key).
 */
import { createClient } from '@supabase/supabase-js'

const OLD_SUPABASE_URL = 'https://hvvzpesxsvuvlqytcvsq.supabase.co'
const OLD_SUPABASE_KEY =
  'REDACTED_JASHOR_SERVICE_KEY'

const oldDb = createClient(OLD_SUPABASE_URL, OLD_SUPABASE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
})

async function main() {
  // Fetch the PostgREST OpenAPI spec — lists every exposed table/view
  const res = await fetch(`${OLD_SUPABASE_URL}/rest/v1/`, {
    headers: {
      apikey: OLD_SUPABASE_KEY,
      Authorization: `Bearer ${OLD_SUPABASE_KEY}`,
    },
  })

  if (!res.ok) {
    console.error(`OpenAPI fetch failed: ${res.status} ${await res.text()}`)
    return
  }

  const spec: any = await res.json()
  const tableNames: string[] = Object.keys(spec.definitions ?? spec.paths ?? {})
    .filter((k) => !k.startsWith('/'))
    .sort()

  console.log(`\n🔍 Found ${tableNames.length} tables/views in old DB public schema:\n`)

  for (const table of tableNames) {
    const { count, error } = await oldDb
      .from(table)
      .select('*', { count: 'exact', head: true })

    const rowCount = error ? `(${error.message.slice(0, 40)})` : String(count)
    console.log(`  ${table.padEnd(42)} ${rowCount} rows`)
  }

  console.log('\n✅ Done.')
}

main().catch(console.error)
