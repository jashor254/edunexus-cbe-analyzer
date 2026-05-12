/**
 * Fix Grade 7 JSS sparse subjects (Math, English, Kiswahili, Social Studies).
 * These have 1 placeholder strand each. We copy from Grade 7 old (f4b2f72e)
 * which has 5-15 strands per subject.
 *
 * We skip strand titles that already exist in the target LA to avoid exact duplicates.
 */

import { createClient } from '@supabase/supabase-js'
import { randomUUID } from 'crypto'

const SUPABASE_URL = 'https://lpxrfbmzncaztpmyqzkc.supabase.co'
const SERVICE_KEY =
  'REDACTED_EDUNEXUS_SERVICE_KEY'

const supabase = createClient(SUPABASE_URL, SERVICE_KEY)

const GRADE7_JSS_LA_MAP: Record<string, string> = {
  'f77c46aa-5bd4-4d22-9d15-5c25f647412c': '966a4a76-0ef6-4127-b6ad-b89c9d930ed6', // Mathematics
  '9f49646d-1422-4bc7-9b96-3279d8c57745': '6ff6b886-7ad2-4812-82a9-d0ce18f3f17a', // English
  '1ec57801-76d5-4fff-ae3a-6100bb420467': 'a7cbbf0e-5e74-4777-97e1-083d4c789565', // Kiswahili
  '52b10aa7-f94c-4c9d-adec-424ac0cff52c': 'f2d8d6a2-fa51-414b-9d10-59d56942d0fb', // Social Studies
}

async function main() {
  console.log('Fix Grade 7 JSS sparse subjects')
  console.log('================================')

  const oldLaIds = Object.keys(GRADE7_JSS_LA_MAP)

  // Fetch source strands from Grade 7 old
  const { data: sourceStrands } = await supabase
    .from('sow_strands')
    .select('id, learning_area_id, title, order_index, source_type, kicd_data')
    .in('learning_area_id', oldLaIds)

  if (!sourceStrands?.length) { console.log('No source strands found'); return }

  // For each target LA, get existing strand titles to avoid exact title duplication
  const existingTitles: Record<string, Set<string>> = {}
  for (const newLaId of Object.values(GRADE7_JSS_LA_MAP)) {
    const { data } = await supabase
      .from('sow_strands')
      .select('title')
      .eq('learning_area_id', newLaId)
    existingTitles[newLaId] = new Set((data || []).map(r => r.title.toLowerCase()))
  }

  // Build new strand rows (skip exact title matches)
  const strandIdMap: Record<string, string> = {}
  const newStrandRows = []
  for (const s of sourceStrands) {
    const newLaId = GRADE7_JSS_LA_MAP[s.learning_area_id]
    if (!newLaId) continue
    if (existingTitles[newLaId]?.has(s.title.toLowerCase())) {
      console.log(`  Skip duplicate strand: "${s.title}"`)
      continue
    }
    const newId = randomUUID()
    strandIdMap[s.id] = newId
    newStrandRows.push({
      id: newId,
      learning_area_id: newLaId,
      title: s.title,
      order_index: s.order_index,
      source_type: s.source_type ?? 'original',
      kicd_data: s.kicd_data ?? [],
    })
  }

  if (!newStrandRows.length) {
    console.log('No new strands to insert — all already exist')
    return
  }

  const { error: stErr } = await supabase.from('sow_strands').insert(newStrandRows)
  if (stErr) throw new Error(`Insert strands: ${stErr.message}`)
  console.log(`✓ Inserted ${newStrandRows.length} strands`)

  // Fetch substrands for source strands that were copied
  const copiedOldStrandIds = Object.keys(strandIdMap)
  if (!copiedOldStrandIds.length) { console.log('No substrands to copy'); return }

  const { data: sourceSubstrands } = await supabase
    .from('sow_substrands')
    .select('id, strand_id, title, suggested_lessons, order_index, content, source_type')
    .in('strand_id', copiedOldStrandIds)

  if (!sourceSubstrands?.length) { console.log('No source substrands'); return }

  const newSubRows = sourceSubstrands.map(ss => ({
    id: randomUUID(),
    strand_id: strandIdMap[ss.strand_id],
    title: ss.title,
    suggested_lessons: ss.suggested_lessons ?? 4,
    order_index: ss.order_index,
    content: ss.content,
    source_type: ss.source_type ?? 'original',
  })).filter(r => r.strand_id)

  const BATCH = 200
  for (let i = 0; i < newSubRows.length; i += BATCH) {
    const { error } = await supabase.from('sow_substrands').insert(newSubRows.slice(i, i + BATCH))
    if (error) throw new Error(`Insert substrands batch ${i}: ${error.message}`)
  }
  console.log(`✓ Inserted ${newSubRows.length} substrands`)

  // Final counts
  for (const [subject, newLaId] of Object.entries(GRADE7_JSS_LA_MAP)) {
    const { count } = await supabase
      .from('sow_strands')
      .select('*', { count: 'exact', head: true })
      .eq('learning_area_id', newLaId)
    console.log(`  Grade 7 JSS ${subject.slice(0, 36)}: ${count} strands`)
  }

  console.log('\n✅ Done')
}

main().catch(err => { console.error(err); process.exit(1) })
