import { createClient } from '@/utils/supabase/server'
import {
  apiSuccess, apiError, apiUnauthorized, apiForbidden, apiBadRequest, apiNotFound,
} from '@/lib/api/response'
import { getAssessmentById } from '@/lib/assessments/getters'
import { upsertMarksCSV, triggerLearnerModelUpdates } from '@/lib/assessments/mutations'
import { recordAssessmentEvidence } from '@/lib/assessments/evidence'
import type { MarkInput } from '@/lib/assessments/types'
import { requireAuthentication } from '@/lib/core/permissions'
import { resolveTeacher } from '@/lib/core/identity'
import { UnauthorizedError } from '@/lib/core/errors'

type UploadError = { row: number; field: string; message: string }

function parseCSV(text: string): string[][] {
  return text
    .split(/\r?\n/)
    .filter((line) => line.trim())
    .map((line) =>
      line.split(',').map((cell) => cell.trim().replace(/^["']|["']$/g, ''))
    )
}

export async function POST(
  req: Request,
  { params }: { params: Promise<{ assessmentId: string }> }
) {
  try {
    const { assessmentId } = await params
    const supabase = await createClient()
    let userId: string
    try {
      userId = (await requireAuthentication(supabase)).id
    } catch (err) {
      if (err instanceof UnauthorizedError) return apiUnauthorized()
      throw err
    }

    const teacher = await resolveTeacher(userId)
    if (!teacher) return apiForbidden()

    const assessment = await getAssessmentById(assessmentId, teacher.id)
    if (!assessment) return apiNotFound('Assessment not found')
    // Sprint 12 Wave 2 (High 2) — same lock guard as the manual bulk-save
    // route (app/api/teacher/assessments/[assessmentId]/marks/route.ts);
    // reuses the already-fetched assessment row, no new query.
    if (assessment.is_published) {
      return apiBadRequest('This assessment is locked — marks cannot be edited once published. Unpublish it first if a correction is genuinely needed.')
    }

    const formData = await req.formData()
    const file = formData.get('file')
    if (!file || typeof file === 'string') return apiBadRequest('CSV file required')

    const fileBlob = file as File
    const MAX_CSV_SIZE = 5 * 1024 * 1024 // 5 MB
    if (fileBlob.size > MAX_CSV_SIZE) return apiBadRequest('File too large — CSV must be under 5 MB')
    const mimeType = fileBlob.type
    if (mimeType && mimeType !== 'text/csv' && mimeType !== 'application/csv' && mimeType !== 'application/vnd.ms-excel' && !mimeType.startsWith('text/')) {
      return apiBadRequest('Invalid file type — only CSV files are accepted')
    }

    const text = await fileBlob.text()
    const rows = parseCSV(text)
    if (rows.length < 2) return apiBadRequest('CSV must have a header row and at least one data row')

    const headers = rows[0].map((h) => h.toLowerCase().trim())
    const nameIdx = headers.findIndex((h) => h === 'name' || h.includes('name'))
    const admIdx  = headers.findIndex((h) => h === 'adm no' || h.includes('adm'))
    if (nameIdx === -1) return apiBadRequest('CSV must have a "Name" column')

    const errors: UploadError[] = []
    const marks: MarkInput[]    = []
    let skipped = 0

    for (let i = 1; i < rows.length; i++) {
      const row = rows[i]
      const studentName = row[nameIdx]?.trim()
      if (!studentName) { skipped++; continue }

      const subjectScores: Record<string, number> = {}

      for (const subject of assessment.subjects) {
        const colIdx = headers.findIndex(
          (h) => h === subject.toLowerCase() || h.startsWith(subject.toLowerCase().slice(0, 5))
        )
        if (colIdx === -1) continue

        const raw = row[colIdx]?.trim()
        if (!raw) continue

        const score = parseInt(raw, 10)
        if (isNaN(score)) {
          errors.push({ row: i + 1, field: subject, message: `Non-numeric value "${raw}"` })
          continue
        }
        if (score < 0 || score > assessment.max_score) {
          errors.push({ row: i + 1, field: subject, message: `Score ${score} exceeds max ${assessment.max_score}` })
          continue
        }
        subjectScores[subject] = score
      }

      marks.push({
        studentName,
        admNo: admIdx !== -1 ? (row[admIdx]?.trim() || undefined) : undefined,
        subjectScores,
      })
    }

    if (marks.length === 0) return apiBadRequest('No valid rows found in CSV')

    const result = await upsertMarksCSV(
      assessmentId,
      assessment.class_id,
      teacher.id,
      marks,
      assessment.curriculum_type ?? 'cbc',
      assessment.max_score
    )

    // Update Learner Model for linked students — fire and forget
    triggerLearnerModelUpdates(assessmentId, teacher.id).catch((e: unknown) => console.error('[marks upload] triggerLearnerModelUpdates failed:', e instanceof Error ? e.message : String(e)))

    // Emit Evidence Domain records so Blueprint/Career/Adaptive Learning move
    // from these marks too, not only from Compass sessions — fire and forget
    recordAssessmentEvidence(assessmentId, teacher.id, userId).catch((e: unknown) => console.error('[marks upload] recordAssessmentEvidence failed:', e instanceof Error ? e.message : String(e)))

    return apiSuccess({
      imported: result.inserted,
      updated:  result.updated,
      errors,
      skipped,
    })
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e)
    console.error('[marks upload]', msg)
    return apiError('Failed to process CSV upload')
  }
}
