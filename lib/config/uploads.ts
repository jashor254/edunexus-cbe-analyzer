// lib/config/uploads.ts
// Single source of truth for file-upload limits across the LMS
// (assignment submissions, class resources). CLAUDE.md: no hardcoded
// limits scattered across routes — one place, imported everywhere.

export const UPLOAD_LIMITS = {
  maxFileSizeBytes: 10 * 1024 * 1024, // 10MB — a phone photo of handwritten work
  allowedMimeTypes: [
    'image/jpeg',
    'image/png',
    'image/webp',
    'application/pdf',
  ],
} as const

export function isAllowedUploadType(mimeType: string): boolean {
  return (UPLOAD_LIMITS.allowedMimeTypes as readonly string[]).includes(mimeType)
}
