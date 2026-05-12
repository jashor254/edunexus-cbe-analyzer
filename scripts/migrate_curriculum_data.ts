/**
 * Migration: Populate strands & substrands for 8-4-4 Form 3/4 (SS-Forms level)
 * and fill gaps in CBC Junior Grade 7/8/9 (JSS) learning areas.
 *
 * Strategy: copy existing strand+substrand data from "donor" learning areas
 * (old Senior Form 3/4, old Grade 7/8/9) to the new target learning areas.
 * New UUIDs are generated so no existing data is modified.
 */

import { createClient } from '@supabase/supabase-js'
import { randomUUID } from 'crypto'

const SUPABASE_URL = 'https://lpxrfbmzncaztpmyqzkc.supabase.co'
const SERVICE_KEY =
  'REDACTED_EDUNEXUS_SERVICE_KEY'

const supabase = createClient(SUPABASE_URL, SERVICE_KEY)

// ─── Mapping: old learning_area_id → new learning_area_id ────────────────────

// 8-4-4: Form 3 old Senior (grade 664afdb0) → Form 3 SS-Forms (grade 35d6cfd6)
const FORM3_LA_MAP: Record<string, string> = {
  '90c2e163-413e-44f7-b96a-2fe0a87b5ea0': '944f6878-3383-4ee9-a14d-eec4887e782e', // Mathematics
  '33558f3f-c2a5-41da-b48a-105b8d762f43': '08ce82f6-54df-4769-b500-ec8a9b60cfb2', // English
  'b57390fe-1a8f-43e1-8721-dd80d107e738': '9f490d3c-2315-4c19-a796-8fd92982bdba', // Kiswahili
  'f3a7dc46-5201-4c6d-9848-698a7307df51': '1b7e0574-a351-4711-afda-09c2f9d9db6d', // Biology
  '0afe4f37-af4a-4523-b2ef-d970de54ac6f': '312d790d-9294-458d-bda8-051336bf3a35', // Chemistry
  '236196ea-adff-4531-a290-27fd8d452caa': 'c65c686b-2cda-4e9d-a815-803cefa3e69e', // Physics
  'fad25349-339b-4504-a88a-606da970be93': '6f20aca0-5997-421e-b59e-67c4e690b9ae', // Geography
  '121e29a8-92cb-4900-9247-1deac885433c': 'dca3e7b6-909a-4e32-a66c-5ec5b51c554b', // History
  '960cbfdc-a46e-43b9-ac42-c6e346e522eb': '6e00e5d6-7ceb-405b-9b5c-f01dfd5674a2', // Islamic RE → IRE
  '39d5d228-eb21-46a6-8dea-a294f734f415': 'e0c1e98e-1572-4a52-bc3d-0473e3712e9a', // Business Studies
  '6635aaa6-b80a-4996-a360-2d884dd921c7': 'b2513b61-c93d-47b5-a2a1-c45828d75630', // Agriculture
  '0f659726-8a43-447c-93a1-470ed89b8413': '77cb2354-64e8-4633-b19c-13628200cc8f', // Computer Studies
  'bbd45f62-e45b-419e-babf-015874c46de0': '81c81333-d79c-45cc-a061-581785a31d8e', // Home Science
  // CRE: borrow from Form 4 old CRE (Form 3 had no CRE in old data)
  '6088e9ce-7daf-4b32-b546-79e5e6972744': '0f695533-b829-4cd2-a841-a2c0f19cf17b', // CRE (F4 old → F3 new)
}

