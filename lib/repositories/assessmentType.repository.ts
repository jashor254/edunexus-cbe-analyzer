import { BaseRepository } from './base'

// Data access for Phase B — school/teacher-configurable assessment types
// (docs/architecture/academic-evidence-layer.md §7, Rule 5). Deliberately
// its own repository, matching the Evidence Domain / Promotion precedent
// of one dedicated repository per new domain concept.

export type AssessmentTypeRow = {
  id: string
  school_id: string | null
  teacher_id: string | null
  name: string
  sort_order: number
  created_at: string
  /** Phase G (learner-record-layer-decisions.md Decision 2) — null until deliberately set; the 6 Phase-B-seeded names get a reasonable default via migration, custom names stay null until a future UI lets a teacher choose one. */
  default_purpose_id: string | null
}

const COLS = 'id, school_id, teacher_id, name, sort_order, created_at, default_purpose_id'

export class AssessmentTypeRepository extends BaseRepository {
  async findById(id: string): Promise<AssessmentTypeRow | null> {
    const { data, error } = await this.db.from('assessment_types').select(COLS).eq('id', id).maybeSingle()
    if (error) throw new Error(`findById: ${error.message}`)
    return data
  }

  async findByTeacherAndName(teacherId: string, name: string): Promise<AssessmentTypeRow | null> {
    const { data, error } = await this.db
      .from('assessment_types')
      .select(COLS)
      .eq('teacher_id', teacherId)
      .eq('name', name)
      .maybeSingle()
    if (error) throw new Error(`findByTeacherAndName: ${error.message}`)
    return data
  }

  async findAllForTeacher(teacherId: string): Promise<AssessmentTypeRow[]> {
    const { data, error } = await this.db
      .from('assessment_types')
      .select(COLS)
      .eq('teacher_id', teacherId)
      .order('sort_order', { ascending: true })
    if (error) throw new Error(`findAllForTeacher: ${error.message}`)
    return data ?? []
  }

  async create(teacherId: string, name: string, sortOrder: number, defaultPurposeId: string | null = null): Promise<AssessmentTypeRow> {
    const { data, error } = await this.db
      .from('assessment_types')
      .insert({ teacher_id: teacherId, name, sort_order: sortOrder, default_purpose_id: defaultPurposeId })
      .select(COLS)
      .single()
    if (error) throw new Error(`create: ${error.message}`)
    return data
  }
}
