import { createClient } from '@supabase/supabase-js'
import * as dotenv from 'dotenv'
dotenv.config({ path: '/home/the-dev/Desktop/edunexus-cbe-analyzer/.env.local' })

const db = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

function sep(title: string) {
  console.log('\n' + '═'.repeat(60))
  console.log(title)
  console.log('═'.repeat(60))
}

async function run() {

  // ── Q1: All levels ──────────────────────────────────────────
  sep('Q1: All levels')
  const { data: levels, error: e1 } = await db
    .from('levels')
    .select('id, name, code')
    .order('order')
  if (e1) { console.log('ERROR:', e1.message) }
  else { console.table(levels) }

  // ── Q2: All grades ──────────────────────────────────────────
  sep('Q2: All grades')
  const { data: grades, error: e2 } = await db
    .from('grades')
    .select('id, name, code, level_id')
    .order('order')
  if (e2) { console.log('ERROR:', e2.message) }
  else { console.table(grades) }

  // ── Q3: Subjects joined to grade name ───────────────────────
  sep('Q3: All subjects (with grade_id, first 40)')
  const { data: allSubjects, error: e3 } = await db
    .from('subjects')
    .select('name, id, grade_id')
    .order('name')
    .limit(40)
  if (e3) { console.log('ERROR:', e3.message) }
  else { console.table(allSubjects) }

  // ── Q4: sow_learning_areas ──────────────────────────────────
  sep('Q4: sow_learning_areas (all)')
  const { data: sowAreas, error: e4 } = await db
    .from('sow_learning_areas')
    .select('id, name, grade_id')
    .order('name')
  if (e4) { console.log('ERROR:', e4.message) }
  else {
    console.log(`Total: ${sowAreas?.length}`)
    console.table(sowAreas?.slice(0, 30))
  }

  // ── Q5: sow_strands count per learning area ─────────────────
  sep('Q5: sow_strands count per learning area')
  const { data: sowAreasForCount, error: e5a } = await db
    .from('sow_learning_areas')
    .select('id, name')
  const { data: sowStrands, error: e5b } = await db
    .from('sow_strands')
    .select('id, learning_area_id, title')
  if (e5a || e5b) { console.log('ERROR:', e5a?.message || e5b?.message) }
  else {
    const counts: Record<string, { name: string; count: number }> = {}
    sowAreasForCount?.forEach(a => { counts[a.id] = { name: a.name, count: 0 } })
    sowStrands?.forEach(s => { if (counts[s.learning_area_id]) counts[s.learning_area_id].count++ })
    const rows = Object.values(counts).sort((a, b) => a.name.localeCompare(b.name))
    console.log(`Total strands: ${sowStrands?.length}`)
    console.table(rows)
  }

  // ── Q6: sow_substrands count per strand (sample 20) ─────────
  sep('Q6: sow_substrands count per strand (first 20 strands)')
  const { data: sowSubstrands, error: e6 } = await db
    .from('sow_substrands')
    .select('id, strand_id')
  if (e6) { console.log('ERROR:', e6.message) }
  else {
    const strandCounts: Record<string, number> = {}
    sowSubstrands?.forEach(ss => {
      strandCounts[ss.strand_id] = (strandCounts[ss.strand_id] || 0) + 1
    })
    const rows = sowStrands?.slice(0, 20).map(st => ({
      strand: st.title.slice(0, 45),
      substrand_count: strandCounts[st.id] || 0,
    }))
    console.log(`Total substrands: ${sowSubstrands?.length}`)
    console.table(rows)
  }

  // ── Q7: set_books table ──────────────────────────────────────
  sep('Q7: set_books (first 20)')
  const { data: setBooks, error: e7 } = await db
    .from('set_books')
    .select('id, book_title, book_author, learning_area_id')
    .order('book_title')
    .limit(20)
  if (e7) { console.log('ERROR:', e7.message) }
  else {
    console.log(`Total returned: ${setBooks?.length}`)
    console.table(setBooks)
  }

  // ── Q8: topics table — Form 3/4 data ────────────────────────
  sep('Q8: topics table — any Form data?')
  const { data: topics, error: e8 } = await db
    .from('topics')
    .select('id, subject_id, name')
    .limit(5)
  if (e8) { console.log('ERROR:', e8.message) }
  else {
    console.log(`topics sample (5 rows):`)
    console.table(topics)
    const { count: topicCount } = await db
      .from('topics')
      .select('*', { count: 'exact', head: true })
    console.log(`Total topics in table: ${topicCount}`)
  }

  // ── Q9: KICD data in sow_strands ────────────────────────────
  sep('Q9: KICD data population in sow_strands')
  const { data: kicdStrands, error: e9 } = await db
    .from('sow_strands')
    .select('id, kicd_data')
  if (e9) { console.log('ERROR:', e9.message) }
  else {
    const total = kicdStrands?.length || 0
    const withKicd = kicdStrands?.filter(s => {
      const d = s.kicd_data
      return d && JSON.stringify(d) !== '[]' && JSON.stringify(d) !== 'null'
    }).length || 0
    console.log(`Total strands    : ${total}`)
    console.log(`With KICD data   : ${withKicd}`)
    console.log(`Without KICD data: ${total - withKicd}`)
  }

  // ── Q10: KICD data in sow_learning_areas ────────────────────
  sep('Q10: KICD data population in sow_learning_areas')
  const { data: kicdAreas, error: e10 } = await db
    .from('sow_learning_areas')
    .select('id, name, kicd_subject_data')
  if (e10) { console.log('ERROR:', e10.message) }
  else {
    const total = kicdAreas?.length || 0
    const withKicd = kicdAreas?.filter(a => {
      const d = a.kicd_subject_data
      return d && JSON.stringify(d) !== '{}' && JSON.stringify(d) !== 'null'
    }).length || 0
    console.log(`Total areas      : ${total}`)
    console.log(`With KICD data   : ${withKicd}`)
    console.log(`Without KICD data: ${total - withKicd}`)
  }

  // ── Q11: sow_levels and sow_grades ──────────────────────────
  sep('Q11: sow_levels and sow_grades')
  const { data: sowLevels, error: e11a } = await db
    .from('sow_levels')
    .select('id, name, curriculum_type, order_index')
    .order('order_index')
  const { data: sowGrades, error: e11b } = await db
    .from('sow_grades')
    .select('id, name, numeric_grade, level_id, order_index')
    .order('numeric_grade')
  if (e11a) { console.log('sow_levels ERROR:', e11a.message) }
  else { console.log('sow_levels:'); console.table(sowLevels) }
  if (e11b) { console.log('sow_grades ERROR:', e11b.message) }
  else { console.log('sow_grades:'); console.table(sowGrades) }
}

run().catch(console.error)
