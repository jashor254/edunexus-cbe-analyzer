import { createServiceClient } from '@/utils/supabase/service'
import type { InsightCategory } from './types'

export async function getAllCategories(): Promise<InsightCategory[]> {
  const supabase = createServiceClient()
  const { data, error } = await supabase
    .from('insights_categories')
    .select('id, name, slug, description, color')
    .order('name', { ascending: true })

  if (error) throw new Error(`getAllCategories: ${error.message}`)
  return (data ?? []) as InsightCategory[]
}

export async function getCategoryBySlug(
  slug: string,
): Promise<InsightCategory | null> {
  const supabase = createServiceClient()
  const { data, error } = await supabase
    .from('insights_categories')
    .select('id, name, slug, description, color')
    .eq('slug', slug)
    .single()

  if (error) return null
  return data as InsightCategory
}

export async function getCategoriesWithCount(): Promise<
  (InsightCategory & { article_count: number })[]
> {
  const supabase = createServiceClient()
  const { data, error } = await supabase
    .from('insights_categories')
    .select(
      'id, name, slug, description, color, insights_articles(count)',
    )
    .order('name', { ascending: true })

  if (error) throw new Error(`getCategoriesWithCount: ${error.message}`)

  return (data ?? []).map((row) => ({
    id:            row.id,
    name:          row.name,
    slug:          row.slug,
    description:   row.description,
    color:         row.color as InsightCategory['color'],
    article_count: Array.isArray(row.insights_articles)
      ? (row.insights_articles[0] as { count: number })?.count ?? 0
      : 0,
  }))
}
