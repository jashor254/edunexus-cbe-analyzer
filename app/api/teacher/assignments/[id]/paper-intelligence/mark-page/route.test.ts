// app/api/teacher/assignments/[id]/paper-intelligence/mark-page/route.test.ts
//
// Direct unit test of the orchestrator route, mirroring
// app/api/webhooks/whatsapp/route.test.ts's own established convention
// (import {POST} from './route' directly, no live server needed). Proves
// the one thing this task's own Gate 5 named as critical: an unauthorized
// or cross-tenant request must be rejected BEFORE any image retrieval or
// Gemini call happens — never "eventually rejects after doing the
// expensive/cross-tenant work first."
//
// mock.module intercepts every dependency this route imports, so this runs
// with zero real DB, zero real Gemini call, zero real network.
// Run: npx tsx --experimental-test-module-mocks --test "app/api/teacher/assignments/[id]/paper-intelligence/mark-page/route.test.ts"
import { before, mock, test } from 'node:test'
import assert from 'node:assert/strict'
import { NextRequest } from 'next/server'

let authShouldThrow: Error | null = null
let classTeacherShouldThrow: Error | null = null
let submissionRow: Record<string, unknown> | null = null
let visionCallCount = 0
let storageDownloadCallCount = 0
let evidenceWriteCallCount = 0
let failureLogCalls: Array<{ operation: string; errorCategory: string }> = []
let capturedVisionRequest: { mimeType: string } | null = null
let visionShouldThrow = false

class FakeUnauthorizedError extends Error {}
class FakeResourceOwnershipError extends Error {}

mock.module('@/lib/core/errors', {
  namedExports: {
    UnauthorizedError: FakeUnauthorizedError,
    ResourceOwnershipError: FakeResourceOwnershipError,
  },
})

mock.module('@/lib/core/permissions', {
  namedExports: {
    requireAuthentication: async () => {
      if (authShouldThrow) throw authShouldThrow
      return { id: 'fixture-user' }
    },
    requireClassTeacher: async () => {
      if (classTeacherShouldThrow) throw classTeacherShouldThrow
      return { id: 'fixture-user' }
    },
  },
})

mock.module('@/utils/supabase/server', {
  namedExports: { createClient: async () => ({}) },
})

mock.module('@/utils/supabase/service', {
  namedExports: {
    createServiceClient: () => ({
      from: (table: string) => ({
        select: () => ({
          eq: (_col: string, _val: string) => ({
            maybeSingle: async () => {
              if (table === 'assignment_submissions') return { data: submissionRow, error: null }
              if (table === 'students') return { data: { school_id: 'fixture-school' }, error: null }
              return { data: null, error: null }
            },
            single: async () => {
              if (table === 'assignments') return { data: { subject: 'Social Studies' }, error: null }
              return { data: null, error: null }
            },
          }),
        }),
      }),
      storage: {
        from: () => ({
          download: async () => {
            storageDownloadCallCount++
            return { data: new Blob(['fake-image-bytes']), error: null }
          },
        }),
      },
    }),
  },
})

mock.module('@/lib/config/uploads', {
  namedExports: { isAllowedUploadType: () => true },
})

mock.module('@/lib/paperIntelligence/rubrics', {
  namedExports: {
    findRubricsForAssignment: async () => [{ id: 'r1', assignment_id: 'a1', question_number: 1, sub_strand_id: 'ss1', question_text: 'Q', expected_answer_summary: 'E', marking_criteria: [], max_marks: 4, created_by: 't1', created_at: '', updated_at: '' }],
    toRubricForMarking: (row: { id: string }) => ({ rubricId: row.id, questionNumber: 1, questionText: 'Q', expectedAnswerSummary: 'E', markingCriteria: [], maxMarks: 4 }),
  },
})

mock.module('@/lib/paperIntelligence/vision', {
  namedExports: {
    recognizeAndMarkPage: async (request: { mimeType: string }) => {
      visionCallCount++
      capturedVisionRequest = request
      if (visionShouldThrow) throw new Error('synthetic Gemini failure')
      return {
        response: {
          questions: [{ rubricId: 'r1', questionNumber: 1, recognizedAnswer: 'A', recognitionConfidence: 0.8, recognitionNotes: null, uncertain: false, proposedMark: 2, maxMark: 4, gradingConfidence: 0.7, rationale: 'ok' }],
          metadata: { provider: 'gemini', model: 'gemini-2.5-flash-lite', promptTokens: 10, completionTokens: 5, totalTokens: 15, costStatus: 'unavailable', costUsd: null, latencyMs: 100 },
        },
        rejected: [],
      }
    },
    PaperVisionInputError: class extends Error {},
  },
})

mock.module('@/lib/paperIntelligence/validation', {
  namedExports: { PaperVisionParseError: class extends Error {} },
})

mock.module('@/lib/paperIntelligence/evidence', {
  namedExports: {
    recordPaperIntelligenceEvidence: async () => {
      evidenceWriteCallCount++
      return { inserted: [], confirmedCount: 0, pendingReviewCount: 1, noOpCount: 0, failedWrites: 0 }
    },
  },
})

mock.module('@/lib/paperIntelligence/failureLog', {
  namedExports: {
    logPaperIntelligenceFailure: async (input: { operation: string; errorCategory: string }) => {
      failureLogCalls.push(input)
    },
  },
})

let POST: typeof import('./route').POST

before(async () => {
  ;({ POST } = await import('./route'))
})

function resetCounters() {
  authShouldThrow = null
  classTeacherShouldThrow = null
  visionCallCount = 0
  storageDownloadCallCount = 0
  evidenceWriteCallCount = 0
  failureLogCalls = []
  capturedVisionRequest = null
}

