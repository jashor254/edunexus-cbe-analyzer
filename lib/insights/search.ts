import { createServiceClient } from '@/utils/supabase/service'
import type { InsightArticleCard } from './types'

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

export async function searchArticles(
  query: string,
  limit = 10,
): Promise<InsightArticleCard[]> {
  if (!query.trim()) return []

  const supabase = createServiceClient()

  const { data, error } = await supabase
    .from('insights_articles')
    .select(`
      id, slug, title, subtitle, excerpt, cover_image, reading_time,
      status, featured, pinned, publish_date, view_count, content_type,
      created_at, updated_at,
      author:insights_authors(id, name, slug, bio, title, avatar_url, social_links),
      category:insights_categories(id, name, slug, description, color),
      series:insights_series(id, title, slug, description, cover_image),
      series_order,
      insights_article_tags(tag_id, insights_tags(id, name, slug))
    `)
    .eq('status', 'published')
    .lte('publish_date', new Date().toISOString())
    .textSearch('search_vector', query, {
      type: 'websearch',
      config: 'english',
    })
    .limit(limit)

  if (error) {
    // Fallback: ilike search if FTS fails
    const { data: fallback, error: fallbackError } = await supabase
      .from('insights_articles')
      .select(`
        id, slug, title, subtitle, excerpt, cover_image, reading_time,
        status, featured, pinned, publish_date, view_count, content_type,
        created_at, updated_at,
        author:insights_authors(id, name, slug, bio, title, avatar_url, social_links),
        category:insights_categories(id, name, slug, description, color),
        series:insights_series(id, title, slug, description, cover_image),
        series_order,
        insights_article_tags(tag_id, insights_tags(id, name, slug))
      `)
      .eq('status', 'published')
      .ilike('title', `%${query}%`)
      .limit(limit)

    if (fallbackError) return []
    return (fallback ?? []).map(normaliseArticle)
  }

  return (data ?? []).map(normaliseArticle)
}
