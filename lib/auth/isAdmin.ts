import { createServiceClient } from '@/utils/supabase/service'
import { ADMIN_CONFIG } from '@/lib/config/api'

export async function isAdmin(userId: string, email?: string): Promise<boolean> {
  // Fast path: known admin email
  if (email && ADMIN_CONFIG.isAdmin(email)) return true

  const db = createServiceClient()
  const { data } = await db
    .from('profiles')
    .select('role')
    .eq('id', userId)
    .single()
  return data?.role === 'admin'
}
