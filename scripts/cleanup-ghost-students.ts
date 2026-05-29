// scripts/cleanup-ghost-students.ts
// Finds and deletes duplicate student records created during failed test runs.
// Keeps the oldest record per name+teacher_id, deletes newer duplicates.
// Run: npx tsx scripts/cleanup-ghost-students.ts

import { config } from 'dotenv'
config({ path: '.env.local' })
import { createServiceClient } from '@/utils/supabase/service'

const TEACHER_ID = '45699ad6-f89c-4376-985f-31730a341801'

async function main() {
  const db = createServiceClient()

  const { data, error } = await db
    .from('students')
    .select('id, name, created_at')
    .eq('teacher_id', TEACHER_ID)
    .order('name')
    .order('created_at')

  if (error || !data) { console.error(error); process.exit(1) }

  const byName: Record<string, { id: string; name: string; created_at: string }[]> = {}
  for (const s of data) {
    if (!byName[s.name]) byName[s.name] = []
    byName[s.name].push(s)
  }

  const ghostIds: string[] = []
  for (const [, rows] of Object.entries(byName)) {
    if (rows.length > 1) {
      const toDelete = rows.slice(1) // keep oldest, delete the rest
      console.log(`  ${rows[0].name}: keep ${rows[0].id}, delete ${toDelete.map(r => r.id).join(', ')}`)
      ghostIds.push(...toDelete.map(r => r.id))
    }
  }

  if (ghostIds.length === 0) {
    console.log('No duplicates found.')
    return
  }

  console.log(`\n${ghostIds.length} ghost(s) found. Deleting…`)

  // Clean up related rows first to avoid FK violations
  await db.from('student_invites').delete().in('student_id', ghostIds)
  await db.from('class_students').delete().in('student_id', ghostIds)
  await db.from('student_learning_context').delete().in('student_id', ghostIds)
  await db.from('assessments').delete().in('student_id', ghostIds)

  const { error: delErr } = await db.from('students').delete().in('id', ghostIds)
  if (delErr) { console.error('Delete failed:', delErr.message); process.exit(1) }

  console.log(`Done. Deleted ${ghostIds.length} ghost student(s).`)

  // Final count
  const { count } = await db
    .from('students')
    .select('id', { count: 'exact', head: true })
    .eq('teacher_id', TEACHER_ID)

  console.log(`Students remaining for this teacher: ${count}`)
}

main().catch(e => { console.error(e); process.exit(1) })
