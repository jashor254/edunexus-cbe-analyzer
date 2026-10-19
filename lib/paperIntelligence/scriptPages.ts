// lib/paperIntelligence/scriptPages.ts
//
// Server-only — a learner's captured script pages: the authoritative
// sharpness check, storage in the private assignment-submissions bucket, and
// the assignment_submission_pages rows. Self-contained service-role access,
// matching rubrics.ts. Callers authorize first (requireScriptAccess).
//
// The phone runs the same sharpness measure before uploading so a teacher
// gets an instant "retake" — but the server re-measures every page itself and
// never trusts the phone's verdict.

import sharp, { type OutputInfo } from 'sharp'
import { createServiceClient } from '@/utils/supabase/service'
import { UPLOAD_LIMITS } from '@/lib/config/uploads'
import { PAPER_INTELLIGENCE_LIMITS } from '@/lib/config/paperIntelligence'
import { assessSharpness, type SharpnessResult } from './sharpness'
import type { ScriptPage } from './types'

const BUCKET = 'assignment-submissions'
const PAGE_COLS = 'id, submission_id, page_number, file_path, file_type, blur_score, created_at' as const

type PageMimeType = ScriptPage['mimeType']

export class BlurryPageError extends Error {
  constructor(readonly sharpness: SharpnessResult) {
    super(`Page is too blurry to read (sharpness ${sharpness.score})`)
  }
}
export class InvalidPageError extends Error {}

export type ScriptPageRow = {
  id: string
  submission_id: string
  page_number: number
  file_path: string
  file_type: PageMimeType
  blur_score: number | null
  created_at: string
}

const EXTENSION: Record<PageMimeType, string> = { 'image/jpeg': 'jpg', 'image/png': 'png', 'image/webp': 'webp' }

/** Same measurement as the phone: an analysis copy bounded to the configured long edge, greyscale. */
export async function measurePageSharpness(bytes: Buffer): Promise<SharpnessResult> {
  const edge = PAPER_INTELLIGENCE_LIMITS.sharpnessAnalysisEdgePx
  let analysis: { data: Buffer; info: OutputInfo }
  try {
    // .rotate() applies EXIF orientation first, so the copy is upright.
    analysis = await sharp(bytes).rotate()
      .resize(edge, edge, { fit: 'inside', withoutEnlargement: true })
      .greyscale().raw()
      .toBuffer({ resolveWithObject: true })
  } catch {
    throw new InvalidPageError('The photo could not be read as an image')
  }
  return assessSharpness({ pixels: analysis.data, width: analysis.info.width, height: analysis.info.height })
}

export type SaveScriptPageInput = {
  assignmentId: string
  submissionId: string
  pageNumber: number
  imageBase64: string
  mimeType: PageMimeType
  /** How the page arrived — a phone photo (default) or a page split from a scanned PDF. */
  captureSource?: 'phone' | 'scan'
}

/**
 * Store one page. Re-capturing an existing page number replaces it (the old
 * object is removed). Throws BlurryPageError — nothing stored — when the page
 * fails the sharpness check, so the teacher retakes it.
 */
export async function saveScriptPage(input: SaveScriptPageInput): Promise<{ page: ScriptPageRow; sharpness: SharpnessResult }> {
  if (!Number.isInteger(input.pageNumber) || input.pageNumber < 1 || input.pageNumber > PAPER_INTELLIGENCE_LIMITS.maxPagesPerScript) {
    throw new InvalidPageError(`Page number must be 1–${PAPER_INTELLIGENCE_LIMITS.maxPagesPerScript}`)
  }
  const bytes = Buffer.from(input.imageBase64, 'base64')
  if (bytes.length === 0) throw new InvalidPageError('Empty image')
  if (bytes.length > UPLOAD_LIMITS.maxFileSizeBytes) {
    throw new InvalidPageError(`Image exceeds the ${UPLOAD_LIMITS.maxFileSizeBytes} byte upload limit`)
  }

  const sharpness = await measurePageSharpness(bytes)
  if (!sharpness.acceptable) throw new BlurryPageError(sharpness)

  const db = createServiceClient()
  const { data: existing, error: findErr } = await db
    .from('assignment_submission_pages')
    .select('file_path')
    .eq('submission_id', input.submissionId)
    .eq('page_number', input.pageNumber)
    .maybeSingle()
  if (findErr) throw new Error(`saveScriptPage lookup: ${findErr.message}`)

  const filePath = `paper-intelligence/${input.assignmentId}/${input.submissionId}/p${input.pageNumber}-${Date.now()}.${EXTENSION[input.mimeType]}`
  const { error: uploadErr } = await db.storage.from(BUCKET).upload(filePath, bytes, { contentType: input.mimeType, upsert: false })
  if (uploadErr) throw new Error(`saveScriptPage upload: ${uploadErr.message}`)

  const { data: page, error: upsertErr } = await db
    .from('assignment_submission_pages')
    .upsert({
      submission_id: input.submissionId,
      page_number: input.pageNumber,
      file_path: filePath,
      file_type: input.mimeType,
      blur_score: sharpness.score,
      capture_source: input.captureSource ?? 'phone',
      updated_at: new Date().toISOString(),
    }, { onConflict: 'submission_id,page_number' })
    .select(PAGE_COLS)
    .single()
  if (upsertErr || !page) {
    await db.storage.from(BUCKET).remove([filePath])
    throw new Error(`saveScriptPage row: ${upsertErr?.message ?? 'no row returned'}`)
  }

  if (existing?.file_path && existing.file_path !== filePath) {
    const { error: removeErr } = await db.storage.from(BUCKET).remove([existing.file_path])
    // The new page is saved and the row points at it; a stale object left
    // behind is storage clutter, not a correctness problem — reported, not thrown.
    if (removeErr) console.error('[paperIntelligence/scriptPages] stale page object not removed:', existing.file_path, removeErr.message)
  }

  return { page: page as unknown as ScriptPageRow, sharpness }
}

