// lib/paperIntelligence/imageMetadata.ts
//
// Server-side stripping of image METADATA (not pixels) from captured script
// pages before they are stored and later sent to the external vision model.
// Phone photos carry EXIF — GPS coordinates, device model, capture timestamp —
// which can help identify a child even when their name is not written on the
// page. The normal capture path (lib/paperIntelligence/clientImage.ts) already
// drops EXIF by re-encoding through a <canvas>, but the server must not depend
// on a well-behaved client: this is the server-side guarantee.
//
// Pixel data is never touched, so marking accuracy is unaffected. There is no
// image-processing dependency; this parses the container format and drops the
// metadata segments/chunks only. It is deliberately FAIL-OPEN: if the bytes do
// not parse cleanly, the ORIGINAL bytes are returned unchanged — corrupting a
// learner's script would be far worse than a rare metadata leak. The residual
// (handwritten names inside the image, and WebP metadata) is documented in
// docs/audits/learner-data-privacy-deep-audit.md. See remediation plan Stage B4.

/** Strip metadata from a supported image, by MIME type. Never throws. */
export function stripImageMetadata(bytes: Buffer, mimeType: string): Buffer {
  try {
    if (mimeType === 'image/jpeg') return stripJpeg(bytes)
    if (mimeType === 'image/png') return stripPng(bytes)
    // image/webp and anything else: pass through unchanged (no safe
    // dependency-free stripper) — residual documented.
    return bytes
  } catch {
    return bytes
  }
}

// JPEG: a sequence of marker segments after SOI (FFD8). APP1–APP15 (FFE1–FFEF)
// carry Exif/XMP; COM (FFFE) carries comments. We drop those and keep
// everything else, including APP0/JFIF (FFE0) and all pixel data from SOS on.
function stripJpeg(buf: Buffer): Buffer {
  if (buf.length < 2 || buf[0] !== 0xff || buf[1] !== 0xd8) return buf
  const out: Buffer[] = [buf.subarray(0, 2)]
  let i = 2
  while (i + 1 < buf.length) {
    if (buf[i] !== 0xff) return buf // malformed — fail open
    const marker = buf[i + 1]
    // Start of scan: the rest of the file is entropy-coded pixel data + EOI.
    if (marker === 0xda) { out.push(buf.subarray(i)); return Buffer.concat(out) }
    // Standalone markers (no length word).
    if (marker === 0x01 || marker === 0xd9 || (marker >= 0xd0 && marker <= 0xd7)) {
      out.push(buf.subarray(i, i + 2)); i += 2; continue
    }
    // Length-prefixed segment (length includes its own 2 bytes).
    if (i + 3 >= buf.length) return buf
    const len = (buf[i + 2] << 8) | buf[i + 3]
    const segEnd = i + 2 + len
    if (len < 2 || segEnd > buf.length) return buf // malformed — fail open
    const isMetadata = (marker >= 0xe1 && marker <= 0xef) || marker === 0xfe
    if (!isMetadata) out.push(buf.subarray(i, segEnd))
    i = segEnd
  }
  return Buffer.concat(out)
}

const PNG_SIGNATURE = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])
// Ancillary (optional) chunks that carry metadata. All are safe to omit.
const PNG_METADATA_CHUNKS = new Set(['eXIf', 'tEXt', 'zTXt', 'iTXt', 'tIME'])

// PNG: 8-byte signature then <len:4><type:4><data><crc:4> chunks. We copy every
// chunk except the metadata ones; each chunk is self-contained (own CRC), so
// omitting whole chunks keeps the file valid.
function stripPng(buf: Buffer): Buffer {
  if (buf.length < 8 || !buf.subarray(0, 8).equals(PNG_SIGNATURE)) return buf
  const out: Buffer[] = [buf.subarray(0, 8)]
  let i = 8
  while (i + 8 <= buf.length) {
    const len = buf.readUInt32BE(i)
    const type = buf.toString('ascii', i + 4, i + 8)
    const chunkEnd = i + 12 + len
    if (chunkEnd > buf.length) return buf // malformed — fail open
    if (!PNG_METADATA_CHUNKS.has(type)) out.push(buf.subarray(i, chunkEnd))
    i = chunkEnd
    if (type === 'IEND') break
  }
  return Buffer.concat(out)
}
