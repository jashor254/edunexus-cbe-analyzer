import { repos } from '@/lib/repositories'
import type {
  Learner,
  LearnerWithGuardians,
  LearnerWithEnrollment,
  LearnerGuardian,
  LearnerEnrollment,
  LearnerStatus,
  AdmitLearnerInput,
  EnrollLearnerInput,
} from '@/types/core'

// ── Admission ─────────────────────────────────────────────────────────────────

export async function admitLearner(
  schoolId: string,
  input: AdmitLearnerInput
): Promise<LearnerWithGuardians> {
  const learner = await repos.learners.insert(schoolId, input)

  if (!input.guardian) return { ...learner, learner_guardians: [] }

  const guardian = await repos.learners.insertGuardian(schoolId, learner.id, {
    user_id: null,
    relationship: input.guardian.relationship,
    full_name: input.guardian.full_name,
    phone: input.guardian.phone,
    email: input.guardian.email ?? null,
    national_id: input.guardian.national_id ?? null,
    is_primary: true,
    can_receive_reports: true,
  })

  return { ...learner, learner_guardians: [guardian] }
}

// ── Fetch ─────────────────────────────────────────────────────────────────────

export async function getLearner(learnerId: string, schoolId: string): Promise<LearnerWithGuardians> {
  return repos.learners.findById(learnerId, schoolId)
}

export async function listLearners(
  schoolId: string,
  filters?: { status?: LearnerStatus; classId?: string; termId?: string; search?: string }
): Promise<Learner[]> {
  if (filters?.classId && filters?.termId) {
    const rows = await repos.learners.findEnrollmentByClass(filters.classId, filters.termId)
    return rows.map((r) => r.learners as unknown as Learner)
  }

  return repos.learners.list(schoolId, { status: filters?.status, search: filters?.search })
}

export async function getLearnerHistory(
  learnerId: string,
  schoolId: string
): Promise<LearnerWithEnrollment> {
  return repos.learners.findWithHistory(learnerId, schoolId)
}

// ── Update ────────────────────────────────────────────────────────────────────

export async function updateLearner(
  learnerId: string,
  schoolId: string,
  updates: Partial<Pick<Learner, 'first_name' | 'middle_name' | 'last_name' | 'date_of_birth' | 'gender' | 'upi' | 'photo_url' | 'county_of_origin' | 'special_needs' | 'status' | 'notes' | 'graduation_date'>>
): Promise<Learner> {
  return repos.learners.update(learnerId, schoolId, updates)
}

export async function archiveLearner(learnerId: string, schoolId: string): Promise<void> {
  return repos.learners.updateStatus(learnerId, schoolId, 'archived')
}

// ── Guardians ─────────────────────────────────────────────────────────────────

export async function addGuardian(
  schoolId: string,
  learnerId: string,
  input: Omit<LearnerGuardian, 'id' | 'school_id' | 'learner_id' | 'created_at' | 'updated_at'>
): Promise<LearnerGuardian> {
  return repos.learners.insertGuardian(schoolId, learnerId, input)
}

// ── Enrollments ───────────────────────────────────────────────────────────────

export async function enrollLearner(input: EnrollLearnerInput & { school_id: string }): Promise<LearnerEnrollment> {
  return repos.learners.upsertEnrollment(input)
}

export async function withdrawLearner(learnerId: string, termId: string): Promise<void> {
  return repos.learners.updateEnrollmentStatus(learnerId, termId, 'withdrawn')
}

export async function getClassRoster(classId: string, termId: string): Promise<Learner[]> {
  const rows = await repos.learners.findClassRoster(classId, termId)
  return rows.map((r) => r.learners as unknown as Learner)
}
