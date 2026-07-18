// lib/repositories/classResource.repository.integration.test.ts
//
// LMS Basics Phase 1 (ADR-0020) — validates ClassResourceRepository against
// real, synthetic (throwaway) data: a real teacher, a real teacher_classes
// row, real class_resources/course_materials rows. Mirrors the pattern in
// lib/repositories/findSchoolIdByTeacherId.integration.test.ts — real
// Supabase writes, SYNTHETIC_MARKER-tagged, deleted in after() including on
// failure.
//
// Run: npx tsx --env-file=.env.local --test lib/repositories/classResource.repository.integration.test.ts
import { test, before, after } from 'node:test'
import assert from 'node:assert/strict'
import { createServiceClient } from '@/utils/supabase/service'
import { repos } from '@/lib/repositories'

const SYNTHETIC_MARKER = 'SYNTHETIC_LMS_RESOURCES_TEST'
const db = createServiceClient()

let authUserId: string
let teacherId: string
let classId: string
let otherTeacherId: string

before(async () => {
  const { data: auth, error: authErr } = await db.auth.admin.createUser({
    email: `lms-resources-${Date.now()}@example.com`,
    password: `Test!${Math.random().toString(36).slice(2, 10)}`,
    email_confirm: true,
  })
  if (authErr) throw authErr
  authUserId = auth.user.id

  const { data: teacher, error: teacherErr } = await db
    .from('teachers')
    .insert({ user_id: authUserId, full_name: SYNTHETIC_MARKER, school: SYNTHETIC_MARKER })
    .select('id')
    .single()
  if (teacherErr) throw teacherErr
  teacherId = teacher.id

  const { data: otherAuth } = await db.auth.admin.createUser({
    email: `lms-resources-other-${Date.now()}@example.com`,
    password: `Test!${Math.random().toString(36).slice(2, 10)}`,
    email_confirm: true,
  })
  const { data: otherTeacher, error: otherTeacherErr } = await db
    .from('teachers')
    .insert({ user_id: otherAuth!.user.id, full_name: SYNTHETIC_MARKER, school: SYNTHETIC_MARKER })
    .select('id')
    .single()
  if (otherTeacherErr) throw otherTeacherErr
  otherTeacherId = otherTeacher.id

  const { data: cls, error: clsErr } = await db
    .from('teacher_classes')
    .insert({
      teacher_id: teacherId, name: SYNTHETIC_MARKER, grade: 8, subject: 'Mathematics',
      class_code: `${SYNTHETIC_MARKER}_${Date.now()}`,
    })
    .select('id')
    .single()
  if (clsErr) throw clsErr
  classId = cls.id
})

after(async () => {
  if (classId) await db.from('teacher_classes').delete().eq('id', classId)
  if (teacherId) await db.from('teachers').delete().eq('id', teacherId)
  if (otherTeacherId) await db.from('teachers').delete().eq('id', otherTeacherId)
  if (authUserId) await db.auth.admin.deleteUser(authUserId)
})

test('createResource + findResourcesByClass: a created resource is returned for its class', async () => {
  const resource = await repos.classResources.createResource({
    classId, teacherId, title: 'Week 3 worksheet',
    filePath: `${classId}/test.pdf`, fileName: 'test.pdf', fileType: 'application/pdf',
  })
  assert.equal(resource.title, 'Week 3 worksheet')
  assert.equal(resource.class_id, classId)

  const found = await repos.classResources.findResourcesByClass(classId)
  assert.ok(found.some(r => r.id === resource.id))
})

test('findResourcesByClass: a different class sees no resources', async () => {
  const found = await repos.classResources.findResourcesByClass('00000000-0000-0000-0000-000000000000')
  assert.deepEqual(found, [])
})

test('deleteResource: only deletes when teacherId matches the row (ownership enforced at the repo layer)', async () => {
  const resource = await repos.classResources.createResource({
    classId, teacherId, title: 'To be deleted',
    filePath: `${classId}/delete-me.pdf`, fileName: 'delete-me.pdf', fileType: 'application/pdf',
  })

  // Wrong teacher — row survives (repo scopes the delete by teacherId).
  await repos.classResources.deleteResource(resource.id, otherTeacherId)
  const stillThere = await repos.classResources.findResourceById(resource.id)
  assert.ok(stillThere, 'resource should not be deleted by a non-owning teacherId')

  // Correct teacher — row is gone.
  await repos.classResources.deleteResource(resource.id, teacherId)
  const gone = await repos.classResources.findResourceById(resource.id)
  assert.equal(gone, null)
})

test('createMaterial + findMaterialsByClass: a created note is returned for its class', async () => {
  const material = await repos.classResources.createMaterial({
    classId, teacherId, title: 'Photosynthesis notes', body: 'Plants convert light to energy...',
  })
  assert.equal(material.title, 'Photosynthesis notes')
  assert.equal(material.link_url, null)

  const found = await repos.classResources.findMaterialsByClass(classId)
  assert.ok(found.some(m => m.id === material.id))
})

test('createMaterial: an optional linkUrl round-trips correctly', async () => {
  const material = await repos.classResources.createMaterial({
    classId, teacherId, title: 'External reading', body: 'See the link below.',
    linkUrl: 'https://example.com/reading',
  })
  assert.equal(material.link_url, 'https://example.com/reading')
})

test('deleteMaterial: scoped by teacherId, matching deleteResource\'s ownership discipline', async () => {
  const material = await repos.classResources.createMaterial({
    classId, teacherId, title: 'To be deleted', body: 'body',
  })

  await repos.classResources.deleteMaterial(material.id, otherTeacherId)
  const stillThereList = await repos.classResources.findMaterialsByClass(classId)
  assert.ok(stillThereList.some(m => m.id === material.id))

  await repos.classResources.deleteMaterial(material.id, teacherId)
  const goneList = await repos.classResources.findMaterialsByClass(classId)
  assert.ok(!goneList.some(m => m.id === material.id))
})
