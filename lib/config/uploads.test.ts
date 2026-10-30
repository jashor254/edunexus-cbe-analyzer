// Run: npx tsx --test lib/config/uploads.test.ts
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { isAllowedUploadType, UPLOAD_LIMITS, matchesFileSignature, UPLOAD_EXTENSION_BY_MIME_TYPE } from './uploads'

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

// ── Security audit 2026-10-30 (P3): content, not the client's claim ──────────

const bytesOf = (...parts: Array<number[] | string>) =>
  new Uint8Array(parts.flatMap(p => typeof p === 'string' ? [...p].map(c => c.charCodeAt(0)) : p))

test('matchesFileSignature: genuine JPEG / PNG / WebP / PDF headers are accepted', () => {
  assert.equal(matchesFileSignature(bytesOf([0xff, 0xd8, 0xff, 0xe0]), 'image/jpeg'), true)
  assert.equal(matchesFileSignature(bytesOf([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0]), 'image/png'), true)
  assert.equal(matchesFileSignature(bytesOf('RIFF', [1, 2, 3, 4], 'WEBPVP8 '), 'image/webp'), true)
  assert.equal(matchesFileSignature(bytesOf('%PDF-1.7\n'), 'application/pdf'), true)
})

test('matchesFileSignature: content that does not match its declared type is refused', () => {
  const html = bytesOf('<!doctype html><script>alert(1)</script>')
  for (const mime of ['image/jpeg', 'image/png', 'image/webp', 'application/pdf']) {
    assert.equal(matchesFileSignature(html, mime), false, mime)
  }
  assert.equal(matchesFileSignature(bytesOf('%PDF-1.7'), 'image/png'), false, 'a PDF declared as PNG')
  assert.equal(matchesFileSignature(bytesOf('RIFF', [0, 0, 0, 0], 'WAVE'), 'image/webp'), false, 'a RIFF that is not WebP')
  assert.equal(matchesFileSignature(new Uint8Array(), 'image/jpeg'), false, 'empty file')
})

test('matchesFileSignature: an unknown type is never accepted', () => {
  assert.equal(matchesFileSignature(bytesOf('%PDF-'), 'text/html'), false)
})

test('every allowed upload type has a storage extension derived from the type itself', () => {
  for (const mime of UPLOAD_LIMITS.allowedMimeTypes) {
    assert.match(UPLOAD_EXTENSION_BY_MIME_TYPE[mime] ?? '', /^[a-z]{3,4}$/, mime)
  }
})
