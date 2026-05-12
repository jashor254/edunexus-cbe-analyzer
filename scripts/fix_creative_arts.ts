/**
 * Fix Creative Arts and Sports (Grade 7/8/9) by reading the rich KICD JSON
 * stored in kicd_curriculum.data and populating sow_strands + sow_substrands.
 */

import { createClient } from '@supabase/supabase-js'
import { randomUUID } from 'crypto'

const OLD_URL = 'https://hvvzpesxsvuvlqytcvsq.supabase.co'
const OLD_KEY = 'REDACTED_JASHOR_SERVICE_KEY'

const NEW_URL = 'https://lpxrfbmzncaztpmyqzkc.supabase.co'
const NEW_KEY = 'REDACTED_EDUNEXUS_SERVICE_KEY'

const old = createClient(OLD_URL, OLD_KEY)
const db  = createClient(NEW_URL, NEW_KEY)

async function main() {
  console.log('Fix Creative Arts and Sports (Grade 7/8/9)')
  console.log('==========================================')

  // Fetch KICD JSON for all 3 grades
  const { data: rows, error } = await old
    .from('kicd_curriculum')
    .select('subject, grade_id, learning_area_id, data')
    .eq('subject', 'Creative Arts and Sports')

  if (error) throw new Error(`fetch kicd_curriculum: ${error.message}`)
  if (!rows?.length) throw new Error('No Creative Arts and Sports rows found in kicd_curriculum')

  for (const row of rows) {
    const d = row.data as any
    const grade = d.grade
    const newLaId = row.learning_area_id as string
    const strandDefs: any[] = d.strands || []

    process.stdout.write(`  Grade ${grade} (${strandDefs.length} strands) ... `)

    // 1. Clear existing thin strands + substrands
    const { data: existingStrands } = await db
      .from('sow_strands')
      .select('id')
      .eq('learning_area_id', newLaId)

    if (existingStrands?.length) {
      const ids = existingStrands.map(s => s.id)
      const { error: delSubErr } = await db.from('sow_substrands').delete().in('strand_id', ids)
      if (delSubErr) throw new Error(`G${grade}: delete substrands: ${delSubErr.message}`)
      const { error: delStErr } = await db.from('sow_strands').delete().in('id', ids)
      if (delStErr) throw new Error(`G${grade}: delete strands: ${delStErr.message}`)
    }

    // 2. Insert strands + substrands from KICD data
    let strandOrder = 1
    let totalSubs = 0

    for (const stDef of strandDefs) {
      const strandId = randomUUID()
      const { error: insStErr } = await db.from('sow_strands').insert({
        id: strandId,
        learning_area_id: newLaId,
        title: stDef.strand,
        order_index: strandOrder++,
        source_type: 'kicd',
        kicd_data: [],
      })
      if (insStErr) throw new Error(`G${grade}: insert strand: ${insStErr.message}`)

      const subRows = (stDef.substrands || []).map((ss: any, idx: number) => ({
        id: randomUUID(),
        strand_id: strandId,
        title: ss.code ? `${ss.code} ${ss.title}` : ss.title,
        suggested_lessons: ss.suggested_lessons ?? 4,
        order_index: idx + 1,
        content: {
          learning_outcomes: ss.learning_outcomes || [],
          learning_experiences: ss.learning_experiences || [],
          key_inquiry_questions: ss.key_inquiry_questions || [],
          learning_resources: ss.learning_resources || [],
          assessment_methods: ss.assessment_methods || [],
        },
        source_type: 'kicd',
      }))

      if (subRows.length) {
        const { error: insSubErr } = await db.from('sow_substrands').insert(subRows)
        if (insSubErr) throw new Error(`G${grade}: insert substrands: ${insSubErr.message}`)
        totalSubs += subRows.length
      }
    }

    console.log(`✓  ${strandDefs.length} strands, ${totalSubs} substrands`)
  }

  // Verification
  console.log('\n--- Verification ---')
  const laIds = [
    '01c02f11-15d5-4cee-88be-9bd22edfdf9c', // G7
    '7771e0e9-a2a4-43ad-b884-8c8d95db886b', // G8
    'e5ec8993-735a-474e-b30d-7debb370426b', // G9
  ]
  for (const laId of laIds) {
    const { data: strands } = await db.from('sow_strands').select('id').eq('learning_area_id', laId)
    const ids = (strands || []).map(s => s.id)
    let subCount = 0
    if (ids.length) {
      const { count } = await db.from('sow_substrands').select('*', { count: 'exact', head: true }).in('strand_id', ids)
      subCount = count ?? 0
    }
    console.log(`  la=${laId}: strands=${strands?.length ?? 0}  subs=${subCount}`)
  }

  console.log('\n✅ Done')
}

main().catch(err => { console.error(err); process.exit(1) })
