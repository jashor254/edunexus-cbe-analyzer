// lib/core/context.test.ts
// Run with: npx tsx --env-file=.env.local --test lib/core/context.test.ts
import { test, before, after } from 'node:test'
import assert from 'node:assert/strict'
import { createClient, type SupabaseClient } from '@supabase/supabase-js'
import { createServiceClient } from '@/utils/supabase/service'
import { repos } from '@/lib/repositories'
import { buildSchoolContext, buildPlatformContext } from '@/lib/core/context'
import { MembershipRequiredError } from '@/lib/core/errors'

const SYNTHETIC_MARKER = 'SYNTHETIC_CONTEXT_TEST'
const db = createServiceClient()
const PASSWORD = `Test!${Math.random().toString(36).slice(2, 12)}`

async function signInAs(email: string): Promise<SupabaseClient> {
  const client = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!)
  const { error } = await client.auth.signInWithPassword({ email, password: PASSWORD })
  if (error) throw error
  return client
}

let schoolId: string
let adminUserId: string
let adminEmail: string
let outsiderUserId: string
let outsiderEmail: string
let teacherUserId: string
let teacherEmail: string
let teacherId: string

before(async () => {
  const mkUser = async (label: string) => {
    const email = `context-test-${label}-${Date.now()}@example.com`
    const { data } = await db.auth.admin.createUser({ email, password: PASSWORD, email_confirm: true })
    return { id: data!.user.id, email }
  }

  const admin = await mkUser('admin')
  adminUserId = admin.id; adminEmail = admin.email

  const outsider = await mkUser('outsider')
  outsiderUserId = outsider.id; outsiderEmail = outsider.email

  const teacher = await mkUser('teacher')
  teacherUserId = teacher.id; teacherEmail = teacher.email

  const school = await repos.schools.create({ school_name: `${SYNTHETIC_MARKER}-school` }, adminUserId)
  schoolId = school.id
  await db.from('school_users').insert({ school_id: schoolId, user_id: adminUserId, role: 'school_admin', is_active: true })

  const { data: teacherRow } = await db
    .from('teachers')
    .insert({ user_id: teacherUserId, full_name: SYNTHETIC_MARKER, school: SYNTHETIC_MARKER })
    .select('id')
    .single()
  teacherId = teacherRow!.id
})

after(async () => {
  await db.from('teachers').delete().eq('id', teacherId)
  await db.from('school_users').delete().eq('school_id', schoolId)
  await db.from('schools').delete().eq('id', schoolId)
  for (const id of [adminUserId, outsiderUserId, teacherUserId]) {
    await db.auth.admin.deleteUser(id)
  }
})

test('buildSchoolContext returns a fully-populated context with correct permissions for an admin', async () => {
  const client = await signInAs(adminEmail)
  const ctx = await buildSchoolContext(client, schoolId)

  assert.equal(ctx.user.id, adminUserId)
  assert.equal(ctx.school.id, schoolId)
  assert.equal(ctx.membership.role, 'school_admin')
  assert.equal(ctx.permissions.isSchoolAdmin, true)
  assert.equal(ctx.permissions.isTeacher, false)
})

test('buildSchoolContext throws MembershipRequiredError for a non-member', async () => {
  const client = await signInAs(outsiderEmail)
  await assert.rejects(() => buildSchoolContext(client, schoolId), MembershipRequiredError)
})

test('buildPlatformContext resolves the teacher identity for a teacher-portal user', async () => {
  const client = await signInAs(teacherEmail)
  const ctx = await buildPlatformContext(client)

  assert.equal(ctx.user.id, teacherUserId)
  assert.ok(ctx.teacher)
  assert.equal(ctx.teacher!.id, teacherId)
  assert.equal(ctx.student, null)
})