// 8-4-4: Form 4 old Senior (grade e3a60e46) → Form 4 SS-Forms (grade 14a81842)
const FORM4_LA_MAP: Record<string, string> = {
  '9fca953c-5ab5-445f-8fb0-df97cf2189ff': 'a3e8db38-6635-46f6-8308-1ef7ce12bec3', // Mathematics
  '6b3a6a84-0011-45b4-a08f-52e131481869': 'c8ae276b-e0f2-4d07-b5cc-8aa46e7db2cb', // English
  '36b611af-6585-4e55-8d7f-2dcc49eb4c73': '05a0ec00-0a80-4165-835a-b1482e677e6e', // Kiswahili
  '04168dc6-abfb-4ba2-9059-6ccad83245df': '7db0769e-f205-4510-a144-bf512ee6e901', // Biology
  '914d6cc4-7b99-4f25-a61d-5f20e44f140d': '898e814e-9d57-468b-8817-7a6cc06b3333', // Chemistry
  '8a099cd3-4b2b-485e-b07a-71fae9e02e38': '95038a07-3503-4630-bf50-97b47ac0b848', // Physics
  '9c212a52-2385-41f2-a80b-fb8ffbf7df7e': 'e3dfef83-65a5-4379-95b8-796f35ca1289', // Geography
  '3d73d978-9c5b-48a6-bfc8-755fcf415b48': 'dbb6b934-d70d-4583-8cd1-67942f6c9820', // History
  '6088e9ce-7daf-4b32-b546-79e5e6972744': '4a6b8d2c-70c4-4a76-ac9b-b19b349a31e7', // CRE
  'aad812b5-2019-4e18-8408-fbe61ea0d60b': '6196f66e-1f50-42ea-a98b-ea3e3902727a', // Islamic RE → IRE
  '005655f8-f3a8-48fe-8a72-53878d8d366b': '6265863c-aba2-4ac0-b415-a6f1b6fe279f', // Business Studies
  '0d343e48-d567-428f-aa9b-d68a4749a4a8': 'a0c15fa1-6f2c-4ca2-bec9-7a56e756648c', // Agriculture
  '5e85a337-15d3-44b3-b30f-4396fa7cac6c': 'f02ed5d3-d8d7-491a-b457-a061a69665d4', // Computer Studies
  '182e858e-7199-44e7-8f6d-ead3dbff52f1': '27eab4c3-6fb3-45c8-baf0-6f2d5adaeee1', // Home Science
}

// CBC Junior: Grade 7 JSS (95e60c71) - sparse subjects (1 strand each)
// copy from Grade 7 old (f4b2f72e) which has full data
const GRADE7_JSS_LA_MAP: Record<string, string> = {
  'f77c46aa-5bd4-4d22-9d15-5c25f647412c': '966a4a76-0ef6-4127-b6ad-b89c9d930ed6', // Mathematics
  '9f49646d-1422-4bc7-9b96-3279d8c57745': '6ff6b886-7ad2-4812-82a9-d0ce18f3f17a', // English
  '1ec57801-76d5-4fff-ae3a-6100bb420467': 'a7cbbf0e-5e74-4777-97e1-083d4c789565', // Kiswahili
  '52b10aa7-f94c-4c9d-adec-424ac0cff52c': 'f2d8d6a2-fa51-414b-9d10-59d56942d0fb', // Social Studies
}

// CBC Junior: Grade 8 JSS (d9015d03) - missing subjects
const GRADE8_JSS_LA_MAP: Record<string, string> = {
  '911000a3-7d36-4187-883e-be2cb0fcd94f': 'fac943d6-0604-4249-9a21-b6ed39409997', // Integrated Science
  'ee0e64a2-c885-430f-b86c-0d63aeada80d': '77ce48f3-6163-4673-ab1c-58f542cad1e7', // Social Studies
  'fb7b8481-320d-4511-868e-e82f5f29c437': 'bba5e445-8487-4584-9c6a-62b802764793', // Pre-Technical Studies
  'b7b16169-5d51-442f-bf04-243b41815eea': '1591ab66-2a63-48f5-a551-42afbb0c78e3', // Agriculture and Nutrition
}

// CBC Junior: Grade 9 JSS (007e0d4a) - missing subjects
const GRADE9_JSS_LA_MAP: Record<string, string> = {
  '97c446a1-8912-4894-b775-068946b4f5fd': '793caf73-19be-429c-8ff7-43a9c2012784', // English
  'b75ab17b-4b93-436e-8409-1fd57460a0bf': '9eeb71e2-bb26-4627-8b39-6995b31fecc5', // Integrated Science
  '69c8ac81-a914-45f5-a68a-00aa1cc9ce44': '41701946-349a-47dd-ab00-db3e9eed2de4', // Social Studies
  '1fc14282-549b-4f24-865a-37a9a7d97a37': 'be68e0c8-4125-49f2-be49-32e911657e07', // Pre-Technical Studies
  '50fff27f-23c3-404e-b8ce-f5dc7f1dc723': '44a1b45d-3549-4610-beef-f4deb6a93966', // Agriculture and Nutrition
}

