/**
 * Fix thin JSS (Grade 7/8/9) learning areas.
 *
 * Strategy: for each thin LA in the NEW project, delete its placeholder
 * strands+substrands, then copy fresh from the matching donor LA in the
 * OLD project.
 *
 * Skipped: Creative Arts and Sports (no donor data in old project).
 */

import { createClient } from '@supabase/supabase-js'
import { randomUUID } from 'crypto'

const OLD_URL = 'https://hvvzpesxsvuvlqytcvsq.supabase.co'
const OLD_KEY = 'REDACTED_JASHOR_SERVICE_KEY'

const NEW_URL = 'https://lpxrfbmzncaztpmyqzkc.supabase.co'
const NEW_KEY = 'REDACTED_EDUNEXUS_SERVICE_KEY'

const old = createClient(OLD_URL, OLD_KEY)
const db  = createClient(NEW_URL, NEW_KEY)

// new_la_id → old_la_id (donor in old project)
const THIN_MAP: Record<string, { oldLaId: string; label: string }> = {
  // ── Grade 7 ──
  'd1cd810b-fa73-41b9-96f1-c42185a957c1': { oldLaId: '6d33ffd6-46f4-4558-aed1-e9f64c212a1c', label: 'G7 Integrated Science' },
  '0ac7d387-bac1-4353-b6ff-bb4dfc865014': { oldLaId: 'ad83f423-eb5d-428f-9d78-c2b15d399077', label: 'G7 CRE' },
  '3796a982-2a16-4d5b-a592-5fdae5bb0d42': { oldLaId: '749b1726-1303-44ae-8bbf-54f0843801a1', label: 'G7 IRE' },
  '8e65b091-0815-47f9-92e6-bd618222c433': { oldLaId: 'ebd07d79-76b5-48fa-acfe-34503ac3c27d', label: 'G7 Pre-Technical Studies' },
  '3c3fc2f3-5abe-4fd3-a713-203201f11fb5': { oldLaId: '2f1f8fb5-eb21-47b2-acec-aaf6ec5320b0', label: 'G7 Agriculture and Nutrition' },

  // ── Grade 8 ──
  'b3240569-492e-4d41-8bf9-b6db97c297f8': { oldLaId: '7a5a3ebd-de18-401d-945c-0d8474a30290', label: 'G8 Mathematics' },
  '055ac676-7d8e-4a1e-9e6c-6e2885344064': { oldLaId: '497679df-e2d3-4e13-9764-44f632664613', label: 'G8 English' },
  'bb266822-2add-4bf4-8588-9c2239acb501': { oldLaId: '8317edff-0dbe-441f-8031-431605b3f247', label: 'G8 Kiswahili' },
  '855e9512-007d-47d5-b095-5b449013cac1': { oldLaId: '35b7a5ac-0341-4f77-b943-5d0d7306cc75', label: 'G8 CRE' },
  '56261cfd-cb95-4d09-95c4-6fcb8d7d4d89': { oldLaId: '6d2b519a-b7f3-4d59-9f3e-f8df9fd1c700', label: 'G8 IRE' },

  // ── Grade 9 ──
  '57160283-d0e3-4b31-b982-c7f3d0d7cdae': { oldLaId: '0f6ca968-de7b-4f5c-9de2-b0f48c591855', label: 'G9 Mathematics' },
  '84b6f91d-da00-4da7-befd-35a719031d2a': { oldLaId: 'b687be07-7e99-4ae1-8dd3-2544f81cdcfd', label: 'G9 Kiswahili' },
  '8e5d2c66-f519-46fd-8ebe-558d14fa681d': { oldLaId: '8b5c7790-487e-4a13-a073-01f7ec895d12', label: 'G9 CRE' },
  '52efff50-8f6e-4c81-a61c-987d4d354e52': { oldLaId: '0547e665-0f72-41af-9258-82b30223b04e', label: 'G9 IRE' },
}

