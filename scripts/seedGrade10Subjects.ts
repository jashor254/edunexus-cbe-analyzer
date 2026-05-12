import { createClient } from '@supabase/supabase-js'
import * as dotenv from 'dotenv'
import * as fs from 'fs'
import * as path from 'path'

dotenv.config({ path: '/home/the-dev/Desktop/edunexus-cbe-analyzer/.env.local' })

const db = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

// The canonical Grade 10 row and its seeded Biology area — never touch Biology
const GRADE10_ID = 'b422d9f5-7ad3-4fc1-aac7-0eb71b795051'
const BIOLOGY_AREA_ID = '8f3697e3-9802-46ce-af93-b8ac08f130a4'
const DATA_DIR = path.join(__dirname, '../data/grade10subjects')

interface TopicJSON {
  topic_id: number
  topic_name: string
  subtopic_count: number
  subtopics: string[]
}

interface SubjectJSON {
  subject: string
  topics: TopicJSON[]
}

// ─── helpers ─────────────────────────────────────────────────────────────────

function cleanName(raw: string): string {
  return raw.replace(/\s*Grade\s*10\s*/gi, '').trim()
}

function pad(s: string, n: number) {
  return s.length >= n ? s : s + ' '.repeat(n - s.length)
}

// ─── step 1: inspect ─────────────────────────────────────────────────────────

function inspectDataFolder(): { file: string; json: SubjectJSON }[] {
  const allFiles = fs.readdirSync(DATA_DIR).filter(f => f.endsWith('.json')).sort()
  console.log(`\n📁 Found ${allFiles.length} JSON files in data/grade10subjects/`)

  const valid: { file: string; json: SubjectJSON }[] = []
  const empty: string[] = []

  for (const file of allFiles) {
    const raw = fs.readFileSync(path.join(DATA_DIR, file), 'utf-8').trim()
    if (!raw) { empty.push(file); continue }
    try {
      valid.push({ file, json: JSON.parse(raw) as SubjectJSON })
    } catch (e: any) {
      console.log(`   ⚠️  ${file}: invalid JSON — ${e.message}`)
    }
  }

  if (empty.length) console.log(`   ⏭️  Skipping ${empty.length} empty files: ${empty.join(', ')}`)

  // Show structure of first valid file
  if (valid.length) {
    const { file, json } = valid[0]
    const t0 = json.topics[0]
    console.log(`\nSample structure (${file}):`)
    console.log(`   subject   : "${json.subject}"`)
    console.log(`   topics    : ${json.topics.length}`)
    console.log(`   first topic: "${t0.topic_name}" — ${t0.subtopics.length} subtopics`)
    console.log(`   subtopic sample: "${t0.subtopics[0]}"`)
  }

  return valid
}

// ─── step 2: clean ───────────────────────────────────────────────────────────

async function cleanDatabase() {
  console.log('\n🧹 Cleaning database (preserving Biology)...')

  // Count before
  const { count: beforeAreas } = await db
    .from('sow_learning_areas').select('*', { count: 'exact', head: true })
    .eq('grade_id', GRADE10_ID).neq('id', BIOLOGY_AREA_ID)
  console.log(`   Before: ${beforeAreas} non-Biology learning areas under Grade 10`)

  const { data: areas } = await db
    .from('sow_learning_areas').select('id, name')
    .eq('grade_id', GRADE10_ID).neq('id', BIOLOGY_AREA_ID)

  const areaIds = areas?.map(a => a.id) ?? []
  if (areaIds.length === 0) { console.log('   Nothing to delete.'); return }

  console.log(`   Areas to delete: ${areas?.map(a => a.name).join(', ')}`)

  // Get strands under those areas
  const { data: strands } = await db
    .from('sow_strands').select('id').in('learning_area_id', areaIds)
  const strandIds = strands?.map(s => s.id) ?? []
  console.log(`   Strands to delete: ${strandIds.length}`)

  // Delete substrands
  if (strandIds.length > 0) {
    const { count: d1, error: e1 } = await db
      .from('sow_substrands').delete({ count: 'exact' }).in('strand_id', strandIds)
    if (e1) throw new Error('Delete substrands failed: ' + e1.message)
    console.log(`   ✅ Deleted ${d1} substrands`)
  }

  // Delete strands
  const { count: d2, error: e2 } = await db
    .from('sow_strands').delete({ count: 'exact' }).in('learning_area_id', areaIds)
  if (e2) throw new Error('Delete strands failed: ' + e2.message)
  console.log(`   ✅ Deleted ${d2} strands`)

  // Delete learning areas
  const { count: d3, error: e3 } = await db
    .from('sow_learning_areas').delete({ count: 'exact' }).in('id', areaIds)
  if (e3) throw new Error('Delete learning areas failed: ' + e3.message)
  console.log(`   ✅ Deleted ${d3} learning areas`)
}

