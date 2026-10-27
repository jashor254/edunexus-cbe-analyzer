// lib/paperIntelligence/imageMetadata.test.ts
//
// Stage B4 privacy regression: stripImageMetadata removes EXIF/comment metadata
// from JPEG and PNG script pages while preserving the image structure and pixel
// data, and fails open (returns the original) on anything it cannot parse.
// Synthetic byte fixtures only — no real learner images. See imageMetadata.ts.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { stripImageMetadata } from './imageMetadata'

// ── JPEG fixture builders ──────────────────────────────────────────────────
function jpegSegment(marker: number, data: Buffer): Buffer {
  const len = data.length + 2
  return Buffer.concat([Buffer.from([0xff, marker, (len >> 8) & 0xff, len & 0xff]), data])
}

function buildJpeg(): Buffer {
  const soi = Buffer.from([0xff, 0xd8])
  const app1Exif = jpegSegment(0xe1, Buffer.from('Exif\0\0GPS-LAT-LONG-SECRET', 'latin1'))
  const app0Jfif = jpegSegment(0xe0, Buffer.from('JFIF\0keepme', 'latin1'))
  const comment = jpegSegment(0xfe, Buffer.from('camera-serial-comment', 'latin1'))
  // SOS marker + (stand-in) scan header & entropy data, then EOI — copied verbatim.
  const sosAndData = Buffer.concat([Buffer.from([0xff, 0xda, 0x00, 0x08]), Buffer.from('PIXELDATA', 'latin1')])
  const eoi = Buffer.from([0xff, 0xd9])
  return Buffer.concat([soi, app1Exif, app0Jfif, comment, sosAndData, eoi])
}

test('JPEG: EXIF (APP1) and comment (COM) segments are removed', () => {
  const out = stripImageMetadata(buildJpeg(), 'image/jpeg')
  assert.equal(out.includes(Buffer.from('GPS-LAT-LONG-SECRET')), false, 'EXIF payload must be gone')
  assert.equal(out.includes(Buffer.from('camera-serial-comment')), false, 'comment must be gone')
})

test('JPEG: structure and pixel data are preserved', () => {
  const out = stripImageMetadata(buildJpeg(), 'image/jpeg')
  assert.equal(out[0], 0xff)
  assert.equal(out[1], 0xd8) // SOI
  assert.equal(out[out.length - 2], 0xff)
  assert.equal(out[out.length - 1], 0xd9) // EOI
  assert.equal(out.includes(Buffer.from('JFIF')), true, 'APP0/JFIF is kept')
  assert.equal(out.includes(Buffer.from('PIXELDATA')), true, 'scan/pixel data is kept')
})

test('JPEG: malformed bytes fail open (original returned)', () => {
  const malformed = Buffer.from([0xff, 0xd8, 0x00, 0x11, 0x22]) // not FF-led after SOI
  const out = stripImageMetadata(malformed, 'image/jpeg')
  assert.equal(out.equals(malformed), true)
})

// ── PNG fixture builders ────────────────────────────────────────────────────
function pngChunk(type: string, data: Buffer): Buffer {
  const len = Buffer.alloc(4)
  len.writeUInt32BE(data.length, 0)
  const crc = Buffer.from([0x00, 0x00, 0x00, 0x00]) // stripper does not verify CRC
  return Buffer.concat([len, Buffer.from(type, 'ascii'), data, crc])
}

const PNG_SIG = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])

function buildPng(): Buffer {
  return Buffer.concat([
    PNG_SIG,
    pngChunk('IHDR', Buffer.alloc(13)),
    pngChunk('tEXt', Buffer.from('Author=AminaChild', 'latin1')),
    pngChunk('eXIf', Buffer.from('GPS-METADATA', 'latin1')),
    pngChunk('IDAT', Buffer.from('REAL-PIXELS', 'latin1')),
    pngChunk('IEND', Buffer.alloc(0)),
  ])
}

test('PNG: tEXt and eXIf metadata chunks are removed', () => {
  const out = stripImageMetadata(buildPng(), 'image/png')
  assert.equal(out.includes(Buffer.from('AminaChild')), false, 'text metadata must be gone')
  assert.equal(out.includes(Buffer.from('GPS-METADATA')), false, 'eXIf must be gone')
})

test('PNG: signature and critical chunks (IHDR/IDAT/IEND) are preserved', () => {
  const out = stripImageMetadata(buildPng(), 'image/png')
  assert.equal(out.subarray(0, 8).equals(PNG_SIG), true)
  assert.equal(out.includes(Buffer.from('IHDR')), true)
  assert.equal(out.includes(Buffer.from('IDAT')), true)
  assert.equal(out.includes(Buffer.from('REAL-PIXELS')), true)
  assert.equal(out.includes(Buffer.from('IEND')), true)
})

test('WebP and unknown types pass through unchanged (documented residual)', () => {
  const webp = Buffer.from('RIFF....WEBPsomebytes', 'latin1')
  assert.equal(stripImageMetadata(webp, 'image/webp').equals(webp), true)
  assert.equal(stripImageMetadata(webp, 'application/octet-stream').equals(webp), true)
})
