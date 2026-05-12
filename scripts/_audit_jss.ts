/**
 * Audit: CBC Junior Grade 7/8/9 JSS learning areas
 * Shows strand count and substrand count per subject, highlighting thin data.
 */

import { createClient } from '@supabase/supabase-js'

const SUPABASE_URL = 'https://lpxrfbmzncaztpmyqzkc.supabase.co'
const SERVICE_KEY =
  'REDACTED_EDUNEXUS_SERVICE_KEY'

const db = createClient(SUPABASE_URL, SERVICE_KEY)

async function main() {
  // 1. Find CBC Junior level
  const { data: levels } = await db
    .from('sow_levels')
    .select('id, name')
    .eq('curriculum_type', 'cbc_junior')
    .order('order_index')
    .limit(1)
  if (!levels?.length) { console.log('No CBC Junior level found'); return }
  console.log(`Level: ${levels[0].name} (${levels[0].id})`)

  // 2. Get active grades
  const { data: grades } = await db
    .from('sow_grades')
    .select('id, name')
    .eq('level_id', levels[0].id)
    .eq('is_active', true)
    .order('numeric_grade')
  if (!grades?.length) { console.log('No grades'); return }

  for (const grade of grades) {
    console.log(`\n━━━ ${grade.name} (${grade.id}) ━━━`)

    // 3. Get learning areas for grade
    const { data: las } = await db
      .from('sow_learning_areas')
      .select('id, name, order_index')
      .eq('grade_id', grade.id)
      .order('order_index')
    if (!las?.length) { console.log('  No learning areas'); continue }

    // 4. For each LA, get strands and substrand counts
    for (const la of las) {
      const { data: strands } = await db
        .from('sow_strands')
        .select('id')
        .eq('learning_area_id', la.id)

      const strandIds = (strands || []).map(s => s.id)
      let substrandCount = 0

      if (strandIds.length > 0) {
        const PAGE = 1000
        let from = 0
        while (true) {
          const { data: page } = await db
            .from('sow_substrands')
            .select('id', { count: 'exact', head: false })
            .in('strand_id', strandIds)
            .range(from, from + PAGE - 1)
          substrandCount += page?.length ?? 0
          if (!page || page.length < PAGE) break
          from += PAGE
        }
      }

      const strandCount = strandIds.length
      const flag = strandCount === 0 ? '🔴 NO DATA' : substrandCount < 5 ? '🟡 THIN' : strandCount < 3 ? '🟡 FEW STRANDS' : '✅'
      console.log(`  ${flag}  ${la.name.padEnd(40)} strands=${strandCount}  substrands=${substrandCount}  (la_id=${la.id})`)
    }
  }

  console.log('\nDone.')
}

main().catch(err => { console.error(err); process.exit(1) })
