import { createServiceClient } from '@/utils/supabase/service'

export async function subscribeToNewsletter(email: string): Promise<void> {
  const supabase = createServiceClient()
  const { error } = await supabase
    .from('insights_newsletter_subscribers')
    .upsert({ email, confirmed: false }, { onConflict: 'email', ignoreDuplicates: true })

  if (error) throw new Error(`subscribeToNewsletter: ${error.message}`)
}

export async function getSubscriberCount(): Promise<number> {
  const supabase = createServiceClient()
  const { count, error } = await supabase
    .from('insights_newsletter_subscribers')
    .select('id', { count: 'exact', head: true })

  if (error) return 0
  return count ?? 0
}
