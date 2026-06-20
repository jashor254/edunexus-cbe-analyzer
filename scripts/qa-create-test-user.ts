// scripts/qa-create-test-user.ts — TEMPORARY, for verifying Career Explorer in a browser. Delete after use.
import * as dotenv from 'dotenv'
import * as path from 'path'
dotenv.config({ path: path.resolve(__dirname, '../.env.local') })
import { createClient } from '@supabase/supabase-js'

const db = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL as string,
  process.env.SUPABASE_SERVICE_ROLE_KEY as string,
  { auth: { autoRefreshToken: false, persistSession: false } }
)

async function main() {
  const email = 'qa-verify-explorer@edunexus.test'
  const password = process.env.QA_PASSWORD ?? (() => { throw new Error('Set QA_PASSWORD in .env.local') })()

  const { data: existingList } = await db.auth.admin.listUsers()
  const existing = existingList.users.find(u => u.email === email)
  if (existing) await db.auth.admin.deleteUser(existing.id)

  const { data: created, error } = await db.auth.admin.createUser({
    email, password, email_confirm: true,
  })
  if (error) throw error
  const userId = created.user.id

  await db.from('profiles').upsert({ id: userId, role: 'student', updated_at: new Date().toISOString() }, { onConflict: 'id' })

  const { data: student, error: studentErr } = await db.from('students').insert({
    user_id: userId,
    name: 'QA Verify Student',
    grade: 10,
    curriculum_type: 'cbc',
    current_pathway: 'Social Sciences',
  }).select('id').single()
  if (studentErr) throw studentErr

  console.log(JSON.stringify({ userId, email, password, studentId: student.id }))
}
main().catch(e => { console.error(e); process.exit(1) })
