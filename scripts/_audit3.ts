import { createClient } from '@supabase/supabase-js'
import * as dotenv from 'dotenv'
dotenv.config({ path: '/home/the-dev/Desktop/edunexus-cbe-analyzer/.env.local' })

const db = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!)

async function run() {
  // All Grade 10 rows and their level
  const { data: g10 } = await db
    .from('sow_grades')
    .select('id, name, numeric_grade, level_id, order_index')
    .eq('numeric_grade', 10)

  const levelIds = [...new Set(g10?.map(g => g.level_id) ?? [])]
  const { data: levels } = await db
    .from('sow_levels')
    .select('id, name, curriculum_type, order_index')
    .in('id', levelIds)

  console.log('All Grade 10 rows:')
  g10?.forEach(g => {
    const lev = levels?.find(l => l.id === g.level_id)
    const { count: areaCount } = { count: 0 }
    console.log(`  id=${g.id}  name="${g.name}"  level="${lev?.name}"  curriculum_type="${lev?.curriculum_type}"`)
  })

  // How many sow_learning_areas per Grade 10 id?
  console.log('\nLearning area count per Grade 10 id:')
  for (const g of g10 ?? []) {
    const { count } = await db
      .from('sow_learning_areas')
      .select('*', { count: 'exact', head: true })
      .eq('grade_id', g.id)
    console.log(`  ${g.id.slice(0,8)}… "${g.name}"  → ${count} subjects`)
  }

  // sow_levels with curriculum_type cbc_senior, ordered
  const { data: seniorLevels } = await db
    .from('sow_levels')
    .select('id, name, curriculum_type, order_index')
    .eq('curriculum_type', 'cbc_senior')
    .order('order_index')
  console.log('\ncbc_senior levels (ordered):')
  console.table(seniorLevels)
}

run().catch(console.error)
