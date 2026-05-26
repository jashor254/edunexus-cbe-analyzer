import * as dotenv from 'dotenv'
import * as path from 'path'
import { createClient } from '@supabase/supabase-js'

dotenv.config({ path: path.resolve(__dirname, '../.env.local') })

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL as string,
  process.env.SUPABASE_SERVICE_ROLE_KEY as string
)

async function main() {
  const res = await fetch(
    `${process.env.NEXT_PUBLIC_SUPABASE_URL}/rest/v1/?apikey=${process.env.SUPABASE_SERVICE_ROLE_KEY}`,
    {
      headers: {
        'Authorization': `Bearer ${process.env.SUPABASE_SERVICE_ROLE_KEY}`,
      },
    }
  )
  const swagger = await res.json() as { definitions?: Record<string, unknown> }
  const tables = Object.keys(swagger.definitions ?? {})

  if (tables.length) {
    console.log(`\n📋 Tables (${tables.length}):`)
    tables.sort().forEach((t, i) => console.log(`  ${i + 1}. ${t}`))
    return
  }

  // Fallback: query pg_tables directly
  const { data, error } = await supabase
    .from('pg_tables' as never)
    .select('tablename')
    .eq('schemaname' as never, 'public')

  if (error) { console.error('Error:', error.message); return }
  const rows = data as Array<{ tablename: string }>
  console.log(`\n📋 Tables (${rows.length}):`)
  rows.sort((a, b) => a.tablename.localeCompare(b.tablename))
      .forEach((r, i) => console.log(`  ${i + 1}. ${r.tablename}`))
}

main().catch(console.error)
