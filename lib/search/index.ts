import { repos } from '@/lib/repositories'
import type { SearchResult, SearchResponse, SearchFilters, SearchResourceType } from './types'

const DEFAULT_LIMIT = 20

async function searchSOWs(q: string, teacherId: string): Promise<SearchResult[]> {
  const data = await repos.curriculum.searchSOWsByQuery(q, teacherId)
  return data.map(r => ({
    id:       r.id,
    type:     'sow' as SearchResourceType,
    title:    r.title,
    subtitle: `${r.subject} • Grade ${r.grade} • Term ${r.term} ${r.year}`,
    url:      `/teacher/sow/${r.id}`,
    metadata: { subject: r.subject, grade: r.grade, term: r.term, year: r.year, status: r.status },
    score:    r.title.toLowerCase().includes(q.toLowerCase()) ? 2 : 1,
  }))
}

async function searchLessonPlans(q: string, teacherId: string): Promise<SearchResult[]> {
  const data = await repos.curriculum.searchLessonPlansByQuery(q, teacherId)
  return data.map(r => ({
    id:       r.id,
    type:     'lesson_plan' as SearchResourceType,
    title:    r.title,
    subtitle: `${r.subject} • ${r.strand}`,
    url:      `/teacher/lesson-plans/${r.id}`,
    metadata: { subject: r.subject, grade: r.grade, strand: r.strand },
    score:    r.title.toLowerCase().includes(q.toLowerCase()) ? 2 : 1,
  }))
}

async function searchAssessments(q: string, teacherId: string): Promise<SearchResult[]> {
  const data = await repos.assessments.searchAssessmentsByQuery(q, teacherId)
  return data.map(r => ({
    id:       r.id,
    type:     'assessment' as SearchResourceType,
    title:    r.title,
    subtitle: `${r.assessment_type} • Term ${r.term} ${r.year}`,
    url:      `/teacher/assessments/${r.id}`,
    metadata: { assessment_type: r.assessment_type, term: r.term, year: r.year },
    score:    2,
  }))
}

async function searchLearners(q: string, teacherId: string): Promise<SearchResult[]> {
  const data = await repos.teachers.searchStudentsByQuery(q, teacherId)
  return data.map(r => ({
    id:       r.id,
    type:     'learner' as SearchResourceType,
    title:    r.full_name,
    subtitle: r.admission_number ? `Adm: ${r.admission_number} • ${r.class_name ?? ''}` : r.class_name ?? null,
    url:      `/teacher/learners/${r.id}`,
    metadata: { grade: r.grade, admission_number: r.admission_number },
    score:    r.full_name.toLowerCase().startsWith(q.toLowerCase()) ? 3 : 2,
  }))
}

async function searchClasses(q: string, teacherId: string): Promise<SearchResult[]> {
  const data = await repos.teachers.searchClassesByQuery(q, teacherId)
  return data.map(r => ({
    id:       r.id,
    type:     'class' as SearchResourceType,
    title:    r.name,
    subtitle: `${r.subject} • Grade ${r.grade}${r.stream ? ` ${r.stream}` : ''}`,
    url:      `/teacher/classes/${r.id}`,
    metadata: { grade: r.grade, subject: r.subject },
    score:    r.name.toLowerCase().includes(q.toLowerCase()) ? 2 : 1,
  }))
}

export async function search(
  query: string,
  teacherId: string,
  filters: SearchFilters = {}
): Promise<SearchResponse> {
  const q     = query.trim()
  const limit = Math.min(filters.limit ?? DEFAULT_LIMIT, 50)
  const types = filters.types ?? ['sow', 'lesson_plan', 'assessment', 'learner', 'class']

  if (!q || q.length < 2) {
    return { query, results: [], total: 0, by_type: {} }
  }

  const searches: Promise<SearchResult[]>[] = []
  if (types.includes('sow'))          searches.push(searchSOWs(q, teacherId))
  if (types.includes('lesson_plan'))  searches.push(searchLessonPlans(q, teacherId))
  if (types.includes('assessment'))   searches.push(searchAssessments(q, teacherId))
  if (types.includes('learner'))      searches.push(searchLearners(q, teacherId))
  if (types.includes('class'))        searches.push(searchClasses(q, teacherId))

  const groups = await Promise.all(searches)
  const all    = groups.flat().sort((a, b) => b.score - a.score).slice(0, limit)

  const by_type: Partial<Record<SearchResourceType, number>> = {}
  for (const r of all) {
    by_type[r.type] = (by_type[r.type] ?? 0) + 1
  }

  return { query, results: all, total: all.length, by_type }
}
