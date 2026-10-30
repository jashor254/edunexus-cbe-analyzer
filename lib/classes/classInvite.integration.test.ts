// lib/classes/classInvite.integration.test.ts
//
// Security audit 2026-10-30, F-12, against a real database. A class invite
// link is shared with the whole class; redeeming it must connect a parent
// ONLY to the learners whose teacher-recorded parent email is the parent's
// own confirmed address — never to every unlinked child in the class, which
// is what the pre-fix implementation did (and it also overwrote those
// children's parent_email with the redeemer's).
//
// Run with: npm run test:deep (TEST_SUPABASE_* pointed at a disposable stack)
import { test, before, after } from 'node:test'
import assert from 'node:assert/strict'
import { randomBytes } from 'node:crypto'
import { createTestServiceClient } from '@/utils/supabase/test-service'
import { redeemClassInvite } from '@/lib/classes/redeemClassInvite'
import { ATTEMPT_LIMITS } from '@/lib/config/abuseLimits'
import { deleteAuthUserOrThrow } from '@/lib/testing/deleteAuthUserOrThrow'

const MARKER = 'SYNTHETIC_CLASS_INVITE'
const db = createTestServiceClient()
const tag = randomBytes(3).toString('hex')
const email = (label: string) => `invite-${label}-${tag}-synthetic@example.com`

const userIds: string[] = []
let classId: string
let teacherRowId: string
const learner: Record<'mine' | 'mineUpper' | 'other' | 'wildcard' | 'unconfirmedTarget', string> = {
  mine: '', mineUpper: '', other: '', wildcard: '', unconfirmedTarget: '',
}
let inviteCode: string
let expiredCode: string
let parentId: string, strangerId: string, unconfirmedId: string, wildcardId: string, spammerId: string

async function mkUser(address: string, confirmed: boolean): Promise<string> {
  const { data, error } = await db.auth.admin.createUser({ email: address, password: `Test!${randomBytes(8).toString('hex')}`, email_confirm: confirmed })
  if (error || !data?.user) throw new Error(`mkUser: ${error?.message}`)
  userIds.push(data.user.id)
  return data.user.id
}

async function mkLearner(parentEmail: string): Promise<string> {
  const { data, error } = await db.from('students')
    .insert({ name: `${MARKER} learner`, grade: 8, school: MARKER, added_by: 'teacher', parent_email: parentEmail })
    .select('id').single()
  if (error || !data) throw new Error(`learner: ${error?.message}`)
  const { error: rosterError } = await db.from('class_students').insert({ class_id: classId, student_id: data.id })
  if (rosterError) throw new Error(`roster: ${rosterError.message}`)
  return data.id
}

async function rosterParent(studentId: string): Promise<string | null> {
  const { data, error } = await db.from('class_students').select('parent_id').eq('class_id', classId).eq('student_id', studentId).single()
  if (error) throw new Error(`rosterParent: ${error.message}`)
  return data.parent_id as string | null
}

before(async () => {
  const teacherUser = await mkUser(email('teacher'), true)
  const { data: teacher, error: tErr } = await db.from('teachers').insert({ user_id: teacherUser, full_name: `${MARKER} teacher`, school: MARKER }).select('id').single()
  if (tErr || !teacher) throw new Error(`teacher: ${tErr?.message}`)
  teacherRowId = teacher.id
  const { data: cls, error: cErr } = await db.from('teacher_classes')
    .insert({ teacher_id: teacherRowId, name: `${MARKER} 8B`, grade: 8, subject: 'English', class_code: `SYNINV${randomBytes(4).toString('hex').toUpperCase()}` })
    .select('id').single()
  if (cErr || !cls) throw new Error(`class: ${cErr?.message}`)
  classId = cls.id

  parentId      = await mkUser(email('parent'), true)
  strangerId    = await mkUser(email('stranger'), true)
  unconfirmedId = await mkUser(email('unconfirmed'), false)
  // `_` in the recorded address must not act as a wildcard for `x`.
  wildcardId    = await mkUser(`invite-wildxcard-${tag}-synthetic@example.com`, true)
  spammerId     = await mkUser(email('spammer'), true)

  learner.mine              = await mkLearner(email('parent'))
  learner.mineUpper         = await mkLearner(email('parent').toUpperCase())
  learner.other             = await mkLearner(email('someone-else'))
  learner.wildcard          = await mkLearner(`invite-wild_card-${tag}-synthetic@example.com`)
  learner.unconfirmedTarget = await mkLearner(email('unconfirmed'))

  const { data: invite, error: iErr } = await db.from('class_invites').insert({ class_id: classId, teacher_id: teacherRowId }).select('invite_code').single()
  if (iErr || !invite) throw new Error(`invite: ${iErr?.message}`)
  inviteCode = invite.invite_code
  const { data: expired, error: eErr } = await db.from('class_invites')
    .insert({ class_id: classId, teacher_id: teacherRowId, expires_at: new Date(Date.now() - 1000).toISOString() })
    .select('invite_code').single()
  if (eErr || !expired) throw new Error(`expired invite: ${eErr?.message}`)
  expiredCode = expired.invite_code
})