// ─── Core copy function ───────────────────────────────────────────────────────

async function copyStrandsAndSubstrands(
  laMap: Record<string, string>,
  label: string
) {
  console.log(`\n━━━ ${label} ━━━`)

  const oldLaIds = Object.keys(laMap)
  let totalStrands = 0
  let totalSubstrands = 0

  // Fetch all source strands for all old LAs in one query
  const { data: sourceStrands, error: stErr } = await supabase
    .from('sow_strands')
    .select('id, learning_area_id, title, order_index, source_type, kicd_data')
    .in('learning_area_id', oldLaIds)

  if (stErr) throw new Error(`[${label}] fetch strands: ${stErr.message}`)
  if (!sourceStrands?.length) {
    console.log('  ⚠ No source strands found — skipping')
    return
  }

  // Build old strand_id → new strand_id mapping + new strand rows
  const strandIdMap: Record<string, string> = {}
  const newStrandRows = sourceStrands.map(s => {
    const newId = randomUUID()
    strandIdMap[s.id] = newId
    return {
      id: newId,
      learning_area_id: laMap[s.learning_area_id],
      title: s.title,
      order_index: s.order_index,
      source_type: s.source_type ?? 'original',
      kicd_data: s.kicd_data ?? [],
    }
  })

  // Skip strands whose target LA is not mapped (shouldn't happen, just safety)
  const validStrandRows = newStrandRows.filter(r => r.learning_area_id)
  if (!validStrandRows.length) {
    console.log('  ⚠ No valid target LAs — skipping')
    return
  }

  // Insert new strands
  const { error: insStErr } = await supabase.from('sow_strands').insert(validStrandRows)
  if (insStErr) throw new Error(`[${label}] insert strands: ${insStErr.message}`)
  totalStrands = validStrandRows.length
  console.log(`  ✓ Inserted ${totalStrands} strands`)

  // Fetch all source substrands
  const oldStrandIds = sourceStrands.map(s => s.id)
  const { data: sourceSubstrands, error: subErr } = await supabase
    .from('sow_substrands')
    .select('id, strand_id, title, suggested_lessons, order_index, content, source_type')
    .in('strand_id', oldStrandIds)

  if (subErr) throw new Error(`[${label}] fetch substrands: ${subErr.message}`)
  if (!sourceSubstrands?.length) {
    console.log('  ⚠ No source substrands found')
    return
  }

  const newSubstrandRows = sourceSubstrands
    .filter(ss => strandIdMap[ss.strand_id]) // only substrands whose strand was copied
    .map(ss => ({
      id: randomUUID(),
      strand_id: strandIdMap[ss.strand_id],
      title: ss.title,
      suggested_lessons: ss.suggested_lessons ?? 4,
      order_index: ss.order_index,
      content: ss.content,
      source_type: ss.source_type ?? 'original',
    }))

  // Insert in batches of 200 to avoid payload limits
  const BATCH = 200
  for (let i = 0; i < newSubstrandRows.length; i += BATCH) {
    const batch = newSubstrandRows.slice(i, i + BATCH)
    const { error: insSubErr } = await supabase.from('sow_substrands').insert(batch)
    if (insSubErr) throw new Error(`[${label}] insert substrands batch ${i}: ${insSubErr.message}`)
  }
  totalSubstrands = newSubstrandRows.length
  console.log(`  ✓ Inserted ${totalSubstrands} substrands`)

  console.log(`  → Done: ${totalStrands} strands, ${totalSubstrands} substrands`)
}

// ─── Main ─────────────────────────────────────────────────────────────────────