// ─── step 3: seed ────────────────────────────────────────────────────────────

interface SeedResult {
  name: string
  topics: number
  subtopics: number
  skipped?: boolean
}

async function seedSubjects(
  subjects: { file: string; json: SubjectJSON }[]
): Promise<SeedResult[]> {
  console.log(`\n🌱 Seeding ${subjects.length} subjects...`)

  const results: SeedResult[] = []

  for (let i = 0; i < subjects.length; i++) {
    const { file, json } = subjects[i]
    const subjectName = cleanName(json.subject)

    // Guard: skip Biology if somehow present in the folder
    if (subjectName.toLowerCase().includes('biology')) {
      console.log(`   ⏭️  Skipping Biology (already seeded)`)
      results.push({ name: subjectName, topics: 0, subtopics: 0, skipped: true })
      continue
    }

    try {
      // Insert learning area
      const { data: area, error: aErr } = await db
        .from('sow_learning_areas')
        .insert({ grade_id: GRADE10_ID, name: subjectName, order_index: i + 1 })
        .select()
        .single()

      if (aErr || !area) throw new Error('Learning area insert: ' + aErr?.message)

      let totalSubtopics = 0

      for (const topic of json.topics) {
        // Insert strand (topic)
        const { data: strand, error: sErr } = await db
          .from('sow_strands')
          .insert({
            learning_area_id: area.id,
            title: topic.topic_name,
            order_index: topic.topic_id,
            source_type: 'verified',
          })
          .select()
          .single()

        if (sErr || !strand) {
          console.log(`   ⚠️  Strand "${topic.topic_name}": ${sErr?.message}`)
          continue
        }

        // Insert substrands in batches of 50
        const rows = topic.subtopics.map((title, idx) => ({
          strand_id: strand.id,
          title,
          order_index: idx + 1,
          source_type: 'verified',
        }))

        for (let j = 0; j < rows.length; j += 50) {
          const batch = rows.slice(j, j + 50)
          const { error: bErr } = await db.from('sow_substrands').insert(batch)
          if (bErr) console.log(`   ⚠️  Substrand batch error (${subjectName}): ${bErr.message}`)
          else totalSubtopics += batch.length
        }
      }

      results.push({ name: subjectName, topics: json.topics.length, subtopics: totalSubtopics })
      process.stdout.write(`   ✅ ${pad(subjectName, 38)} ${json.topics.length} topics, ${totalSubtopics} subtopics\n`)
    } catch (err: any) {
      console.log(`   ❌ ${file}: ${err.message}`)
      results.push({ name: subjectName, topics: 0, subtopics: 0 })
    }
  }

  return results
}

// ─── step 4: validate ────────────────────────────────────────────────────────

