// lib/repositories/classCalendar.repository.integration.test.ts
//
// LMS Basics Phase 2 (ADR-0021) — validates ClassCalendarRepository against
// real, synthetic (throwaway) data. Mirrors
// lib/repositories/classResource.repository.integration.test.ts exactly.
//
// Run: npx tsx --env-file=.env.local --test lib/repositories/classCalendar.repository.integration.test.ts
import { test, before, after } from 'node:test'
import assert from 'node:assert/strict'
import { createTestServiceClient as createServiceClient } from '@/utils/supabase/test-service'
import { repos } from '@/lib/repositories'
import { deleteAuthUserOrThrow } from '@/lib/testing/deleteAuthUserOrThrow'

const SYNTHETIC_MARKER = 'SYNTHETIC_LMS_CALENDAR_TEST'
const db = createServiceClient()

let authUserId: string
let teacherId: string
let classId: string
let otherTeacherId: string

before(async () => {
  const { data: auth, error: authErr } = await db.auth.admin.createUser({
    email: `lms-calendar-${Date.now()}@example.com`,
    password: `Test!${Math.random().toString(36).slice(2, 10)}`,
    email_confirm: true,
  })
  if (authErr) throw authErr
  authUserId = auth.user.id

  const { data: teacher, error: teacherErr } = await db
    .from('teachers').insert({ user_id: authUserId, full_name: SYNTHETIC_MARKER, school: SYNTHETIC_MARKER })
    .select('id').single()
  if (teacherErr) throw teacherErr
  teacherId = teacher.id

  const { data: otherAuth } = await db.auth.admin.createUser({
    email: `lms-calendar-other-${Date.now()}@example.com`,
    password: `Test!${Math.random().toString(36).slice(2, 10)}`,
    email_confirm: true,
  })
  const { data: otherTeacher, error: otherTeacherErr } = await db
    .from('teachers').insert({ user_id: otherAuth!.user.id, full_name: SYNTHETIC_MARKER, school: SYNTHETIC_MARKER })
    .select('id').single()
  if (otherTeacherErr) throw otherTeacherErr
  otherTeacherId = otherTeacher.id

  const { data: cls, error: clsErr } = await db
    .from('teacher_classes')
    .insert({
      teacher_id: teacherId, name: SYNTHETIC_MARKER, grade: 8, subject: 'Mathematics',
      class_code: `${SYNTHETIC_MARKER}_${Date.now()}`,
    })
    .select('id').single()
  if (clsErr) throw clsErr
  classId = cls.id
})

after(async () => {
  if (classId) await db.from('teacher_classes').delete().eq('id', classId)
  if (teacherId) await db.from('teachers').delete().eq('id', teacherId)
  if (otherTeacherId) await db.from('teachers').delete().eq('id', otherTeacherId)
  if (authUserId) await deleteAuthUserOrThrow(db, authUserId)
})

test('createEvent + findEventsByClass: a created event is returned for its class', async () => {
  const event = await repos.classCalendar.createEvent({
    classId, teacherId, title: 'CAT 1', eventDate: '2026-08-10', description: 'Bring calculator',
  })
  assert.equal(event.title, 'CAT 1')
  assert.equal(event.description, 'Bring calculator')

  const found = await repos.classCalendar.findEventsByClass(classId)
  assert.ok(found.some(e => e.id === event.id))
})

test('createEvent: description is optional and defaults to null', async () => {
  const event = await repos.classCalendar.createEvent({ classId, teacherId, title: 'Trip', eventDate: '2026-09-01' })
  assert.equal(event.description, null)
})

test('findEventsByClassIds: aggregates across multiple classes', async () => {
  const { data: cls2 } = await db
    .from('teacher_classes')
    .insert({ teacher_id: teacherId, name: `${SYNTHETIC_MARKER}_2`, grade: 8, subject: 'Mathematics', class_code: `${SYNTHETIC_MARKER}_2_${Date.now()}` })
    .select('id').single()
  await repos.classCalendar.createEvent({ classId: cls2!.id, teacherId, title: 'Second class event', eventDate: '2026-08-15' })

  const found = await repos.classCalendar.findEventsByClassIds([classId, cls2!.id])
  assert.ok(found.some(e => e.title === 'Second class event'))

  await db.from('teacher_classes').delete().eq('id', cls2!.id)
})

test('deleteEvent: scoped by teacherId — a non-owning teacher cannot delete it', async () => {
  const event = await repos.classCalendar.createEvent({ classId, teacherId, title: 'To delete', eventDate: '2026-08-20' })

  await repos.classCalendar.deleteEvent(event.id, otherTeacherId)
  const stillThere = await repos.classCalendar.findEventsByClass(classId)
  assert.ok(stillThere.some(e => e.id === event.id))

  await repos.classCalendar.deleteEvent(event.id, teacherId)
  const gone = await repos.classCalendar.findEventsByClass(classId)
  assert.ok(!gone.some(e => e.id === event.id))
})

test('createAnnouncement + findAnnouncementsByClass: a posted announcement is returned for its class', async () => {
  const announcement = await repos.classCalendar.createAnnouncement({
    classId, teacherId, title: 'No school tomorrow', body: 'PTA day, no lessons.',
  })
  const found = await repos.classCalendar.findAnnouncementsByClass(classId)
  assert.ok(found.some(a => a.id === announcement.id))
})

test('deleteAnnouncement: scoped by teacherId, matching deleteEvent\'s ownership discipline', async () => {
  const announcement = await repos.classCalendar.createAnnouncement({ classId, teacherId, title: 'To delete', body: 'body' })

  await repos.classCalendar.deleteAnnouncement(announcement.id, otherTeacherId)
  const stillThereList = await repos.classCalendar.findAnnouncementsByClass(classId)
  assert.ok(stillThereList.some(a => a.id === announcement.id))

  await repos.classCalendar.deleteAnnouncement(announcement.id, teacherId)
  const goneList = await repos.classCalendar.findAnnouncementsByClass(classId)
  assert.ok(!goneList.some(a => a.id === announcement.id))
})
