/**
 * cleanMigrate.ts
 * Clean migration: jashor-app → EduNexus DB
 * Uses unified_strands + unified_substrands as source of truth.
 * Run: npx tsx scripts/cleanMigrate.ts
 */

import { createClient } from '@supabase/supabase-js'
import * as dotenv from 'dotenv'
import * as path from 'path'

dotenv.config({ path: path.resolve(process.cwd(), '.env.local') })

const oldDb = createClient(
  'https://hvvzpesxsvuvlqytcvsq.supabase.co',
  process.env.OLD_SUPABASE_KEY!,
  { auth: { autoRefreshToken: false, persistSession: false } }
)

const newDb = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { auth: { autoRefreshToken: false, persistSession: false } }
)

// ── Helpers ───────────────────────────────────────────────────────────────────

async function fetchAll(table: string): Promise<any[]> {
  const PAGE = 1000
  let all: any[] = []
  let from = 0

  while (true) {
    const { data, error } = await oldDb
      .from(table)
      .select('*')
      .range(from, from + PAGE - 1)

    if (error) {
      if (
        error.message?.includes('does not exist') ||
        error.code === '42P01' ||
        error.message?.includes('relation')
      ) {
        console.log(`⚠️  Table "${table}" not found in old DB — skipping`)
        return []
      }
      console.error(`❌ Fetch error on ${table}:`, error.message)
      return []
    }

    if (!data || data.length === 0) break
    all = [...all, ...data]
    if (data.length < PAGE) break
    from += PAGE
  }

  return all
}

async function insertBatched(
  table: string,
  rows: any[],
  batchSize = 200
): Promise<number> {
  if (rows.length === 0) return 0
  let inserted = 0

  for (let i = 0; i < rows.length; i += batchSize) {
    const batch = rows.slice(i, i + batchSize)
    const { error } = await newDb
      .from(table)
      .upsert(batch, { onConflict: 'id' })

    if (error) {
      console.error(`❌ Insert error on ${table} batch ${i}:`, error.message)
    } else {
      inserted += batch.length
    }

    await new Promise((r) => setTimeout(r, 150))
  }

  return inserted
}

// ── Migration steps ───────────────────────────────────────────────────────────

async function migrateLevels() {
  console.log('\n📦 Step 1: Migrating levels...')
  const levels = await fetchAll('levels')
  if (!levels.length) { console.log('⚠️  No levels found'); return }

  const mapped = levels.map((l, i) => {
    const name: string = l.name ?? ''
    const lower = name.toLowerCase()
    const curriculum_type =
      lower.includes('junior') ? 'cbc_junior'
      : lower.includes('senior') ? 'cbc_senior'
      : lower.includes('form 3') || lower.includes('three') ? 'form3'
      : lower.includes('form 4') || lower.includes('four') ? 'form4'
      : lower.includes('form 1') || lower.includes('one') ? 'form1'
      : lower.includes('form 2') || lower.includes('two') ? 'form2'
      : 'cbc_junior'

    return {
      id: l.id,
      curriculum_type,
      name,
      order_index: l.sequence_order ?? l.order_index ?? i + 1,
    }
  })

  const count = await insertBatched('sow_levels', mapped)
  console.log(`✅ ${count} levels migrated`)
}

async function migrateGrades() {
  console.log('\n📦 Step 2: Migrating grades...')
  const grades = await fetchAll('grades')
  if (!grades.length) { console.log('⚠️  No grades found'); return }

  const mapped = grades.map((g, i) => {
    const name: string = g.name ?? ''
    const numericMatch = name.match(/\d+/)
    return {
      id: g.id,
      level_id: g.level_id,
      name,
      numeric_grade: numericMatch ? parseInt(numericMatch[0], 10) : null,
      order_index: g.sequence_order ?? g.order_index ?? i + 1,
      is_active: g.is_active ?? true,
    }
  })

  const count = await insertBatched('sow_grades', mapped)
  console.log(`✅ ${count} grades migrated`)
}

async function migrateLearningAreas() {
  console.log('\n📦 Step 3: Migrating learning areas...')
  const areas = await fetchAll('learning_areas')
  if (!areas.length) { console.log('⚠️  No learning areas found'); return }

  const mapped = areas.map((a, i) => {
    const name: string = a.name ?? ''
    const short_name = name
      .split(/\s+/)
      .map((w: string) => w[0]?.toUpperCase() ?? '')
      .join('')
      .slice(0, 10) || name.slice(0, 3).toUpperCase()

    return {
      id: a.id,
      grade_id: a.grade_id,
      name,
      short_name,
      order_index: a.sequence_order ?? a.order_index ?? i + 1,
    }
  })

  const count = await insertBatched('sow_learning_areas', mapped)
  console.log(`✅ ${count} learning areas migrated`)
}