async function main() {
  console.log('EduNexus — Curriculum Data Migration')
  console.log('=====================================')
  console.log('Populating strands & substrands for:')
  console.log('  • 8-4-4 Form 3 (SS-Forms level)')
  console.log('  • 8-4-4 Form 4 (SS-Forms level)')
  console.log('  • CBC Junior Grade 7 JSS (sparse subjects)')
  console.log('  • CBC Junior Grade 8 JSS (missing subjects)')
  console.log('  • CBC Junior Grade 9 JSS (missing subjects)')

  // Pre-flight: verify target LAs exist and have no strands yet
  const allTargetLaIds = [
    ...Object.values(FORM3_LA_MAP),
    ...Object.values(FORM4_LA_MAP),
    ...Object.values(GRADE7_JSS_LA_MAP),
    ...Object.values(GRADE8_JSS_LA_MAP),
    ...Object.values(GRADE9_JSS_LA_MAP),
  ]

  const { data: existingStrands } = await supabase
    .from('sow_strands')
    .select('learning_area_id')
    .in('learning_area_id', [...new Set(allTargetLaIds)])

  if (existingStrands?.length) {
    const alreadyDone = [...new Set(existingStrands.map(s => s.learning_area_id))]
    console.log(`\n⚠ WARNING: ${alreadyDone.length} target LAs already have strands.`)
    console.log('  These will be skipped to avoid duplicates. If you need to re-run,')
    console.log('  manually delete those strands first.\n')
  }

  // Build "already has data" set to skip
  const alreadyHasData = new Set((existingStrands || []).map(s => s.learning_area_id))

  function filterMap(map: Record<string, string>): Record<string, string> {
    const filtered: Record<string, string> = {}
    for (const [oldId, newId] of Object.entries(map)) {
      if (!alreadyHasData.has(newId)) filtered[oldId] = newId
    }
    return filtered
  }

  const f3Map = filterMap(FORM3_LA_MAP)
  const f4Map = filterMap(FORM4_LA_MAP)
  const g7Map = filterMap(GRADE7_JSS_LA_MAP)
  const g8Map = filterMap(GRADE8_JSS_LA_MAP)
  const g9Map = filterMap(GRADE9_JSS_LA_MAP)

  if (Object.keys(f3Map).length) await copyStrandsAndSubstrands(f3Map, '8-4-4 Form 3 (SS-Forms)')
  else console.log('\n━━━ 8-4-4 Form 3 (SS-Forms) ━━━\n  Already populated — skipped')

  if (Object.keys(f4Map).length) await copyStrandsAndSubstrands(f4Map, '8-4-4 Form 4 (SS-Forms)')
  else console.log('\n━━━ 8-4-4 Form 4 (SS-Forms) ━━━\n  Already populated — skipped')

  if (Object.keys(g7Map).length) await copyStrandsAndSubstrands(g7Map, 'CBC Junior Grade 7 JSS (sparse subjects)')
  else console.log('\n━━━ CBC Junior Grade 7 JSS ━━━\n  Already populated — skipped')

  if (Object.keys(g8Map).length) await copyStrandsAndSubstrands(g8Map, 'CBC Junior Grade 8 JSS (missing subjects)')
  else console.log('\n━━━ CBC Junior Grade 8 JSS ━━━\n  Already populated — skipped')

  if (Object.keys(g9Map).length) await copyStrandsAndSubstrands(g9Map, 'CBC Junior Grade 9 JSS (missing subjects)')
  else console.log('\n━━━ CBC Junior Grade 9 JSS ━━━\n  Already populated — skipped')

  console.log('\n✅ Migration complete!')
  console.log('\nVerifying totals...')

  // Quick verification
  const { count: strandCount } = await supabase
    .from('sow_strands')
    .select('*', { count: 'exact', head: true })

  const { count: substrandCount } = await supabase
    .from('sow_substrands')
    .select('*', { count: 'exact', head: true })

  console.log(`  sow_strands total: ${strandCount}`)
  console.log(`  sow_substrands total: ${substrandCount}`)
}

main().catch(err => {
  console.error('Migration failed:', err)
  process.exit(1)
})
