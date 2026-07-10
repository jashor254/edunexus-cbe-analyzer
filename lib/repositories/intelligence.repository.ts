import { BaseRepository } from './base'

// Identity resolution only. Evidence Domain persistence (Phase 2) lives in
// evidence.repository.ts — this repository no longer writes evidence
// through to `assessments`; per docs/architecture/evidence-domain-model.md,
// Evidence exists independently of assessments.

export type StudentIdentityCandidate = {
  id:          string
  name:        string
  grade:       number
  external_id: string | null
}

export class IntelligenceRepository extends BaseRepository {
  async findStudentsByExternalIds(
    externalIds: string[],
    teacherId:   string,
  ): Promise<StudentIdentityCandidate[]> {
    if (externalIds.length === 0) return []
    const { data, error } = await this.db
      .from('students')
      .select('id, name, grade, external_id')
      .in('external_id', externalIds)
      .eq('teacher_id', teacherId)
    if (error) throw new Error(`findStudentsByExternalIds: ${error.message}`)
    return data ?? []
  }

  async findStudentsByTeacher(teacherId: string): Promise<StudentIdentityCandidate[]> {
    const { data, error } = await this.db
      .from('students')
      .select('id, name, grade, external_id')
      .eq('teacher_id', teacherId)
    if (error) throw new Error(`findStudentsByTeacher: ${error.message}`)
    return data ?? []
  }
}