/** Remove one captured page (wrong page photographed). Returns false when there was nothing to remove. */
export async function deleteScriptPage(submissionId: string, pageNumber: number): Promise<boolean> {
  const db = createServiceClient()
  const { data, error } = await db
    .from('assignment_submission_pages')
    .delete()
    .eq('submission_id', submissionId)
    .eq('page_number', pageNumber)
    .select('file_path')
  if (error) throw new Error(`deleteScriptPage: ${error.message}`)
  const paths = (data ?? []).map(r => r.file_path as string)
  if (paths.length === 0) return false
  const { error: removeErr } = await db.storage.from(BUCKET).remove(paths)
  if (removeErr) console.error('[paperIntelligence/scriptPages] deleted page object not removed:', paths.join(','), removeErr.message)
  return true
}

export async function listScriptPages(submissionId: string): Promise<ScriptPageRow[]> {
  const db = createServiceClient()
  const { data, error } = await db
    .from('assignment_submission_pages')
    .select(PAGE_COLS)
    .eq('submission_id', submissionId)
    .order('page_number', { ascending: true })
  if (error) throw new Error(`listScriptPages: ${error.message}`)
  return (data ?? []) as unknown as ScriptPageRow[]
}

/** submissionId → captured page numbers, for a whole class in one query. */
export async function listPageNumbersForSubmissions(submissionIds: string[]): Promise<Map<string, number[]>> {
  const result = new Map<string, number[]>()
  if (submissionIds.length === 0) return result
  const db = createServiceClient()
  const { data, error } = await db
    .from('assignment_submission_pages')
    .select('submission_id, page_number')
    .in('submission_id', submissionIds)
    .order('page_number', { ascending: true })
  if (error) throw new Error(`listPageNumbersForSubmissions: ${error.message}`)
  for (const row of data ?? []) {
    const list = result.get(row.submission_id as string) ?? []
    list.push(row.page_number as number)
    result.set(row.submission_id as string, list)
  }
  return result
}

/** Download stored pages for marking — by their own trusted storage paths, never a client-supplied one. */
export async function loadScriptPages(rows: ScriptPageRow[]): Promise<ScriptPage[]> {
  const db = createServiceClient()
  return Promise.all(rows.map(async (row): Promise<ScriptPage> => {
    const { data, error } = await db.storage.from(BUCKET).download(row.file_path)
    if (error || !data) throw new Error(`loadScriptPages: page ${row.page_number}: ${error?.message ?? 'no data'}`)
    return {
      pageNumber: row.page_number,
      imageBase64: Buffer.from(await data.arrayBuffer()).toString('base64'),
      mimeType: row.file_type,
    }
  }))
}

/** Short-lived links to view a learner's pages during review — the bucket stays private. */
export async function signScriptPageUrls(submissionId: string): Promise<Array<{ pageNumber: number; url: string }>> {
  const rows = await listScriptPages(submissionId)
  if (rows.length === 0) return []
  const db = createServiceClient()
  const { data, error } = await db.storage
    .from(BUCKET)
    .createSignedUrls(rows.map(r => r.file_path), PAPER_INTELLIGENCE_LIMITS.pageViewUrlTtlSeconds)
  if (error || !data) throw new Error(`signScriptPageUrls: ${error?.message ?? 'no data'}`)
  const urlByPath = new Map(data.map(d => [d.path, d.signedUrl]))
  return rows
    .map(r => ({ pageNumber: r.page_number, url: urlByPath.get(r.file_path) ?? '' }))
    .filter(p => p.url)
}
