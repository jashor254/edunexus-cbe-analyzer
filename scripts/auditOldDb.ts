/**
 * auditOldDb.ts
 * Audits the old jashor-app Supabase DB — counts rows and shows sample data.
 * Run: npx tsx scripts/auditOldDb.ts
 */

import { createClient } from '@supabase/supabase-js'

const OLD_SUPABASE_URL = 'https://hvvzpesxsvuvlqytcvsq.supabase.co'
const OLD_SUPABASE_KEY =
  'REDACTED_JASHOR_SERVICE_KEY'

const oldDb = createClient(OLD_SUPABASE_URL, OLD_SUPABASE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
})

const tablesToCheck = [
  'levels',
  'grades',
  'learning_areas',
  'strands',
  'substrands',
  'kicd_curriculum_lessons',
  'schemes',
  'courses',
  'set_books',
  'users',
  'payments',
]

function divider(label: string) {
  console.log('\n' + '═'.repeat(50))
  console.log(label)
  console.log('═'.repeat(50))
}

async function auditTable(table: string) {
  // Count rows
  const { count, error: countErr } = await oldDb
    .from(table)
    .select('*', { count: 'exact', head: true })

  if (countErr) {
    if (
      countErr.message?.includes('does not exist') ||
      countErr.code === '42P01' ||
      countErr.message?.includes('relation') ||
      countErr.code === 'PGRST116'
    ) {
      console.log(`⚠️  Table "${table}" not found — skipping`)
      return
    }
    console.log(`❌ Error counting "${table}": ${countErr.message}`)
    return
  }

  divider(`TABLE: ${table} (${count} rows)`)

  // Fetch 2 sample rows
  const { data: rows, error: rowsErr } = await oldDb
    .from(table)
    .select('*')
    .limit(2)

  if (rowsErr) {
    console.log(`❌ Error fetching rows from "${table}": ${rowsErr.message}`)
    return
  }

  if (!rows || rows.length === 0) {
    console.log('(no rows)')
    return
  }

  const columns = Object.keys(rows[0])
  console.log(`Columns: ${columns.join(', ')}`)

  rows.forEach((row, i) => {
    // Redact any key-like fields before logging
    const safe = { ...row }
    for (const k of Object.keys(safe)) {
      if (['password', 'hashed_password', 'token', 'secret'].includes(k)) {
        safe[k] = '[REDACTED]'
      }
    }
    console.log(`\nSample row ${i + 1}:`, JSON.stringify(safe, null, 2))
  })
}

async function main() {
  console.log('🔍 Auditing old jashor-app Supabase DB...')
  console.log(`   URL: ${OLD_SUPABASE_URL}`)

  for (const table of tablesToCheck) {
    await auditTable(table)
  }

  console.log('\n\n✅ Audit complete.')
}

main().catch((err) => {
  console.error('Fatal error:', err)
  process.exit(1)
})
