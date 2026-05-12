/**
 * Fix Form 3 and Form 4 SS-Forms substrands.
 * The original migration hit the Supabase 1000-row SELECT limit so many
 * strands ended up with 0 substrands. This script:
 *  1. Deletes all existing substrands for Form 3/4 SS-Forms strands
 *  2. Re-fetches source substrands with pagination
 *  3. Re-inserts them against the correct new strand IDs
 */

import { createClient } from '@supabase/supabase-js'
import { randomUUID } from 'crypto'

const SUPABASE_URL = 'https://lpxrfbmzncaztpmyqzkc.supabase.co'
const SERVICE_KEY =
  'REDACTED_EDUNEXUS_SERVICE_KEY'

const supabase = createClient(SUPABASE_URL, SERVICE_KEY)

// All Form 3 SS-Forms learning area IDs (new) and their donor LA IDs (old)
const F3_MAP: Record<string, string> = {
  '90c2e163-413e-44f7-b96a-2fe0a87b5ea0': '944f6878-3383-4ee9-a14d-eec4887e782e', // Maths
  '33558f3f-c2a5-41da-b48a-105b8d762f43': '08ce82f6-54df-4769-b500-ec8a9b60cfb2', // English
  'b57390fe-1a8f-43e1-8721-dd80d107e738': '9f490d3c-2315-4c19-a796-8fd92982bdba', // Kiswahili
  'f3a7dc46-5201-4c6d-9848-698a7307df51': '1b7e0574-a351-4711-afda-09c2f9d9db6d', // Biology
  '0afe4f37-af4a-4523-b2ef-d970de54ac6f': '312d790d-9294-458d-bda8-051336bf3a35', // Chemistry
  '236196ea-adff-4531-a290-27fd8d452caa': 'c65c686b-2cda-4e9d-a815-803cefa3e69e', // Physics
  'fad25349-339b-4504-a88a-606da970be93': '6f20aca0-5997-421e-b59e-67c4e690b9ae', // Geography
  '121e29a8-92cb-4900-9247-1deac885433c': 'dca3e7b6-909a-4e32-a66c-5ec5b51c554b', // History
  '960cbfdc-a46e-43b9-ac42-c6e346e522eb': '6e00e5d6-7ceb-405b-9b5c-f01dfd5674a2', // IRE
  '39d5d228-eb21-46a6-8dea-a294f734f415': 'e0c1e98e-1572-4a52-bc3d-0473e3712e9a', // Business
  '6635aaa6-b80a-4996-a360-2d884dd921c7': 'b2513b61-c93d-47b5-a2a1-c45828d75630', // Agriculture
  '0f659726-8a43-447c-93a1-470ed89b8413': '77cb2354-64e8-4633-b19c-13628200cc8f', // Computer
  'bbd45f62-e45b-419e-babf-015874c46de0': '81c81333-d79c-45cc-a061-581785a31d8e', // Home Science
  '6088e9ce-7daf-4b32-b546-79e5e6972744': '0f695533-b829-4cd2-a841-a2c0f19cf17b', // CRE
}

const F4_MAP: Record<string, string> = {
  '9fca953c-5ab5-445f-8fb0-df97cf2189ff': 'a3e8db38-6635-46f6-8308-1ef7ce12bec3', // Maths
  '6b3a6a84-0011-45b4-a08f-52e131481869': 'c8ae276b-e0f2-4d07-b5cc-8aa46e7db2cb', // English
  '36b611af-6585-4e55-8d7f-2dcc49eb4c73': '05a0ec00-0a80-4165-835a-b1482e677e6e', // Kiswahili
  '04168dc6-abfb-4ba2-9059-6ccad83245df': '7db0769e-f205-4510-a144-bf512ee6e901', // Biology
  '914d6cc4-7b99-4f25-a61d-5f20e44f140d': '898e814e-9d57-468b-8817-7a6cc06b3333', // Chemistry
  '8a099cd3-4b2b-485e-b07a-71fae9e02e38': '95038a07-3503-4630-bf50-97b47ac0b848', // Physics
  '9c212a52-2385-41f2-a80b-fb8ffbf7df7e': 'e3dfef83-65a5-4379-95b8-796f35ca1289', // Geography
  '3d73d978-9c5b-48a6-bfc8-755fcf415b48': 'dbb6b934-d70d-4583-8cd1-67942f6c9820', // History
  '6088e9ce-7daf-4b32-b546-79e5e6972744': '4a6b8d2c-70c4-4a76-ac9b-b19b349a31e7', // CRE
  'aad812b5-2019-4e18-8408-fbe61ea0d60b': '6196f66e-1f50-42ea-a98b-ea3e3902727a', // IRE
  '005655f8-f3a8-48fe-8a72-53878d8d366b': '6265863c-aba2-4ac0-b415-a6f1b6fe279f', // Business
  '0d343e48-d567-428f-aa9b-d68a4749a4a8': 'a0c15fa1-6f2c-4ca2-bec9-7a56e756648c', // Agriculture
  '5e85a337-15d3-44b3-b30f-4396fa7cac6c': 'f02ed5d3-d8d7-491a-b457-a061a69665d4', // Computer
  '182e858e-7199-44e7-8f6d-ead3dbff52f1': '27eab4c3-6fb3-45c8-baf0-6f2d5adaeee1', // Home Science
}

