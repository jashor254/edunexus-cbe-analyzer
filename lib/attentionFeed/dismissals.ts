import { createServiceClient } from '@/utils/supabase/service'

export async function getDismissedKeys(teacherId: string): Promise<Set<string>> {
  const db = createServiceClient()
  const { data, error } = await db
    .from('attention_feed_dismissals')
    .select('item_key')
    .eq('teacher_id', teacherId)

  if (error) throw new Error(`Failed to fetch dismissed attention items: ${error.message}`)
  return new Set((data ?? []).map((d) => d.item_key as string))
}

export async function dismissAttentionItem(teacherId: string, itemKey: string): Promise<void> {
  const db = createServiceClient()
  const { error } = await db
    .from('attention_feed_dismissals')
    .upsert(
      { teacher_id: teacherId, item_key: itemKey, dismissed_at: new Date().toISOString() },
      { onConflict: 'teacher_id,item_key' },
    )

  if (error) throw new Error(`Failed to dismiss attention item: ${error.message}`)
}
