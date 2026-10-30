// lib/config/uploads.ts
// Single source of truth for file-upload limits across the LMS
// (assignment submissions, class resources). CLAUDE.md: no hardcoded
// limits scattered across routes — one place, imported everywhere.

const IMAGE_MIME_TYPES = ['image/jpeg', 'image/png', 'image/webp'] as const

export const UPLOAD_LIMITS = {
  maxFileSizeBytes: 10 * 1024 * 1024, // 10MB — a phone photo of handwritten work
  allowedMimeTypes: [
    ...IMAGE_MIME_TYPES,
    'application/pdf',
  ],
} as const

export function isAllowedUploadType(mimeType: string): boolean {
  return (UPLOAD_LIMITS.allowedMimeTypes as readonly string[]).includes(mimeType)
}

// School logo/crest — images only, no PDF, and a much smaller cap than the
// general upload limit (this is rendered inline on a report cover, not
// stored as a document).
export const SCHOOL_LOGO_LIMITS = {
  maxFileSizeBytes: 2 * 1024 * 1024, // 2MB
  allowedMimeTypes: IMAGE_MIME_TYPES,
} as const

export function isAllowedSchoolLogoType(mimeType: string): boolean {
  return (SCHOOL_LOGO_LIMITS.allowedMimeTypes as readonly string[]).includes(mimeType)
}

// Storage-object extension for each allowed type. Derived from the validated
// MIME type, never from the client-supplied filename (security audit
// 2026-10-30, P3: a filename could put any extension — or extra path
// segments — into the storage key).
export const UPLOAD_EXTENSION_BY_MIME_TYPE: Record<string, string> = {
  'image/jpeg':      'jpg',
  'image/png':       'png',
  'image/webp':      'webp',
  'application/pdf': 'pdf',
}

/**
 * True when the file's leading bytes match its declared type. The declared
 * type (`File.type`) is whatever the client sent; this checks the content
 * actually is a JPEG / PNG / WebP / PDF before it is stored or handed to a
 * vision model.
 */
export function matchesFileSignature(bytes: Uint8Array, mimeType: string): boolean {
  const startsWith = (sig: number[], offset = 0) => sig.every((b, i) => bytes[offset + i] === b)
  const ascii = (s: string) => [...s].map(c => c.charCodeAt(0))
  switch (mimeType) {
    case 'image/jpeg':      return startsWith([0xff, 0xd8, 0xff])
    case 'image/png':       return startsWith([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])
    case 'image/webp':      return startsWith(ascii('RIFF')) && startsWith(ascii('WEBP'), 8)
    case 'application/pdf': return startsWith(ascii('%PDF-'))
    default:                return false
  }
}
