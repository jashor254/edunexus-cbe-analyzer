/**
 * migrateOldDb.ts
 * Extracts curriculum data from old jashor-app Supabase DB
 * and merges it into the EduNexus DB.
 * Run: npx tsx scripts/migrateOldDb.ts
 */

import { createClient, SupabaseClient } from '@supabase/supabase-js'
import * as dotenv from 'dotenv'
import * as path from 'path'

// Load .env.local
dotenv.config({ path: path.resolve(process.cwd(), '.env.local') })

// ── Clients ──────────────────────────────────────────────────────────────────

const OLD_SUPABASE_URL = 'https://hvvzpesxsvuvlqytcvsq.supabase.co'
const OLD_SUPABASE_KEY =
  'REDACTED_JASHOR_SERVICE_KEY'

const NEW_SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!
const NEW_SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!

if (!NEW_SUPABASE_URL || !NEW_SUPABASE_KEY) {
  console.error(
    '❌ Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in .env.local'
  )
  process.exit(1)
}

const oldDb = createClient(OLD_SUPABASE_URL, OLD_SUPABASE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
})

const newDb = createClient(NEW_SUPABASE_URL, NEW_SUPABASE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
})

// ── Helpers ───────────────────────────────────────────────────────────────────

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms))

async function fetchAll<T>(db: SupabaseClient, table: string): Promise<T[]> {
  const PAGE = 1000
  const results: T[] = []
  let from = 0

  while (true) {
    const { data, error } = await db
      .from(table)
      .select('*')
      .range(from, from + PAGE - 1)

    if (error) {
      if (
        error.message?.includes('does not exist') ||
        error.code === '42P01' ||
        error.message?.includes('relation') ||
        error.code === 'PGRST116'
      ) {
        console.log(`⚠️  Table "${table}" not found in old DB — skipping`)
        return []
      }
      throw new Error(`Error fetching "${table}": ${error.message}`)
    }

    if (!data || data.length === 0) break
    results.push(...(data as T[]))
    if (data.length < PAGE) break
    from += PAGE
  }

  return results
}

async function upsertBatched<T extends Record<string, unknown>>(
  db: SupabaseClient,
  table: string,
  rows: T[],
  batchSize = 100
): Promise<number> {
  if (rows.length === 0) return 0
  let inserted = 0

  for (let i = 0; i < rows.length; i += batchSize) {
    const batch = rows.slice(i, i + batchSize)
    const { error } = await db.from(table).upsert(batch, { onConflict: 'id' })

    if (error) {
      throw new Error(`Upsert error on "${table}" batch ${i}: ${error.message}`)
    }

    inserted += batch.length
    if (i + batchSize < rows.length) await sleep(200)
  }

  return inserted
}

// Derive curriculum_type from level name
function toCurriculumType(name: string): string {
  const lower = name.toLowerCase()
  if (lower.includes('junior')) return 'cbc_junior'
  if (lower.includes('senior')) return 'cbc_senior'
  if (lower.includes('form 3') || lower === 'form3') return 'form3'
  if (lower.includes('form 4') || lower === 'form4') return 'form4'
  if (lower.includes('form 1') || lower === 'form1') return 'form1'
  if (lower.includes('form 2') || lower === 'form2') return 'form2'
  // Fallback: slugify
  return lower.replace(/\s+/g, '_')
}

// Generate short_name from full name (first letter of each word, uppercase)
function toShortName(name: string): string {
  return name
    .split(/\s+/)
    .map((w) => w[0]?.toUpperCase() ?? '')
    .join('')
    .slice(0, 10)
}

// ── Migration steps ───────────────────────────────────────────────────────────

async function migrateLevels() {
  console.log('\n📦 Migrating levels → sow_levels...')
  const rows = await fetchAll<Record<string, unknown>>(oldDb, 'levels')
  if (!rows.length) { console.log('⚠️  No levels found'); return }

  const mapped = rows.map((r) => ({
    id: r.id,
    name: r.name,
    curriculum_type: toCurriculumType(String(r.name ?? '')),
    order_index: r.order_index ?? 0,
  }))

  const count = await upsertBatched(newDb, 'sow_levels', mapped)
  console.log(`✅ Migrated ${count} levels`)
}

async function migrateGrades() {
  console.log('\n📦 Migrating grades → sow_grades...')
  const rows = await fetchAll<Record<string, unknown>>(oldDb, 'grades')
  if (!rows.length) { console.log('⚠️  No grades found'); return }

  const mapped = rows.map((r) => {
    // Extract numeric grade from name if possible (e.g. "Grade 7" → 7)
    const match = String(r.name ?? '').match(/\d+/)
    return {
      id: r.id,
      level_id: r.level_id,
      name: r.name,
      numeric_grade: match ? parseInt(match[0], 10) : null,
      order_index: r.order_index ?? 0,
    }
  })

  const count = await upsertBatched(newDb, 'sow_grades', mapped)
  console.log(`✅ Migrated ${count} grades`)
}