after(async () => {
  const learnerIds = Object.values(learner).filter(Boolean)
  const steps: Array<[string, () => PromiseLike<{ error: { message: string } | null }>]> = [
    ['rate_limit_attempts', () => db.from('rate_limit_attempts').delete().in('subject', userIds)],
    ['class_invites',       () => db.from('class_invites').delete().eq('class_id', classId)],
    ['class_students',      () => db.from('class_students').delete().eq('class_id', classId)],
    ['teacher_classes',     () => db.from('teacher_classes').delete().eq('id', classId)],
    ['students',            () => db.from('students').delete().in('id', learnerIds)],
    ['teachers',            () => db.from('teachers').delete().eq('id', teacherRowId)],
  ]
  for (const [name, run] of steps) {
    const { error } = await run()
    if (error) throw new Error(`cleanup ${name}: ${error.message}`)
  }
  for (const id of userIds) await deleteAuthUserOrThrow(db, id)
})

test("a stranger redeeming the class link is connected to nobody's child", async () => {
  const result = await redeemClassInvite({ userId: strangerId, inviteCode }, { db })
  assert.equal(result.status, 'no_matching_learner')
  for (const id of Object.values(learner)) assert.equal(await rosterParent(id), null)
})

test('an unconfirmed account cannot claim a learner by typing in that parent\'s email', async () => {
  assert.deepEqual(await redeemClassInvite({ userId: unconfirmedId, inviteCode }, { db }), { status: 'email_unconfirmed' })
  assert.equal(await rosterParent(learner.unconfirmedTarget), null)
})

test('an underscore in a recorded address is matched literally, never as a wildcard', async () => {
  assert.equal((await redeemClassInvite({ userId: wildcardId, inviteCode }, { db })).status, 'no_matching_learner')
  assert.equal(await rosterParent(learner.wildcard), null)
})

test('the parent is connected to exactly their own children (case-insensitive), and no parent_email is rewritten', async () => {
  const result = await redeemClassInvite({ userId: parentId, inviteCode }, { db })
  assert.equal(result.status, 'linked')
  assert.ok(result.status === 'linked')
  assert.equal(result.linked, 2)
  assert.equal(await rosterParent(learner.mine), parentId)
  assert.equal(await rosterParent(learner.mineUpper), parentId)
  for (const id of [learner.other, learner.wildcard, learner.unconfirmedTarget]) assert.equal(await rosterParent(id), null)

  const { data, error } = await db.from('students').select('id, parent_email').in('id', [learner.other, learner.wildcard])
  if (error) throw new Error(error.message)
  for (const row of data) assert.ok(!String(row.parent_email).includes('-parent-'), 'parent_email was overwritten')
})

test('redeeming again links nothing new', async () => {
  assert.equal((await redeemClassInvite({ userId: parentId, inviteCode }, { db })).status, 'no_matching_learner')
})

test('an expired invite is refused', async () => {
  assert.deepEqual(await redeemClassInvite({ userId: parentId, inviteCode: expiredCode }, { db }), { status: 'expired' })
})

test(`redemptions are capped at ${ATTEMPT_LIMITS.classInviteJoin.limit} per account per window`, async () => {
  for (let i = 0; i < ATTEMPT_LIMITS.classInviteJoin.limit; i++) {
    assert.notEqual((await redeemClassInvite({ userId: spammerId, inviteCode }, { db })).status, 'rate_limited')
  }
  assert.deepEqual(await redeemClassInvite({ userId: spammerId, inviteCode }, { db }), { status: 'rate_limited' })
})