async function migrateStrands() {
  console.log('\n📦 Step 4: Migrating unified_strands → sow_strands...')
  const strands = await fetchAll('unified_strands')
  if (!strands.length) { console.log('⚠️  No unified strands found'); return }

  const mapped = strands.map((s, i) => ({
    id: s.id,
    learning_area_id: s.learning_area_id,
    title: s.title,
    order_index: i + 1,
    source_type: s.source_type ?? 'kicd',
  }))

  const count = await insertBatched('sow_strands', mapped)
  console.log(`✅ ${count} strands migrated`)
}

async function migrateSubstrands() {
  console.log('\n📦 Step 5: Migrating unified_substrands → sow_substrands...')
  const substrands = await fetchAll('unified_substrands')
  if (!substrands.length) { console.log('⚠️  No unified substrands found'); return }

  const mapped = substrands.map((s, i) => ({
    id: s.id,
    strand_id: s.strand_id,
    title: s.title,
    suggested_lessons: 4,
    order_index: i + 1,
    content: s.content ?? null,
    source_type: s.source_type ?? 'kicd',
  }))

  const count = await insertBatched('sow_substrands', mapped, 100)
  console.log(`✅ ${count} substrands migrated`)
}

async function migrateLearningOutcomes() {
  console.log('\n📦 Step 6: Migrating learning outcomes...')
  const outcomes = await fetchAll('learning_outcomes')
  if (!outcomes.length) { console.log('⚠️  No learning outcomes found'); return }

  // Old DB: id, sub_strand_id, outcome_code, description
  const mapped = outcomes
    .filter((o) => o.description)
    .map((o, i) => ({
      id: o.id,
      substrand_id: o.sub_strand_id,
      outcome: o.description,
      outcome_type: 'knowledge',
      order_index: i + 1,
    }))

  const count = await insertBatched('sow_learning_outcomes', mapped)
  console.log(`✅ ${count} learning outcomes migrated`)
}

async function migrateSowTemplates() {
  console.log('\n📦 Step 7: Migrating SOW templates...')
  const templates = await fetchAll('sow_templates')
  if (!templates.length) { console.log('⚠️  No SOW templates found'); return }

  // Old DB: id, learning_area_id, strand_id, substrand_order_index,
  //         lesson_outcomes_template, learning_experiences_template,
  //         key_questions_template, resources_template, assessment_methods_template
  const mapped = templates.map((t) => ({
    id: t.id,
    name: `Template for LA ${t.learning_area_id ?? 'unknown'}`,
    description: null,
    curriculum_type: null,
    grade: null,
    subject: null,
    template_data: {
      learning_area_id: t.learning_area_id,
      strand_id: t.strand_id,
      substrand_order_index: t.substrand_order_index,
      lesson_outcomes: t.lesson_outcomes_template ?? [],
      learning_experiences: t.learning_experiences_template ?? [],
      key_questions: t.key_questions_template ?? [],
      resources: t.resources_template ?? [],
      assessment_methods: t.assessment_methods_template ?? [],
    },
  }))

  const count = await insertBatched('sow_templates', mapped)
  console.log(`✅ ${count} SOW templates migrated`)
}

async function migrateSetBooks() {
  console.log('\n📦 Step 8: Migrating set books...')
  const books = await fetchAll('set_books')
  if (!books.length) { console.log('⚠️  No set books found'); return }

  // Old DB: id, learning_area_id, book_title, book_author, grade_level,
  //         education_system, for_form_3, for_form_4, for_grade_10
  const mapped = books.map((b) => ({
    id: b.id,
    learning_area_id: b.learning_area_id,
    book_title: b.book_title,
    book_author: b.book_author ?? null,
    grade: b.grade_level ?? null,
  }))

  const count = await insertBatched('sow_set_books', mapped)
  console.log(`✅ ${count} set books migrated`)
}

// ── Entry point ───────────────────────────────────────────────────────────────

async function main() {
  console.log('🌱 Clean Migration: jashor-app → EduNexus DB')
  console.log('='.repeat(50))

  await migrateLevels()
  await migrateGrades()
  await migrateLearningAreas()
  await migrateStrands()
  await migrateSubstrands()
  await migrateLearningOutcomes()
  await migrateSowTemplates()
  await migrateSetBooks()

  // ── Verification ──────────────────────────────────────────────────────────
  console.log('\n' + '='.repeat(50))
  console.log('🎉 CLEAN MIGRATION COMPLETE!')
  console.log('='.repeat(50))

  console.log('\n📊 VERIFICATION:')
  const tables = [
    'sow_levels',
    'sow_grades',
    'sow_learning_areas',
    'sow_strands',
    'sow_substrands',
    'sow_learning_outcomes',
    'sow_templates',
    'sow_set_books',
  ]

  for (const t of tables) {
    const { count } = await newDb
      .from(t)
      .select('*', { count: 'exact', head: true })
    console.log(`   ${t.padEnd(28)} ${count} rows`)
  }

  console.log('\n✅ EduNexus curriculum DB ready!')
  console.log('   SOW generator can now read real KICD curriculum data 🇰🇪')
}

main().catch((err) => {
  console.error('Fatal error:', err)
  process.exit(1)
})