async function migrateLearningAreas() {
  console.log('\n📦 Migrating learning_areas → sow_learning_areas...')
  const rows = await fetchAll<Record<string, unknown>>(oldDb, 'learning_areas')
  if (!rows.length) { console.log('⚠️  No learning_areas found'); return }

  const mapped = rows.map((r) => ({
    id: r.id,
    grade_id: r.grade_id,
    name: r.name,
    short_name: toShortName(String(r.name ?? '')),
    order_index: r.order_index ?? 0,
  }))

  const count = await upsertBatched(newDb, 'sow_learning_areas', mapped)
  console.log(`✅ Migrated ${count} learning areas`)
}

async function migrateStrands() {
  console.log('\n📦 Migrating strands → sow_strands...')
  const rows = await fetchAll<Record<string, unknown>>(oldDb, 'strands')
  if (!rows.length) { console.log('⚠️  No strands found'); return }

  const mapped = rows.map((r) => ({
    id: r.id,
    learning_area_id: r.learning_area_id,
    title: r.title ?? r.name,
    order_index: r.order_index ?? 0,
  }))

  const count = await upsertBatched(newDb, 'sow_strands', mapped)
  console.log(`✅ Migrated ${count} strands`)
}

async function migrateSubstrands() {
  console.log('\n📦 Migrating substrands → sow_substrands...')
  const rows = await fetchAll<Record<string, unknown>>(oldDb, 'substrands')
  if (!rows.length) { console.log('⚠️  No substrands found'); return }

  const mapped = rows.map((r) => ({
    id: r.id,
    strand_id: r.strand_id,
    title: r.title ?? r.name,
    suggested_lessons: r.lessons_required ?? r.suggested_lessons ?? null,
    order_index: r.order_index ?? 0,
  }))

  const count = await upsertBatched(newDb, 'sow_substrands', mapped)
  console.log(`✅ Migrated ${count} substrands`)
}

async function migrateKicdLessons() {
  console.log('\n📦 Migrating kicd_curriculum_lessons...')
  const rows = await fetchAll<Record<string, unknown>>(oldDb, 'kicd_curriculum_lessons')
  if (!rows.length) { console.log('⚠️  No kicd_curriculum_lessons found'); return }

  // Insert as-is — same table name assumed in new DB
  const count = await upsertBatched(newDb, 'kicd_curriculum_lessons', rows)
  console.log(`✅ Migrated ${count} KICD lessons`)
}

async function migrateSetBooks() {
  console.log('\n📦 Migrating set_books...')
  const rows = await fetchAll<Record<string, unknown>>(oldDb, 'set_books')
  if (!rows.length) { console.log('⚠️  No set_books found'); return }

  const count = await upsertBatched(newDb, 'set_books', rows)
  console.log(`✅ Migrated ${count} set books`)
}

// ── Verification ──────────────────────────────────────────────────────────────

async function verifyCount(oldTable: string, newTable: string) {
  const [{ count: oldCount }, { count: newCount }] = await Promise.all([
    oldDb.from(oldTable).select('*', { count: 'exact', head: true }),
    newDb.from(newTable).select('*', { count: 'exact', head: true }),
  ])

  const match = oldCount === newCount
  console.log(
    `  ${match ? '✅' : '❌'} ${oldTable}: ${oldCount ?? '?'} old  →  ${newTable}: ${newCount ?? '?'} new${match ? '' : '  ← MISMATCH'}`
  )
}

// ── Entry point ───────────────────────────────────────────────────────────────

async function main() {
  console.log('🚀 Starting migration: old jashor-app → EduNexus DB')
  console.log(`   Old DB: ${OLD_SUPABASE_URL}`)
  console.log(`   New DB: ${NEW_SUPABASE_URL}`)

  await migrateLevels()
  await migrateGrades()
  await migrateLearningAreas()
  await migrateStrands()
  await migrateSubstrands()
  await migrateKicdLessons()
  await migrateSetBooks()

  console.log('\n\n🔍 Verifying row counts...')
  await verifyCount('levels', 'sow_levels')
  await verifyCount('grades', 'sow_grades')
  await verifyCount('learning_areas', 'sow_learning_areas')
  await verifyCount('strands', 'sow_strands')
  await verifyCount('substrands', 'sow_substrands')
  await verifyCount('kicd_curriculum_lessons', 'kicd_curriculum_lessons')

  console.log('\n✅ Migration complete.')
}

main().catch((err) => {
  console.error('Fatal error:', err)
  process.exit(1)
})