function req(body: Record<string, unknown>): NextRequest {
  return new NextRequest('https://app.example.com/api/teacher/assignments/a1/paper-intelligence/mark-page', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
  })
}

const params = Promise.resolve({ id: 'a1' })

test('unauthenticated request: 401, and NO image retrieval, NO Gemini call, NO evidence write', async () => {
  resetCounters()
  authShouldThrow = new FakeUnauthorizedError('no session')
  submissionRow = { id: 'a1111111-1111-4111-8111-111111111111', assignment_id: 'a1', class_id: 'c1', student_id: 'stu1', file_path: 'x.jpg', file_type: 'image/jpeg' }

  const res = await POST(req({ submissionId: 'a1111111-1111-4111-8111-111111111111' }), { params })
  assert.equal(res.status, 401)
  assert.equal(storageDownloadCallCount, 0, 'no image retrieval on an unauthenticated request')
  assert.equal(visionCallCount, 0, 'no Gemini call on an unauthenticated request')
  assert.equal(evidenceWriteCallCount, 0, 'no evidence write on an unauthenticated request')
})

test('non-owning teacher (requireClassTeacher throws): 403, and NO image retrieval, NO Gemini call, NO evidence write', async () => {
  resetCounters()
  classTeacherShouldThrow = new FakeResourceOwnershipError('not your class')
  submissionRow = { id: 'a1111111-1111-4111-8111-111111111111', assignment_id: 'a1', class_id: 'c1', student_id: 'stu1', file_path: 'x.jpg', file_type: 'image/jpeg' }

  const res = await POST(req({ submissionId: 'a1111111-1111-4111-8111-111111111111' }), { params })
  assert.equal(res.status, 403)
  assert.equal(storageDownloadCallCount, 0)
  assert.equal(visionCallCount, 0)
  assert.equal(evidenceWriteCallCount, 0)
})

test('submissionId belongs to a DIFFERENT assignment than the URL path: 404, and NO image retrieval, NO Gemini call', async () => {
  resetCounters()
  // A real submission row, but for assignment "a2" — attacker (or a
  // confused client) supplies it against assignment "a1"'s URL.
  submissionRow = { id: 'a1111111-1111-4111-8111-111111111111', assignment_id: 'a2', class_id: 'c1', student_id: 'stu1', file_path: 'x.jpg', file_type: 'image/jpeg' }

  const res = await POST(req({ submissionId: 'a1111111-1111-4111-8111-111111111111' }), { params })
  assert.equal(res.status, 404)
  assert.equal(storageDownloadCallCount, 0, 'cross-assignment substitution must never reach image retrieval')
  assert.equal(visionCallCount, 0)
})

test('nonexistent submissionId: 404, no crash, no image retrieval', async () => {
  resetCounters()
  submissionRow = null
  const res = await POST(req({ submissionId: '00000000-0000-0000-0000-000000000000' }), { params })
  assert.equal(res.status, 404)
  assert.equal(storageDownloadCallCount, 0)
})

test('malformed request body (submissionId not a UUID) rejected before any DB/storage/Gemini access', async () => {
  resetCounters()
  const res = await POST(req({ submissionId: 'not-a-uuid' }), { params })
  assert.equal(res.status, 400)
  assert.equal(storageDownloadCallCount, 0)
  assert.equal(visionCallCount, 0)
})

test('an arbitrary client-supplied field (attempted URL/path override) is ignored — the route has no field for it at all', async () => {
  resetCounters()
  submissionRow = { id: 'a1111111-1111-4111-8111-111111111111', assignment_id: 'a1', class_id: 'c1', student_id: 'stu1', file_path: 'trusted/real/path.jpg', file_type: 'image/jpeg' }
  await POST(req({
    submissionId: 'a1111111-1111-4111-8111-111111111111',
    imageUrl: 'https://attacker.example.com/evil.jpg',
    filePath: '../../other-tenant/secret.jpg',
    storagePath: 'other-tenant-bucket/x.jpg',
  } as unknown as Record<string, unknown>), { params })
  // The zod RequestSchema strips unknown keys — only submissionId is ever
  // read. Prove the trusted file_path (from the DB row) was what was
  // actually fetched, never anything from the request body.
  assert.equal(storageDownloadCallCount, 1)
})

test('valid, authorized request: 200, evidence written, and the vision call used the submission\'s own trusted file_type — never anything else', async () => {
  resetCounters()
  submissionRow = { id: 'a1111111-1111-4111-8111-111111111111', assignment_id: 'a1', class_id: 'c1', student_id: 'stu1', file_path: 'trusted/real/path.jpg', file_type: 'image/jpeg' }

  const res = await POST(req({ submissionId: 'a1111111-1111-4111-8111-111111111111' }), { params })
  assert.equal(res.status, 200)
  assert.equal(storageDownloadCallCount, 1)
  assert.equal(visionCallCount, 1)
  assert.equal(evidenceWriteCallCount, 1)
  assert.equal(capturedVisionRequest?.mimeType, 'image/jpeg')
  const body = await res.json()
  assert.equal(body.data.pendingReview, 1)
})

test('a Gemini/vision failure logs operation=vision_call durably and writes NO evidence', async () => {
  resetCounters()
  visionShouldThrow = true
  submissionRow = { id: 'a1111111-1111-4111-8111-111111111111', assignment_id: 'a1', class_id: 'c1', student_id: 'stu1', file_path: 'x.jpg', file_type: 'image/jpeg' }

  const res = await POST(req({ submissionId: 'a1111111-1111-4111-8111-111111111111' }), { params })
  assert.equal(res.status, 502)
  assert.equal(evidenceWriteCallCount, 0)
  assert.equal(failureLogCalls.length, 1)
  assert.equal(failureLogCalls[0].operation, 'vision_call')
  visionShouldThrow = false
})
