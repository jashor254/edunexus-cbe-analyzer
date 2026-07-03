import { repos } from '@/lib/repositories'
import type {
  ClassAssessment,
  LearnerMark,
  AssessmentWithStats,
  AssessmentContext,
  CurriculumType,
} from './types'

export async function getClassAssessments(
  classId: string,
  teacherId: string
): Promise<AssessmentWithStats[]> {
  return repos.assessments.findAssessmentsByClass(classId, teacherId)
}

export async function getTeacherAssessments(
  teacherId: string,
  filters: { term?: string; year?: number } = {}
): Promise<AssessmentWithStats[]> {
  return repos.assessments.findAssessmentsByTeacher(teacherId, filters)
}

export async function getPendingAssessments(
  teacherId: string
): Promise<(AssessmentWithStats & { class_name: string })[]> {
  return repos.assessments.findPendingAssessments(teacherId)
}

export async function getAssessmentById(
  id: string,
  teacherId: string
): Promise<ClassAssessment | null> {
  return repos.assessments.findAssessmentById(id, teacherId)
}

export async function getAssessmentContext(
  assessmentId: string,
  teacherId: string
): Promise<AssessmentContext | null> {
  return repos.assessments.findAssessmentContext(assessmentId, teacherId)
}

export async function getLearnerMarks(
  assessmentId: string,
  teacherId: string
): Promise<LearnerMark[]> {
  return repos.assessments.findMarksByAssessment(assessmentId, teacherId)
}
