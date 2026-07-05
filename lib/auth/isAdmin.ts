import { repos } from '@/lib/repositories'
import { ADMIN_CONFIG } from '@/lib/config/api'

export async function isAdmin(userId: string, email?: string): Promise<boolean> {
  // Fast path: known admin email
  if (email && ADMIN_CONFIG.isAdmin(email)) return true

  const profile = await repos.teachers.findProfileRole(userId)
  return profile?.role === 'admin'
}
