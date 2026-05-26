import { createServiceClient } from '@/utils/supabase/service'

export async function isAdmin(userId: string): Promise<boolean> {
  const db = createServiceClient()
  const { data } = await db
    .from('teachers')
    .select('role')
    .eq('user_id', userId)
    .single()
  return data?.role === 'admin'
}
