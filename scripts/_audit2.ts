import { createClient } from '@supabase/supabase-js'
import * as dotenv from 'dotenv'
dotenv.config({ path: '/home/the-dev/Desktop/edunexus-cbe-analyzer/.env.local' })

const db = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!)

async function run() {
  const GRADE10_ID = 'b422d9f5-7ad3-4fc1-aac7-0eb71b795051'

  // Count sow_substrands for Grade 10
  const { data: areas } = await db.from('sow_learning_areas').select('id, name').eq('grade_id', GRADE10_ID)
  const areaIds = areas?.map(a => a.id) ?? []
  const { data: strands } = await db.from('sow_strands').select('id, learning_area_id, title').in('learning_area_id', areaIds)
  const strandIds = strands?.map(s => s.id) ?? []
  const { count: subCount } = await db.from('sow_substrands').select('*', { count: 'exact', head: true }).in('strand_id', strandIds)

  console.log(`sow_learning_areas for Grade 10: ${areas?.length}`)
  console.log(`sow_strands for Grade 10:        ${strands?.length}`)
  console.log(`sow_substrands for Grade 10:     ${subCount}`)

  const strandCountByArea: Record<string, number> = {}
  strands?.forEach(s => {
    const name = areas?.find(a => a.id === s.learning_area_id)?.name ?? '?'
    strandCountByArea[name] = (strandCountByArea[name] || 0) + 1
  })
  console.log('\nStrands per subject (sow_strands):')
  Object.entries(strandCountByArea).sort((a, b) => a[0].localeCompare(b[0])).forEach(([name, n]) => {
    console.log(`  ${name.padEnd(42)} ${n}`)
  })

  // Check topics table
  const { data: topicsSample, error: topicsErr } = await db.from('topics').select('id, subject_id, name').limit(5)
  if (topicsErr) {
    console.log('\ntopics table: NOT FOUND —', topicsErr.message)
  } else {
    const { count: topicsCount } = await db.from('topics').select('*', { count: 'exact', head: true })
    console.log(`\ntopics table: EXISTS — ${topicsCount} rows`)
    console.table(topicsSample)
  }

  // Check subtopics table
  const { data: subtopicsSample, error: subtopicsErr } = await db.from('subtopics').select('id, topic_id, name').limit(3)
  if (subtopicsErr) {
    console.log('subtopics table: NOT FOUND —', subtopicsErr.message)
  } else {
    const { count: subtopicsCount } = await db.from('subtopics').select('*', { count: 'exact', head: true })
    console.log(`subtopics table: EXISTS — ${subtopicsCount} rows`)
    console.table(subtopicsSample)
  }
}

run().catch(console.error)
