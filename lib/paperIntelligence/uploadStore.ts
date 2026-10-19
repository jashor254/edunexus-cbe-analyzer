// lib/paperIntelligence/uploadStore.ts
//
// Server-only — the rows lib/paperIntelligence/upload.ts reads and writes
// itself: the paper being filed, its paper_mark_uploads record, and closing a
// quick paper once it is filed topical. Self-contained service-role access,
// matching scriptMarks.ts. Callers authorize first.

import { createServiceClient } from '@/utils/supabase/service'

export class PaperNotFoundError extends Error {}

export type UploadDestination = 'topical' | 'termly'

export type FileablePaper = {
  id: string
  title: string
  subject: string
  topic: string | null
  substrandId: string | null
  classId: string
  maxScore: number
  origin: 'standard' | 'paper_marking'
  status: string
  isAdaptive: boolean
}

export type ExistingUpload = {
  destination: UploadDestination
  classAssessmentId: string | null
  subject: string | null
  uploadedAt: string
  learnerCount: number
}

const PAPER_COLS = 'id, title, subject, topic, substrand_id, class_id, max_score, origin, status, is_adaptive' as const

export async function findPaper(assignmentId: string): Promise<FileablePaper> {
  const db = createServiceClient()
  const { data, error } = await db.from('assignments').select(PAPER_COLS).eq('id', assignmentId).maybeSingle()
  if (error) throw new Error(`findPaper: ${error.message}`)
  if (!data) throw new PaperNotFoundError('Paper not found.')
  return {
    id: data.id as string,
    title: data.title as string,
    subject: data.subject as string,
    topic: (data.topic as string | null) ?? null,
    substrandId: (data.substrand_id as string | null) ?? null,
    classId: data.class_id as string,
    maxScore: (data.max_score as number | null) ?? 100,
    origin: data.origin as FileablePaper['origin'],
    status: data.status as string,
    isAdaptive: data.is_adaptive as boolean,
  }
}

export async function findExistingUpload(assignmentId: string): Promise<ExistingUpload | null> {
  const db = createServiceClient()
  const { data, error } = await db
    .from('paper_mark_uploads')
    .select('destination, class_assessment_id, subject, uploaded_at, learner_count')
    .eq('assignment_id', assignmentId)
    .maybeSingle()
  if (error) throw new Error(`findExistingUpload: ${error.message}`)
  if (!data) return null
  return {
    destination: data.destination as UploadDestination,
    classAssessmentId: (data.class_assessment_id as string | null) ?? null,
    subject: (data.subject as string | null) ?? null,
    uploadedAt: data.uploaded_at as string,
    learnerCount: data.learner_count as number,
  }
}

export async function closePaper(assignmentId: string): Promise<void> {
  const db = createServiceClient()
  const { error } = await db
    .from('assignments')
    .update({ status: 'closed', updated_at: new Date().toISOString() })
    .eq('id', assignmentId)
    .eq('origin', 'paper_marking')
  if (error) throw new Error(`closePaper: ${error.message}`)
}

export async function recordUpload(row: {
  assignmentId: string
  destination: UploadDestination
  classAssessmentId: string | null
  subject: string | null
  uploadedBy: string
  learnerCount: number
}): Promise<void> {
  const db = createServiceClient()
  const now = new Date().toISOString()
  const { error } = await db.from('paper_mark_uploads').upsert({
    assignment_id: row.assignmentId,
    destination: row.destination,
    class_assessment_id: row.classAssessmentId,
    subject: row.subject,
    uploaded_by: row.uploadedBy,
    uploaded_at: now,
    learner_count: row.learnerCount,
    updated_at: now,
  }, { onConflict: 'assignment_id' })
  if (error) throw new Error(`recordUpload: ${error.message}`)
}
