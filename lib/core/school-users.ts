import { createServiceClient } from '@/utils/supabase/service'
import type { SchoolUser, SchoolUserRole } from '@/types/core'

export async function getSchoolUser(
  userId: string,
  schoolId: string
): Promise<SchoolUser | null> {
  const supabase = createServiceClient()
  const { data } = await supabase
    .from('school_users')
    .select('id, school_id, user_id, role, is_active, invited_by, joined_at, created_at, updated_at')
    .eq('user_id', userId)
    .eq('school_id', schoolId)
    .eq('is_active', true)
    .single()
  return data
}

export async function listSchoolUsers(
  schoolId: string,
  role?: SchoolUserRole
): Promise<SchoolUser[]> {
  const supabase = createServiceClient()
  let query = supabase
    .from('school_users')
    .select('id, school_id, user_id, role, is_active, invited_by, joined_at, created_at, updated_at')
    .eq('school_id', schoolId)
    .order('created_at')
  if (role) query = query.eq('role', role)
  const { data, error } = await query
  if (error) throw new Error(`listSchoolUsers: ${error.message}`)
  return data
}

export async function addSchoolUser(
  schoolId: string,
  userId: string,
  role: SchoolUserRole,
  invitedBy: string
): Promise<SchoolUser> {
  const supabase = createServiceClient()
  const { data, error } = await supabase
    .from('school_users')
    .upsert(
      { school_id: schoolId, user_id: userId, role, is_active: true, invited_by: invitedBy, joined_at: new Date().toISOString() },
      { onConflict: 'school_id,user_id,role' }
    )
    .select('id, school_id, user_id, role, is_active, invited_by, joined_at, created_at, updated_at')
    .single()
  if (error) throw new Error(`addSchoolUser: ${error.message}`)
  return data
}

export async function updateSchoolUserRole(
  schoolUserId: string,
  role: SchoolUserRole
): Promise<SchoolUser> {
  const supabase = createServiceClient()
  const { data, error } = await supabase
    .from('school_users')
    .update({ role })
    .eq('id', schoolUserId)
    .select('id, school_id, user_id, role, is_active, invited_by, joined_at, created_at, updated_at')
    .single()
  if (error) throw new Error(`updateSchoolUserRole: ${error.message}`)
  return data
}

export async function deactivateSchoolUser(schoolUserId: string): Promise<void> {
  const supabase = createServiceClient()
  const { error } = await supabase
    .from('school_users')
    .update({ is_active: false })
    .eq('id', schoolUserId)
  if (error) throw new Error(`deactivateSchoolUser: ${error.message}`)
}

export async function isSchoolAdmin(userId: string, schoolId: string): Promise<boolean> {
  const supabase = createServiceClient()
  const { data } = await supabase
    .from('school_users')
    .select('id')
    .eq('user_id', userId)
    .eq('school_id', schoolId)
    .in('role', ['school_admin', 'headteacher', 'deputy_headteacher'])
    .eq('is_active', true)
    .single()
  return !!data
}

export async function isTeacherInSchool(userId: string, schoolId: string): Promise<boolean> {
  const supabase = createServiceClient()
  const { data } = await supabase
    .from('school_users')
    .select('id')
    .eq('user_id', userId)
    .eq('school_id', schoolId)
    .eq('is_active', true)
    .single()
  return !!data
}
