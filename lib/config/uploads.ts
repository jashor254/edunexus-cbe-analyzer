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
