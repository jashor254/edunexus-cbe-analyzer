/**
 * Audit old project grades → learning_areas → strands/substrands
 * to find donor data for thin JSS subjects.
 */

import { createClient } from '@supabase/supabase-js'

const OLD_URL = 'https://hvvzpesxsvuvlqytcvsq.supabase.co'
const OLD_KEY = 'REDACTED_JASHOR_SERVICE_KEY'

const old = createClient(OLD_URL, OLD_KEY)

async function main() {
  // List all grades
  const { data: grades } = await old.from('grades').select('id, name, level_id').order('name')
  console.log('=== All Grades ===')
  for (const g of grades || []) console.log(`  ${g.name.padEnd(40)} id=${g.id}`)

  // For each grade, list learning areas with strand/substrand counts
  for (const grade of grades || []) {
    const { data: las } = await old
      .from('learning_areas')
      .select('id, name')
      .eq('grade_id', grade.id)
      .order('name')
    if (!las?.length) continue

    console.log(`\n━━━ ${grade.name} ━━━`)
    for (const la of las) {
      const { data: strands } = await old
        .from('strands')
        .select('id')
        .eq('learning_area_id', la.id)
      const strandIds = (strands || []).map(s => s.id)

      let substrandCount = 0
      if (strandIds.length) {
        const { count } = await old
          .from('substrands')
          .select('*', { count: 'exact', head: true })
          .in('strand_id', strandIds)
        substrandCount = count ?? 0
      }
      const flag = substrandCount === 0 ? '🔴' : substrandCount < 10 ? '🟡' : '✅'
      console.log(`  ${flag} ${la.name.padEnd(50)} strands=${strandIds.length}  subs=${substrandCount}  la_id=${la.id}`)
    }
  }

  console.log('\nDone.')
}

main().catch(err => { console.error(err); process.exit(1) })
