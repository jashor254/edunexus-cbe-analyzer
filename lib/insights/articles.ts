import { createServiceClient } from '@/utils/supabase/service'
import type {
  InsightArticleCard,
  InsightArticleWithContent,
  InsightsListResult,
} from './types'

const ARTICLE_CARD_COLUMNS = `
  id, slug, title, subtitle, excerpt, cover_image, reading_time,
  status, featured, pinned, publish_date, view_count, content_type,
  seo_title, seo_description, og_image,
  created_at, updated_at,
  author:insights_authors(id, name, slug, bio, title, avatar_url, social_links),
  category:insights_categories(id, name, slug, description, color),
  series:insights_series(id, title, slug, description, cover_image),
  series_order,
  insights_article_tags(tag_id, insights_tags(id, name, slug))
`

function normaliseArticle(raw: Record<string, unknown>): InsightArticleCard {
  const tags = (
    (raw.insights_article_tags as Array<{ insights_tags: unknown }>) ?? []
  ).map((jt) => jt.insights_tags as { id: string; name: string; slug: string })

  return {
    id:              raw.id as string,
    slug:            raw.slug as string,
    title:           raw.title as string,
    subtitle:        raw.subtitle as string | null,
    excerpt:         raw.excerpt as string | null,
    cover_image:     raw.cover_image as string | null,
    reading_time:    raw.reading_time as number,
    status:          raw.status as InsightArticleCard['status'],
    featured:        raw.featured as boolean,
    pinned:          raw.pinned as boolean,
    publish_date:    raw.publish_date as string | null,
    view_count:      raw.view_count as number,
    content_type:    raw.content_type as InsightArticleCard['content_type'],
    author:          raw.author as InsightArticleCard['author'],
    category:        raw.category as InsightArticleCard['category'],
    series:          (raw.series as InsightArticleCard['series']) ?? null,
    series_order:    (raw.series_order as number) ?? null,
    tags,
    seo_title:       (raw.seo_title as string) ?? null,
    seo_description: (raw.seo_description as string) ?? null,
    og_image:        (raw.og_image as string) ?? null,
    created_at:      raw.created_at as string,
    updated_at:      raw.updated_at as string,
  }
}

export async function getFeaturedArticles(): Promise<InsightArticleCard[]> {
  const supabase = createServiceClient()
  const { data, error } = await supabase
    .from('insights_articles')
    .select(ARTICLE_CARD_COLUMNS)
    .eq('status', 'published')
    .lte('publish_date', new Date().toISOString())
    .eq('featured', true)
    .order('publish_date', { ascending: false })
    .limit(3)

  if (error) throw new Error(`getFeaturedArticles: ${error.message}`)
  return (data ?? []).map(normaliseArticle)
}

export async function getLatestArticles(
  page = 1,
  perPage = 9,
  categorySlug?: string,
): Promise<InsightsListResult> {
  const supabase = createServiceClient()

  let query = supabase
    .from('insights_articles')
    .select(ARTICLE_CARD_COLUMNS, { count: 'exact' })
    .eq('status', 'published')
    .lte('publish_date', new Date().toISOString())
    .order('publish_date', { ascending: false })
    .range((page - 1) * perPage, page * perPage - 1)

  if (categorySlug) {
    const { data: cat } = await supabase
      .from('insights_categories')
      .select('id')
      .eq('slug', categorySlug)
      .single()
    if (cat) query = query.eq('category_id', cat.id)
  }

  const { data, error, count } = await query
  if (error) throw new Error(`getLatestArticles: ${error.message}`)

  return {
    articles: (data ?? []).map(normaliseArticle),
    total:    count ?? 0,
    page,
    perPage,
  }
}

export async function getArticleBySlug(
  slug: string,
): Promise<InsightArticleWithContent | null> {
  const supabase = createServiceClient()
  const FULL_COLUMNS = `content, ${ARTICLE_CARD_COLUMNS}`

  const { data, error } = await supabase
    .from('insights_articles')
    .select(FULL_COLUMNS)
    .eq('slug', slug)
    .eq('status', 'published')
    .lte('publish_date', new Date().toISOString())
    .single()

  if (error) return null
  const raw = data as unknown as Record<string, unknown>
  return { ...normaliseArticle(raw), content: raw.content as string | null }
}

export async function getRelatedArticles(
  articleId: string,
  categoryId: string,
  limit = 3,
): Promise<InsightArticleCard[]> {
  const supabase = createServiceClient()
  const { data, error } = await supabase
    .from('insights_articles')
    .select(ARTICLE_CARD_COLUMNS)
    .eq('status', 'published')
    .lte('publish_date', new Date().toISOString())
    .eq('category_id', categoryId)
    .neq('id', articleId)
    .order('publish_date', { ascending: false })
    .limit(limit)

  if (error) throw new Error(`getRelatedArticles: ${error.message}`)
  return (data ?? []).map(normaliseArticle)
}

export async function getMostPopularArticles(
  limit = 6,
): Promise<InsightArticleCard[]> {
  const supabase = createServiceClient()
  const { data, error } = await supabase
    .from('insights_articles')
    .select(ARTICLE_CARD_COLUMNS)
    .eq('status', 'published')
    .lte('publish_date', new Date().toISOString())
    .order('view_count', { ascending: false })
    .limit(limit)

  if (error) throw new Error(`getMostPopularArticles: ${error.message}`)
  return (data ?? []).map(normaliseArticle)
}

export async function incrementViewCount(slug: string): Promise<void> {
  const supabase = createServiceClient()
  await supabase.rpc('increment_insights_view', { article_slug: slug })
}
