export type InsightStatus = 'draft' | 'scheduled' | 'published' | 'archived'
export type ContentType =
  | 'article'
  | 'research'
  | 'white_paper'
  | 'opinion'
  | 'case_study'
  | 'framework'
  | 'architecture'
  | 'founder_notes'
  | 'engineering'

export type CategoryColor =
  | 'violet' | 'blue' | 'amber' | 'teal' | 'green'
  | 'indigo' | 'pink' | 'orange' | 'cyan' | 'rose'

export type InsightAuthor = {
  id: string
  name: string
  slug: string
  bio: string | null
  title: string | null
  avatar_url: string | null
  social_links: Record<string, string>
}

export type InsightCategory = {
  id: string
  name: string
  slug: string
  description: string | null
  color: CategoryColor
}

export type InsightTag = {
  id: string
  name: string
  slug: string
}

export type InsightSeries = {
  id: string
  title: string
  slug: string
  description: string | null
  cover_image: string | null
}

export type InsightArticle = {
  id: string
  slug: string
  title: string
  subtitle: string | null
  excerpt: string | null
  cover_image: string | null
  reading_time: number
  status: InsightStatus
  featured: boolean
  pinned: boolean
  publish_date: string | null
  view_count: number
  content_type: ContentType
  seo_title: string | null
  seo_description: string | null
  og_image: string | null
  author: InsightAuthor
  category: InsightCategory
  series: InsightSeries | null
  series_order: number | null
  tags: InsightTag[]
  created_at: string
  updated_at: string
}

export type InsightArticleWithContent = InsightArticleCard & {
  content: string | null
}

export type InsightArticleCard = Pick<
  InsightArticle,
  | 'id' | 'slug' | 'title' | 'subtitle' | 'excerpt'
  | 'cover_image' | 'reading_time' | 'publish_date'
  | 'view_count' | 'featured' | 'pinned' | 'status' | 'content_type'
  | 'author' | 'category' | 'series' | 'series_order' | 'tags'
  | 'seo_title' | 'seo_description' | 'og_image'
  | 'created_at' | 'updated_at'
>

export type InsightsListResult = {
  articles: InsightArticleCard[]
  total: number
  page: number
  perPage: number
}

export type SearchResult = InsightArticleCard & {
  rank: number
}