async function paginate<T>(table: string, client: any, column: string, ids: string[]): Promise<T[]> {
  const all: T[] = []
  const PAGE = 1000
  let from = 0
  while (true) {
    const { data, error } = await client
      .from(table)
      .select('*')
      .in(column, ids)
      .order('order_index')
      .range(from, from + PAGE - 1)
    if (error) throw new Error(`paginate ${table}: ${error.message}`)
    if (data) all.push(...data)
    if (!data || data.length < PAGE) break
    from += PAGE
  }
  return all
}

async function fixLa(newLaId: string, oldLaId: string, label: string) {
  process.stdout.write(`  ${label} ... `)

  // 1. Fetch donor strands from old project
  const { data: oldStrands, error: osErr } = await old
    .from('strands')
    .select('id, title, order_index')
    .eq('learning_area_id', oldLaId)
    .order('order_index')
  if (osErr) throw new Error(`${label}: fetch old strands: ${osErr.message}`)
  if (!oldStrands?.length) {
    console.log('⚠ no donor strands — skipped')
    return
  }

  // 2. Fetch donor substrands (paginated)
  const oldStrandIds = oldStrands.map(s => s.id)
  const oldSubstrands = await paginate<any>('substrands', old, 'strand_id', oldStrandIds)

  // 3. Delete existing new substrands → new strands
  const { data: existingStrands } = await db
    .from('sow_strands')
    .select('id')
    .eq('learning_area_id', newLaId)

  if (existingStrands?.length) {
    const existingIds = existingStrands.map(s => s.id)
    const { error: delSubErr } = await db.from('sow_substrands').delete().in('strand_id', existingIds)
    if (delSubErr) throw new Error(`${label}: delete substrands: ${delSubErr.message}`)
    const { error: delStErr } = await db.from('sow_strands').delete().in('id', existingIds)
    if (delStErr) throw new Error(`${label}: delete strands: ${delStErr.message}`)
  }

  // 4. Insert new strands with fresh UUIDs
  const strandIdMap: Record<string, string> = {}
  const newStrandRows = oldStrands.map(s => {
    const newId = randomUUID()
    strandIdMap[s.id] = newId
    return {
      id: newId,
      learning_area_id: newLaId,
      title: s.title,
      order_index: s.order_index,
      source_type: 'original',
      kicd_data: [],
    }
  })

  const { error: insStErr } = await db.from('sow_strands').insert(newStrandRows)
  if (insStErr) throw new Error(`${label}: insert strands: ${insStErr.message}`)

  // 5. Insert new substrands in batches of 200
  const newSubRows = oldSubstrands
    .filter(ss => strandIdMap[ss.strand_id])
    .map(ss => ({
      id: randomUUID(),
      strand_id: strandIdMap[ss.strand_id],
      title: ss.title,
      suggested_lessons: 4,
      order_index: ss.order_index,
      content: null,
      source_type: 'original',
    }))

  const BATCH = 200
  for (let i = 0; i < newSubRows.length; i += BATCH) {
    const { error } = await db.from('sow_substrands').insert(newSubRows.slice(i, i + BATCH))
    if (error) throw new Error(`${label}: insert substrands batch ${i}: ${error.message}`)
  }

  console.log(`✓  ${oldStrands.length} strands, ${newSubRows.length} substrands`)
}

async function main() {
  console.log('Fix thin JSS learning areas')
  console.log('===========================')

  for (const [newLaId, { oldLaId, label }] of Object.entries(THIN_MAP)) {
    await fixLa(newLaId, oldLaId, label)
  }

  // Verification
  console.log('\n--- Verification ---')
  for (const [newLaId, { label }] of Object.entries(THIN_MAP)) {
    const { data: strands } = await db
      .from('sow_strands')
      .select('id')
      .eq('learning_area_id', newLaId)
    const strandIds = (strands || []).map(s => s.id)
    let subCount = 0
    if (strandIds.length) {
      const subs = await paginate<any>('sow_substrands', db, 'strand_id', strandIds)
      subCount = subs.length
    }
    const flag = subCount < 5 ? '🔴' : subCount < 20 ? '🟡' : '✅'
    console.log(`  ${flag} ${label.padEnd(35)} strands=${strands?.length ?? 0}  subs=${subCount}`)
  }

  console.log('\n✅ Done')
}

main().catch(err => { console.error(err); process.exit(1) })
