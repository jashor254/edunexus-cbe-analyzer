import { createClient } from '@/utils/supabase/server'
import { createServiceClient } from '@/utils/supabase/service'
import {
  apiSuccess, apiError, apiUnauthorized, apiForbidden, apiBadRequest, apiNotFound,
} from '@/lib/api/response'
import { getAssessmentById, upsertMarksCSV } from '@/lib/assessments/queries'
import type { MarkInput } from '@/lib/assessments/types'

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
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return apiUnauthorized()

    const db = createServiceClient()
    const { data: teacher } = await db.from('teachers').select('id').eq('user_id', user.id).single()
    if (!teacher) return apiForbidden()

    const assessment = await getAssessmentById(assessmentId, teacher.id)
    if (!assessment) return apiNotFound('Assessment not found')

    const formData = await req.formData()
    const file = formData.get('file')
    if (!file || typeof file === 'string') return apiBadRequest('CSV file required')

    const text = await (file as Blob).text()
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
