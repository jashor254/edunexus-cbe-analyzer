// lib/repositories/learning-signal.repository.ts
// Raw DB access for the "did learning take place" primitive. Deliberately
// separate from knowledge-graph.repository.ts — this reads strand_assessments
// joined only against assessments (for grade), never knowledge_nodes/edges or
// node_assessment_map. Subject/grade-agnostic, graph-free.

import { BaseRepository } from './base'

export type StrandAssessmentSample = {
  strand:     string
  topic:      string
  rating:     number
  created_at: string
}

export class LearningSignalRepository extends BaseRepository {
  /**
   * Every strand_assessments row for one learner, one subject, within a date
   * range (inclusive), restricted to the given grade via the assessments FK.
   * Ordered oldest-first so callers can take first/last per topic directly.
   */
  async getStrandAssessmentsInRange(
    learnerId: string,
    subject:   string,
    grade:     number,
    fromDate:  string,
    toDate:    string,
  ): Promise<StrandAssessmentSample[]> {
    const { data, error } = await this.db
      .from('strand_assessments')
      .select('strand, topic, rating, created_at, assessments!inner(grade)')
      .eq('student_id', learnerId)
      .eq('subject', subject)
      .eq('assessments.grade', grade)
      .gte('created_at', fromDate)
      .lte('created_at', toDate)
      .order('created_at', { ascending: true })

    if (error) throw new Error(`strand_assessments range query failed: ${error.message}`)

    return (data ?? []).map(row => ({
      strand:     row.strand as string,
      topic:      row.topic as string,
      rating:     row.rating as number,
      created_at: row.created_at as string,
    }))
  }
}
