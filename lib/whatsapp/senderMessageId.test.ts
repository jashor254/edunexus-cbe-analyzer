// lib/whatsapp/senderMessageId.test.ts
//
// D-02 regression: proves every template-based send pathway persists
// Meta's returned whatsapp_message_id in notification_log, and that
// failed sends never fabricate one.
//
// Run: npm test -- lib/whatsapp/senderMessageId.test.ts

import { test, before, mock } from 'node:test'
import assert from 'node:assert/strict'

type LogInsert = {
  whatsapp_message_id?: string | null
  success: boolean
  type: string
  [key: string]: unknown
}

let capturedLogs: LogInsert[] = []
let templateResult = { success: true, messageId: 'wamid.TEMPLATE_123' }

mock.module('./client', {
  namedExports: {
    sendWhatsAppTemplate: async () => templateResult,
  },
})

mock.module('@/lib/repositories', {
  namedExports: {
    repos: {
      notifications: {
        isDuplicate: async () => false,
        insertNotificationLog: async (params: LogInsert) => {
          capturedLogs.push(params)
        },
      },
    },
  },
})

let sendAssignmentMarkedWhatsApp: typeof import('./sender').sendAssignmentMarkedWhatsApp
let sendAlertCreatedWhatsApp: typeof import('./sender').sendAlertCreatedWhatsApp
let sendAcademyReflectionNudge: typeof import('./sender').sendAcademyReflectionNudge

before(async () => {
  process.env.WHATSAPP_PHONE_NUMBER_ID = 'fixture-phone-id'
  process.env.WHATSAPP_ACCESS_TOKEN = 'fixture-access-token'
  const mod = await import('./sender')
  sendAssignmentMarkedWhatsApp = mod.sendAssignmentMarkedWhatsApp
  sendAlertCreatedWhatsApp = mod.sendAlertCreatedWhatsApp
  sendAcademyReflectionNudge = mod.sendAcademyReflectionNudge
})

const assignmentParams = {
  submissionId: 'sub-1', parentPhone: '254712345678', parentName: 'Jane',
  studentName: 'Ali', subject: 'Mathematics', score: 8, maxScore: 10,
  cbcLevel: 3 as const, teacherFeedback: 'Good', teacherName: 'Mr Otieno',
  assignmentId: 'a-1', userId: 'u-1',
}

const alertParams = {
  alertId: 'alert-1', parentPhone: '254712345678', parentName: 'Jane',
  studentName: 'Ali', alertType: 'declining_scores', message: 'Needs support',
  teacherName: 'Mr Otieno', userId: 'u-1',
}

const academyParams = {
  teacherId: 't-1', lessonId: 'l-1', phone: '254712345678',
  teacherName: 'Mr Otieno', moduleTitle: 'Assessment Design',
  moduleSlug: 'assessment-design', userId: 'u-1',
}

test('D-02: sendAssignmentMarkedWhatsApp persists Meta message ID on success', async () => {
  capturedLogs = []
  templateResult = { success: true, messageId: 'wamid.ASSIGN_OK' }

  const result = await sendAssignmentMarkedWhatsApp(assignmentParams)

  assert.equal(result.success, true)
  assert.equal(capturedLogs.length, 1)
  assert.equal(capturedLogs[0].whatsapp_message_id, 'wamid.ASSIGN_OK')
  assert.equal(capturedLogs[0].success, true)
  assert.equal(capturedLogs[0].type, 'assignment_marked')
})

test('D-02: sendAlertCreatedWhatsApp persists Meta message ID on success', async () => {
  capturedLogs = []
  templateResult = { success: true, messageId: 'wamid.ALERT_OK' }

  const result = await sendAlertCreatedWhatsApp(alertParams)

  assert.equal(result.success, true)
  assert.equal(capturedLogs.length, 1)
  assert.equal(capturedLogs[0].whatsapp_message_id, 'wamid.ALERT_OK')
  assert.equal(capturedLogs[0].type, 'alert_created')
})

test('D-02: sendAcademyReflectionNudge persists Meta message ID on success', async () => {
  capturedLogs = []
  templateResult = { success: true, messageId: 'wamid.ACADEMY_OK' }

  const result = await sendAcademyReflectionNudge(academyParams)

  assert.equal(result.success, true)
  assert.equal(capturedLogs.length, 1)
  assert.equal(capturedLogs[0].whatsapp_message_id, 'wamid.ACADEMY_OK')
  assert.equal(capturedLogs[0].type, 'academy_reflection_nudge')
})

test('D-02: a failed send does not fabricate a message ID', async () => {
  capturedLogs = []
  templateResult = { success: false, messageId: undefined as unknown as string }

  const result = await sendAssignmentMarkedWhatsApp(assignmentParams)

  assert.equal(result.success, false)
  assert.equal(capturedLogs.length, 1)
  assert.equal(capturedLogs[0].whatsapp_message_id, null)
  assert.equal(capturedLogs[0].success, false)
})

test('D-02: a success with no messageId in response stores null, not undefined', async () => {
  capturedLogs = []
  templateResult = { success: true, messageId: undefined as unknown as string }

  await sendAssignmentMarkedWhatsApp(assignmentParams)

  assert.equal(capturedLogs.length, 1)
  assert.equal(capturedLogs[0].whatsapp_message_id, null)
})
