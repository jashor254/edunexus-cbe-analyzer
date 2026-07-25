import { test } from 'node:test'
import assert from 'node:assert/strict'
import { NextRequest } from 'next/server'
import { handleBlueprintPdfGetWithDeps } from './route'
import { ResourceOwnershipError, UnauthorizedError } from '@/lib/core/errors'

function req(headers: Record<string, string> = {}) {
  return new NextRequest('https://app.example.com/api/student/blueprint/learner-1/pdf', { headers })
}

type TestDeps = {
  createSupabaseClient: () => Promise<Record<string, never>>
  requireAuthentication: (client: Record<string, never>) => Promise<{ id: string }>
  requireLearnerAccess: (client: Record<string, never>, schoolId: string, learnerId: string) => Promise<{ id: string }>
  findSchoolId: (learnerId: string) => Promise<string>
  findLearnerById: (learnerId: string, schoolId: string) => Promise<{
    first_name: string | null
    middle_name: string | null
    last_name: string | null
  }>
  renderBlueprintPdf: (params: { origin: string; learnerId: string; cookieHeader: string }) => Promise<Uint8Array>
}

function deps(overrides: Partial<TestDeps> = {}): TestDeps {
  return {
    createSupabaseClient: async () => ({}),
    requireAuthentication: async () => ({ id: 'user-1' }),
    requireLearnerAccess: async () => ({ id: 'user-1' }),
    findSchoolId: async () => 'school-1',
    findLearnerById: async () => ({ first_name: 'Brian', middle_name: null, last_name: 'Matthias' }),
    renderBlueprintPdf: async () => new Uint8Array([1, 2, 3, 4]),
    ...overrides,
  }
}

test('Blueprint PDF route returns 401 when unauthenticated', async () => {
  const res = await handleBlueprintPdfGetWithDeps(
    req(),
    { params: Promise.resolve({ learnerId: 'learner-1' }) },
    deps({
      requireAuthentication: async () => {
        throw new UnauthorizedError()
      },
    }),
  )

  assert.equal(res.status, 401)
  assert.equal(await res.json().then(body => body.error), 'Unauthorized')
})

test('Blueprint PDF route returns 403 for authenticated but unauthorized access', async () => {
  const res = await handleBlueprintPdfGetWithDeps(
    req({ cookie: 'sb-auth=token' }),
    { params: Promise.resolve({ learnerId: 'learner-1' }) },
    deps({
      requireLearnerAccess: async () => {
        throw new ResourceOwnershipError('denied')
      },
    }),
  )

  assert.equal(res.status, 403)
  assert.equal(await res.json().then(body => body.error), 'Forbidden')
})

test('Blueprint PDF route returns 200 with private PDF headers and a safe attachment filename', async () => {
  const res = await handleBlueprintPdfGetWithDeps(
    req({ cookie: 'sb-auth=token' }),
    { params: Promise.resolve({ learnerId: 'learner-1' }) },
    deps({
      findLearnerById: async () => ({ first_name: 'Brian /', middle_name: null, last_name: 'Matthias?' }),
      renderBlueprintPdf: async () => new Uint8Array([37, 80, 68, 70]),
    }),
  )

  assert.equal(res.status, 200)
  assert.equal(res.headers.get('content-type'), 'application/pdf')
  assert.equal(res.headers.get('cache-control'), 'private, no-store, max-age=0')
  assert.equal(res.headers.get('pragma'), 'no-cache')
  assert.equal(res.headers.get('content-disposition'), 'attachment; filename="Learner_Blueprint_BRIAN__MATTHIAS.pdf"')
  assert.equal(res.headers.get('content-length'), '4')
})
