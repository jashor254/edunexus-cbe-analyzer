import { repos } from '@/lib/repositories'

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
  let join_code = generateJoinCode()

  // Re-roll on collision (astronomically unlikely with 6-char alphanumeric)
  const existing = await repos.academy.findCohortByJoinCode(join_code)
  if (existing) join_code = generateJoinCode()

  const data = await repos.academy.insertCohort({ name, school, join_code, lead_teacher_id: teacherId })

  // Lead teacher is automatically a member
  await repos.academy.upsertCohortMember(data.id, teacherId)

  return data as Cohort
}

export async function joinCohortByCode(teacherId: string, code: string): Promise<Cohort> {
  const cohort = await repos.academy.findCohortByCode(code.toUpperCase().trim())
  if (!cohort) throw new Error('Invalid join code — no cohort found')

  await repos.academy.upsertCohortMember(cohort.id, teacherId)

  return cohort as Cohort
}

export async function getTeacherCohorts(teacherId: string): Promise<Cohort[]> {
  const cohortIds = await repos.academy.findCohortIdsByTeacher(teacherId)
  if (!cohortIds.length) return []

  const data = await repos.academy.findCohortsByIds(cohortIds)
  return data as Cohort[]
}

export async function getCohortDetail(cohortId: string, teacherId: string): Promise<CohortDetail | null> {
  // Verify requestor is a member or lead
  const membership = await repos.academy.findCohortMembership(cohortId, teacherId)
  if (!membership) return null

  const cohort = await repos.academy.findCohortById(cohortId)
  if (!cohort) return null

  // Get all members
  const members = await repos.academy.findCohortMembers(cohortId)
  if (!members.length) return { ...(cohort as Cohort), members: [], totalMembers: 0 }

  const memberTeacherIds = members.map(m => m.teacher_id)

  // Batch-fetch teacher profiles + XP + lesson progress in parallel
  const [teachers, xpRows, progressRows] = await Promise.all([
    repos.academy.findTeacherProfiles(memberTeacherIds),
    repos.academy.findXpByTeacherIds(memberTeacherIds),
    repos.academy.findProgressByTeacherIds(memberTeacherIds),
  ])

  const teacherMap = new Map(teachers.map(t => [t.id, t]))

  // Sum XP per teacher
  const xpByTeacher = new Map<string, number>()
  for (const row of xpRows) {
    xpByTeacher.set(row.teacher_id, (xpByTeacher.get(row.teacher_id) ?? 0) + row.xp)
  }

  // Count completed lessons per teacher
  const lessonsBy = new Map<string, number>()
  for (const row of progressRows) {
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
  const cohort = await repos.academy.findCohortById(cohortId)

  if (cohort?.lead_teacher_id === teacherId) {
    throw new Error('Lead teacher cannot leave their own cohort — delete it instead')
  }

  await repos.academy.deleteCohortMember(cohortId, teacherId)
}
