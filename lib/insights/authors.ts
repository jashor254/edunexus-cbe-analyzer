import { createServiceClient } from '@/utils/supabase/service'
import type { InsightAuthor } from './types'

export async function getAuthorBySlug(
  slug: string,
): Promise<InsightAuthor | null> {
  const supabase = createServiceClient()
  const { data, error } = await supabase
    .from('insights_authors')
    .select('id, name, slug, bio, title, avatar_url, social_links')
    .eq('slug', slug)
    .single()

  if (error) return null
  return data as InsightAuthor
}

export async function getAllAuthors(): Promise<InsightAuthor[]> {
  const supabase = createServiceClient()
  const { data, error } = await supabase
    .from('insights_authors')
    .select('id, name, slug, bio, title, avatar_url, social_links')
    .order('name', { ascending: true })

  if (error) throw new Error(`getAllAuthors: ${error.message}`)
  return (data ?? []) as InsightAuthor[]
}
