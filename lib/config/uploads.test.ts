// Run: npx tsx --test lib/config/uploads.test.ts
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { isAllowedUploadType, UPLOAD_LIMITS } from './uploads'

test('isAllowedUploadType: accepts every configured MIME type', () => {
  for (const type of UPLOAD_LIMITS.allowedMimeTypes) {
    assert.equal(isAllowedUploadType(type), true)
  }
})

test('isAllowedUploadType: rejects an executable/script MIME type', () => {
  assert.equal(isAllowedUploadType('application/x-msdownload'), false)
  assert.equal(isAllowedUploadType('text/html'), false)
})

test('isAllowedUploadType: rejects an empty string', () => {
  assert.equal(isAllowedUploadType(''), false)
})