async function fetchAllSubstrands(strandIds: string[]): Promise<any[]> {
  const all: any[] = []
  const PAGE = 1000
  let from = 0
  while (true) {
    const { data, error } = await supabase
      .from('sow_substrands')
      .select('id, strand_id, title, suggested_lessons, order_index, content, source_type')
      .in('strand_id', strandIds)
      .order('order_index')
      .range(from, from + PAGE - 1)
    if (error) throw new Error(`fetchSubstrands: ${error.message}`)
    if (data) all.push(...data)
    if (!data || data.length < PAGE) break
    from += PAGE
  }
  return all
}

async function fixForm(label: string, laMap: Record<string, string>) {
  console.log(`\n━━━ ${label} ━━━`)
  const oldLaIds = Object.keys(laMap)
  const newLaIds = Object.values(laMap)

  // 1. Get all new strands (inserted by previous migration)
  const { data: newStrands, error: nsErr } = await supabase
    .from('sow_strands')
    .select('id, learning_area_id, title')
    .in('learning_area_id', newLaIds)
  if (nsErr) throw new Error(`fetch new strands: ${nsErr.message}`)
  if (!newStrands?.length) { console.log('  No new strands found'); return }
  console.log(`  Found ${newStrands.length} new strands`)

  // 2. Delete all existing substrands for these new strands
  const newStrandIds = newStrands.map(s => s.id)
  const { error: delErr } = await supabase
    .from('sow_substrands')
    .delete()
    .in('strand_id', newStrandIds)
  if (delErr) throw new Error(`delete substrands: ${delErr.message}`)
  console.log('  ✓ Cleared existing substrands')

  // 3. Get all old strands (donors) with paginated fetch
  const { data: oldStrands, error: osErr } = await supabase
    .from('sow_strands')
    .select('id, learning_area_id, title')
    .in('learning_area_id', oldLaIds)
  if (osErr) throw new Error(`fetch old strands: ${osErr.message}`)
  if (!oldStrands?.length) { console.log('  No donor strands found'); return }

  // 4. Build: old strand title+LA → new strand ID (match by title + LA pair)
  // First build a map: new_la_id → {title_lower → new_strand_id}
  const newByTitle: Record<string, Record<string, string>> = {}
  for (const ns of newStrands) {
    const la = ns.learning_area_id
    if (!newByTitle[la]) newByTitle[la] = {}
    newByTitle[la][ns.title.toLowerCase().trim()] = ns.id
  }

  // Build: old_strand_id → new_strand_id
  const strandIdMap: Record<string, string> = {}
  for (const os of oldStrands) {
    const newLaId = laMap[os.learning_area_id]
    if (!newLaId) continue
    const newId = newByTitle[newLaId]?.[os.title.toLowerCase().trim()]
    if (newId) strandIdMap[os.id] = newId
  }

  const mappedCount = Object.keys(strandIdMap).length
  console.log(`  Mapped ${mappedCount}/${oldStrands.length} old strands → new strands`)

  // 5. Fetch ALL source substrands with pagination
  const oldStrandIds = Object.keys(strandIdMap)
  const sourceSubstrands = await fetchAllSubstrands(oldStrandIds)
  console.log(`  Fetched ${sourceSubstrands.length} source substrands`)

  // 6. Insert new substrands in batches
  const newSubRows = sourceSubstrands
    .filter(ss => strandIdMap[ss.strand_id])
    .map(ss => ({
      id: randomUUID(),
      strand_id: strandIdMap[ss.strand_id],
      title: ss.title,
      suggested_lessons: ss.suggested_lessons ?? 4,
      order_index: ss.order_index,
      content: ss.content,
      source_type: ss.source_type ?? 'original',
    }))

  const BATCH = 200
  let inserted = 0
  for (let i = 0; i < newSubRows.length; i += BATCH) {
    const { error } = await supabase.from('sow_substrands').insert(newSubRows.slice(i, i + BATCH))
    if (error) throw new Error(`insert batch ${i}: ${error.message}`)
    inserted += Math.min(BATCH, newSubRows.length - i)
  }
  console.log(`  ✓ Inserted ${inserted} substrands`)
}

async function main() {
  console.log('Fix Form 3 & Form 4 SS-Forms substrands (paginated re-migration)')
  console.log('=================================================================')

  await fixForm('8-4-4 Form 3 (SS-Forms)', F3_MAP)
  await fixForm('8-4-4 Form 4 (SS-Forms)', F4_MAP)

  // Final verification
  console.log('\n--- Final counts ---')
  const f3NewLas = Object.values(F3_MAP)
  const f4NewLas = Object.values(F4_MAP)

  const { data: f3Strands } = await supabase.from('sow_strands').select('id').in('learning_area_id', f3NewLas)
  const { data: f4Strands } = await supabase.from('sow_strands').select('id').in('learning_area_id', f4NewLas)

  const f3Subs = await fetchAllSubstrands(f3Strands!.map(s => s.id))
  const f4Subs = await fetchAllSubstrands(f4Strands!.map(s => s.id))

  console.log(`  Form 3: ${f3Strands?.length} strands, ${f3Subs.length} substrands`)
  console.log(`  Form 4: ${f4Strands?.length} strands, ${f4Subs.length} substrands`)
  console.log('\n✅ Done')
}

main().catch(err => { console.error(err); process.exit(1) })
