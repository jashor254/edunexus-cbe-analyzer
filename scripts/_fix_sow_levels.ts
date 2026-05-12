import { createClient } from '@supabase/supabase-js'
import * as dotenv from 'dotenv'
dotenv.config({ path: '/home/the-dev/Desktop/edunexus-cbe-analyzer/.env.local' })

const db = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

async function run() {
  console.log('Fixing sow_levels curriculum_type…\n')

  const { data: r1, error: e1 } = await db
    .from('sow_levels')
    .update({ curriculum_type: '844' })
    .ilike('name', '%Forms%')
    .select('name, curriculum_type')
  if (e1) { console.error('844 update failed:', e1.message); process.exit(1) }
  console.log('→ Set 844:', r1?.map(r => r.name).join(', ') || '(none matched)')

  const { data: r2, error: e2 } = await db
    .from('sow_levels')
    .update({ curriculum_type: 'cbc_junior' })
    .ilike('name', '%Junior%')
    .select('name, curriculum_type')
  if (e2) { console.error('cbc_junior update failed:', e2.message); process.exit(1) }
  console.log('→ Set cbc_junior:', r2?.map(r => r.name).join(', ') || '(none matched)')

  const { data: r3, error: e3 } = await db
    .from('sow_levels')
    .update({ curriculum_type: 'cbc_senior' })
    .ilike('name', '%Senior%')
    .not('name', 'ilike', '%Forms%')
    .select('name, curriculum_type')
  if (e3) { console.error('cbc_senior update failed:', e3.message); process.exit(1) }
  console.log('→ Set cbc_senior:', r3?.map(r => r.name).join(', ') || '(none matched)')

  console.log('\n─── Final sow_levels state ───')
  const { data: final } = await db
    .from('sow_levels')
    .select('name, curriculum_type, order_index')
    .order('order_index')
  console.table(final)
}

run().catch(e => { console.error(e); process.exit(1) })
