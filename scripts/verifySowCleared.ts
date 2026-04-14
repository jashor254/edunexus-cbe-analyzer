import { createClient } from '@supabase/supabase-js'
import * as dotenv from 'dotenv'
import * as path from 'path'
dotenv.config({ path: path.resolve(process.cwd(), '.env.local') })

async function main() {
  const db = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  )
  const tables = [
    'sow_levels',
    'sow_grades',
    'sow_learning_areas',
    'sow_strands',
    'schemes_of_work',
    'scheme_lessons',
  ]
  for (const t of tables) {
    const { count } = await db.from(t).select('*', { count: 'exact', head: true })
    console.log(`${t}: ${count} rows`)
  }
}
main()
