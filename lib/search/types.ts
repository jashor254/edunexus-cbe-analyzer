export type SearchResourceType =
  | 'sow'
  | 'lesson_plan'
  | 'assessment'
  | 'learner'
  | 'class'
  | 'career'

export type SearchResult = {
  id: string
  type: SearchResourceType
  title: string
  subtitle: string | null
  url: string
  metadata: Record<string, unknown>
  score: number
}

export type SearchResponse = {
  query: string
  results: SearchResult[]
  total: number
  by_type: Partial<Record<SearchResourceType, number>>
}

export type SearchFilters = {
  types?: SearchResourceType[]
  limit?: number
}
