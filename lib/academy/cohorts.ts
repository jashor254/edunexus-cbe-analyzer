import { createServiceClient } from '@/utils/supabase/service'

export type Cohort = {
  id: string
  name: string
  school: string | null
  join_code: string
  lead_teacher_id: string
  created_at: string
}

export type CohortMemberSummary = {
  teacher_id: string
  full_name: string | null
  school: string | null
  completedLessons: number
  totalXp: number
  isLead: boolean
  joined_at: string
}

export type CohortDetail = Cohort & {
  members: CohortMemberSummary[]
  totalMembers: number
}

// Generate a readable 6-char join code (uppercase, no ambiguous chars)
function generateJoinCode(): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'
  return Array.from({ length: 6 }, () => chars[Math.floor(Math.random() * chars.length)]).join('')
}

export async function createCohort(
  teacherId: string,
  name: string,
  school: string | null,
): Promise<Cohort> {
  const db = createServiceClient()

  let join_code = generateJoinCode()

  // Re-roll on collision (astronomically unlikely with 6-char alphanumeric)
  const { data: existing } = await db
    .from('academy_cohorts')
    .select('id')
    .eq('join_code', join_code)
    .maybeSingle()

  if (existing) join_code = generateJoinCode()

  const { data, error } = await db
    .from('academy_cohorts')
    .insert({ name, school, join_code, lead_teacher_id: teacherId })
    .select('id, name, school, join_code, lead_teacher_id, created_at')
    .single()

  if (error || !data) throw new Error(error?.message ?? 'Failed to create cohort')

  // Lead teacher is automatically a member
  await db.from('academy_cohort_members').insert({ cohort_id: data.id, teacher_id: teacherId })

  return data as Cohort
}

export async function joinCohortByCode(teacherId: string, code: string): Promise<Cohort> {
  const db = createServiceClient()

  const { data: cohort, error: findErr } = await db
    .from('academy_cohorts')
    .select('id, name, school, join_code, lead_teacher_id, created_at')
    .eq('join_code', code.toUpperCase().trim())
    .maybeSingle()

  if (findErr || !cohort) throw new Error('Invalid join code — no cohort found')

  const { error: joinErr } = await db
    .from('academy_cohort_members')
    .upsert({ cohort_id: cohort.id, teacher_id: teacherId }, { onConflict: 'cohort_id,teacher_id' })

  if (joinErr) throw new Error(joinErr.message)

  return cohort as Cohort
}

export async function getTeacherCohorts(teacherId: string): Promise<Cohort[]> {
  const db = createServiceClient()

  const { data: memberships } = await db
    .from('academy_cohort_members')
    .select('cohort_id')
    .eq('teacher_id', teacherId)

  if (!memberships?.length) return []

  const cohortIds = memberships.map(m => m.cohort_id)

  const { data } = await db
    .from('academy_cohorts')
    .select('id, name, school, join_code, lead_teacher_id, created_at')
    .in('id', cohortIds)
    .order('created_at', { ascending: false })

  return (data ?? []) as Cohort[]
}

export async function getCohortDetail(cohortId: string, teacherId: string): Promise<CohortDetail | null> {
  const db = createServiceClient()

  // Verify requestor is a member or lead
  const { data: membership } = await db
    .from('academy_cohort_members')
    .select('id')
    .eq('cohort_id', cohortId)
    .eq('teacher_id', teacherId)
    .maybeSingle()

  if (!membership) return null

  const { data: cohort } = await db
    .from('academy_cohorts')
    .select('id, name, school, join_code, lead_teacher_id, created_at')
    .eq('id', cohortId)
    .single()

  if (!cohort) return null

  // Get all members
  const { data: members } = await db
    .from('academy_cohort_members')
    .select('teacher_id, joined_at')
    .eq('cohort_id', cohortId)

  if (!members?.length) return { ...(cohort as Cohort), members: [], totalMembers: 0 }

  const memberTeacherIds = members.map(m => m.teacher_id)

  // Batch-fetch teacher profiles + XP + lesson progress in parallel
  const [teacherRes, xpRes, progressRes] = await Promise.all([
    db.from('teachers').select('id, full_name, school').in('id', memberTeacherIds),
    db.from('academy_xp_events').select('teacher_id, xp').in('teacher_id', memberTeacherIds),
    db.from('academy_progress').select('teacher_id').in('teacher_id', memberTeacherIds),
  ])

  const teacherMap = new Map((teacherRes.data ?? []).map(t => [t.id, t]))

  // Sum XP per teacher
  const xpByTeacher = new Map<string, number>()
  for (const row of (xpRes.data ?? [])) {
    xpByTeacher.set(row.teacher_id, (xpByTeacher.get(row.teacher_id) ?? 0) + row.xp)
  }

  // Count completed lessons per teacher
  const lessonsBy = new Map<string, number>()
  for (const row of (progressRes.data ?? [])) {
    lessonsBy.set(row.teacher_id, (lessonsBy.get(row.teacher_id) ?? 0) + 1)
  }

  const joinedAtMap = new Map(members.map(m => [m.teacher_id, m.joined_at]))

  const memberSummaries: CohortMemberSummary[] = memberTeacherIds.map(tid => {
    const t = teacherMap.get(tid)
    return {
      teacher_id:       tid,
      full_name:        t?.full_name ?? null,
      school:           t?.school    ?? null,
      completedLessons: lessonsBy.get(tid) ?? 0,
      totalXp:          xpByTeacher.get(tid) ?? 0,
      isLead:           cohort.lead_teacher_id === tid,
      joined_at:        joinedAtMap.get(tid) ?? '',
    }
  }).sort((a, b) => b.totalXp - a.totalXp)

  return {
    ...(cohort as Cohort),
    members:      memberSummaries,
    totalMembers: memberSummaries.length,
  }
}

export async function leaveCohort(cohortId: string, teacherId: string): Promise<void> {
  const db = createServiceClient()

  const { data: cohort } = await db
    .from('academy_cohorts')
    .select('lead_teacher_id')
    .eq('id', cohortId)
    .single()

  if (cohort?.lead_teacher_id === teacherId) {
    throw new Error('Lead teacher cannot leave their own cohort — delete it instead')
  }

  await db
    .from('academy_cohort_members')
    .delete()
    .eq('cohort_id', cohortId)
    .eq('teacher_id', teacherId)
}
