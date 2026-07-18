// lib/repositories/teacherReflection.repository.ts
//
// Owns `teacher_reflections` exclusively (Sprint 12O, ADR-0006 §6). Only
// the canonical operations the mission named — no business logic (no
// ownership/permission checks, no versioning arithmetic, no validation):
// that all lives in lib/teacherReflection/reflection.ts. This repository
// only knows how to read and write rows; the DB's own trigger
// (`enforce_teacher_reflection_immutability`) is the final backstop against
// a published row ever being changed, even if a future bug in the service
// layer tried to call `updateDraft` on one.

import { BaseRepository } from './base'

export type TeacherReflectionStatus = 'draft' | 'published'

export type TeacherReflectionRow = {
  id: string
  learner_id: string
  school_id: string
  teacher_id: string | null
  version: number
  strengths: string
  growth_area: string
  learning_habits: string
  recommended_support: string
  holiday_focus: string | null
  status: TeacherReflectionStatus
  teacher_signature: string | null
  written_at: string
  published_at: string | null
  created_at: string
  updated_at: string
}

export type CreateReflectionInput = {
  learner_id: string
  school_id: string
  teacher_id: string | null
  version: number
  strengths: string
  growth_area: string
  learning_habits: string
  recommended_support: string
  holiday_focus: string | null
}

export type UpdateReflectionInput = Partial<
  Pick<TeacherReflectionRow, 'strengths' | 'growth_area' | 'learning_habits' | 'recommended_support' | 'holiday_focus'>
>

const REFLECTION_COLS =
  'id, learner_id, school_id, teacher_id, version, strengths, growth_area, learning_habits, recommended_support, holiday_focus, status, teacher_signature, written_at, published_at, created_at, updated_at'

export class TeacherReflectionRepository extends BaseRepository {
  async createReflection(input: CreateReflectionInput): Promise<TeacherReflectionRow> {
    const { data, error } = await this.db
      .from('teacher_reflections')
      .insert({ ...input, status: 'draft' })
      .select(REFLECTION_COLS)
      .single()
    if (error) throw new Error(`createReflection: ${error.message}`)
    return data as unknown as TeacherReflectionRow
  }

  /** Only succeeds while the row is still `draft` — the DB trigger rejects any attempt on a `published` row. */
  async updateReflection(id: string, schoolId: string, input: UpdateReflectionInput): Promise<TeacherReflectionRow> {
    const { data, error } = await this.db
      .from('teacher_reflections')
      .update(input)
      .eq('id', id)
      .eq('school_id', schoolId)
      .select(REFLECTION_COLS)
      .single()
    if (error) throw new Error(`updateReflection: ${error.message}`)
    return data as unknown as TeacherReflectionRow
  }

  /** Transitions `draft` -> `published`. The DB trigger prevents this from ever running twice on the same row (a second call would find `status = 'published'` already and be rejected). */
  async publishReflection(id: string, schoolId: string, teacherSignature: string): Promise<TeacherReflectionRow> {
    const { data, error } = await this.db
      .from('teacher_reflections')
      .update({ status: 'published', published_at: new Date().toISOString(), teacher_signature: teacherSignature })
      .eq('id', id)
      .eq('school_id', schoolId)
      .select(REFLECTION_COLS)
      .single()
    if (error) throw new Error(`publishReflection: ${error.message}`)
    return data as unknown as TeacherReflectionRow
  }

  /** The current, *published* reflection for a learner — the highest version among published rows. Never returns a draft. */
  async findCurrent(learnerId: string, schoolId: string): Promise<TeacherReflectionRow | null> {
    const { data, error } = await this.db
      .from('teacher_reflections')
      .select(REFLECTION_COLS)
      .eq('learner_id', learnerId)
      .eq('school_id', schoolId)
      .eq('status', 'published')
      .order('version', { ascending: false })
      .limit(1)
      .maybeSingle()
    if (error) throw new Error(`findCurrent: ${error.message}`)
    return data as unknown as TeacherReflectionRow | null
  }

  /** Every published reflection for a learner, newest first — drafts excluded (a draft is not yet a historical fact). */
  async history(learnerId: string, schoolId: string): Promise<TeacherReflectionRow[]> {
    const { data, error } = await this.db
      .from('teacher_reflections')
      .select(REFLECTION_COLS)
      .eq('learner_id', learnerId)
      .eq('school_id', schoolId)
      .eq('status', 'published')
      .order('version', { ascending: false })
    if (error) throw new Error(`history: ${error.message}`)
    return (data ?? []) as unknown as TeacherReflectionRow[]
  }

  async findById(id: string, schoolId: string): Promise<TeacherReflectionRow | null> {
    const { data, error } = await this.db
      .from('teacher_reflections')
      .select(REFLECTION_COLS)
      .eq('id', id)
      .eq('school_id', schoolId)
      .maybeSingle()
    if (error) throw new Error(`findById: ${error.message}`)
    return data as unknown as TeacherReflectionRow | null
  }

  /** The learner's own draft-in-progress, if one exists — at most one draft per learner at a time (enforced by the service layer, not this repository). */
  async findDraft(learnerId: string, schoolId: string): Promise<TeacherReflectionRow | null> {
    const { data, error } = await this.db
      .from('teacher_reflections')
      .select(REFLECTION_COLS)
      .eq('learner_id', learnerId)
      .eq('school_id', schoolId)
      .eq('status', 'draft')
      .order('version', { ascending: false })
      .limit(1)
      .maybeSingle()
    if (error) throw new Error(`findDraft: ${error.message}`)
    return data as unknown as TeacherReflectionRow | null
  }

  /** The highest version number used for this learner so far (draft or published) — the service layer's versioning arithmetic reads this, never invents its own count. */
  async findHighestVersion(learnerId: string, schoolId: string): Promise<number> {
    const { data, error } = await this.db
      .from('teacher_reflections')
      .select('version')
      .eq('learner_id', learnerId)
      .eq('school_id', schoolId)
      .order('version', { ascending: false })
      .limit(1)
      .maybeSingle()
    if (error) throw new Error(`findHighestVersion: ${error.message}`)
    return data?.version ?? 0
  }
}