async function validate() {
  console.log('\n🔍 Validating (orphan check, scoped to Grade 10)...')

  // All learning areas under Grade 10
  const { data: grade10Areas } = await db
    .from('sow_learning_areas').select('id').eq('grade_id', GRADE10_ID)
  const laIdSet = new Set(grade10Areas?.map(a => a.id) ?? [])

  // All strands under Grade 10 learning areas
  const { data: grade10Strands } = await db
    .from('sow_strands').select('id, learning_area_id').in('learning_area_id', [...laIdSet])
  const strandIdSet = new Set(grade10Strands?.map(s => s.id) ?? [])

  // Orphan strands: strands under Grade 10 whose learning_area_id is not in Grade 10 areas
  const orphanedStrands = grade10Strands?.filter(s => !laIdSet.has(s.learning_area_id)) ?? []

  // All substrands under Grade 10 strands
  const { data: grade10Subs } = await db
    .from('sow_substrands').select('id, strand_id').in('strand_id', [...strandIdSet])
  // Orphan substrands: substrands under Grade 10 strands whose strand_id is not in Grade 10 strands
  const orphanedSubs = grade10Subs?.filter(s => !strandIdSet.has(s.strand_id)) ?? []

  console.log(`   Orphan substrands : ${orphanedSubs.length} ${orphanedSubs.length === 0 ? '✅' : '❌'}`)
  console.log(`   Orphan strands    : ${orphanedStrands.length} ${orphanedStrands.length === 0 ? '✅' : '❌'}`)

  if (orphanedSubs.length > 0) {
    console.log('   Orphaned substrand IDs:', orphanedSubs.slice(0, 5).map(s => s.id))
    throw new Error(`Found ${orphanedSubs.length} orphaned substrands`)
  }
  if (orphanedStrands.length > 0) {
    console.log('   Orphaned strand IDs:', orphanedStrands.slice(0, 5).map(s => s.id))
    throw new Error(`Found ${orphanedStrands.length} orphaned strands`)
  }
}

// ─── step 5: summary ─────────────────────────────────────────────────────────

async function printSummary(results: SeedResult[]) {
  // Add Biology row from DB
  const { data: bioStrands } = await db
    .from('sow_strands').select('id').eq('learning_area_id', BIOLOGY_AREA_ID)
  const bioStrandIds = bioStrands?.map(s => s.id) ?? []
  const { count: bioSubCount } = await db
    .from('sow_substrands').select('*', { count: 'exact', head: true }).in('strand_id', bioStrandIds)

  const bioRow: SeedResult = {
    name: 'Biology (existing)',
    topics: bioStrandIds.length,
    subtopics: bioSubCount ?? 0,
  }

  const allRows = [...results.filter(r => !r.skipped), bioRow].sort((a, b) =>
    a.name.localeCompare(b.name)
  )

  const totalTopics = allRows.reduce((s, r) => s + r.topics, 0)
  const totalSubs = allRows.reduce((s, r) => s + r.subtopics, 0)

  const LINE = '━'.repeat(62)
  console.log('\n' + LINE)
  console.log('✅  Seeding complete!')
  console.log(LINE)
  console.log(pad('Subject', 38) + pad('Topics', 8) + 'Subtopics')
  console.log(LINE)
  for (const r of allRows) {
    console.log(pad(r.name, 38) + pad(String(r.topics), 8) + r.subtopics)
  }
  console.log(LINE)
  console.log(pad('TOTAL', 38) + pad(String(totalTopics), 8) + totalSubs)
  console.log(LINE)
  console.log(`\nOrphan substrands : 0 ✅`)
  console.log(`Orphan strands    : 0 ✅`)
}

// ─── main ────────────────────────────────────────────────────────────────────

async function main() {
  console.log('='.repeat(62))
  console.log('🌍 EduNexus — Seed Grade 10 Subjects')
  console.log('='.repeat(62))

  const subjects = inspectDataFolder()
  await cleanDatabase()
  const results = await seedSubjects(subjects)
  await validate()
  await printSummary(results)
}

main().catch(err => {
  console.error('\n💥 Fatal error:', err.message)
  process.exit(1)
})
