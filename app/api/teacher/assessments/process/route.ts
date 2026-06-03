// app/api/teacher/assessments/process/route.ts
// Processing pipeline: assessment scores → adaptive analysis → context save → PDF → notify parent.
// Accepts { assessment_id, student_id } for single or { class_id, assessment_id } for bulk.

import { z } from 'zod'
import { createClient } from '@/utils/supabase/server'
import { createServiceClient } from '@/utils/supabase/service'
import {
  apiSuccess, apiError, apiUnauthorized, apiForbidden, apiBadRequest,
} from '@/lib/api/response'
import { analyzePerformance } from '@/lib/adaptiveLearning'
import { calculateJuniorPathwayAffinity } from '@/lib/pathwayCalculator'
import {
  generateLearningCompassRec,
  generateReport,
  calculateVitals,
  generateActionPlan,
  generateJuniorGuidance,
  generateSeniorGuidance,
  formatSubjectName,
} from '@/lib/academicClinic/reportGenerator'
import { CareerEngine } from '@/lib/academicClinic/careerEngine'
import { generateAcademicClinicPDF } from '@/lib/academicClinic/pdfGenerator'
import type { SubjectProgress, StudentProfile } from '@/lib/academicClinic/types'
import { sendReportEmail } from '@/lib/email/reportEmail'
import { sendReportWhatsApp } from '@/lib/whatsapp/reportNotify'

const BodySchema = z.union([
  z.object({
    assessment_id: z.string().uuid(),
    student_id:    z.string().uuid(),
    class_id:      z.string().uuid().optional(),
  }),
  z.object({
    assessment_id: z.string().uuid(),
    class_id:      z.string().uuid(),
    student_id:    z.string().uuid().optional(),
  }),
])

type ProcessResult = {
  student_id:   string
  student_name: string
  status:       'ok' | 'error'
  error?:       string
  emailSent?:   boolean
  whatsappSent?: boolean
}

async function processOne(
  db:           ReturnType<typeof createServiceClient>,
  studentId:    string,
  assessmentId: string,
  teacherName:  string,
  teacherUserId: string,
  teacherId?:   string,
  classId?:     string,
): Promise<ProcessResult> {
  try {
    // Load student + assessment
    const [studentRes, assessmentRes] = await Promise.all([
      db.from('students')
        .select('id, name, grade, curriculum_type, school, parent_email, parent_phone, parent_first_name, parent_user_id, notification_email, notification_whatsapp, whatsapp_opted_in')
        .eq('id', studentId)
        .single(),
      db.from('assessments')
        .select('id, term, year, subject_scores, created_at')
        .eq('id', assessmentId)
        .eq('student_id', studentId)
        .single(),
    ])

    const student    = studentRes.data
    const assessment = assessmentRes.data

    if (!student)    return { student_id: studentId, student_name: '?', status: 'error', error: 'Student not found' }
    if (!assessment) return { student_id: studentId, student_name: student.name, status: 'error', error: 'Assessment not found or does not belong to student' }

    const scores = assessment.subject_scores as Record<string, number>

    // Build SubjectProgress array
    const subjects: SubjectProgress[] = Object.entries(scores).map(([key, score]) => ({
      subject:        key,
      displayName:    formatSubjectName(key),
      level:          Math.max(1, Math.min(4, Math.round(score))) as 1 | 2 | 3 | 4,
      trend:          'stable' as const,
      velocity:       0,
      previousScores: [],
    }))

    // Run adaptive analysis
    const adaptiveAnalysis = analyzePerformance(scores)
    const subjectTiers: Record<string, string>     = {}
    const subjectActionSteps: Record<string, string[]> = {}
    adaptiveAnalysis.recommendations.forEach(rec => {
      subjectTiers[rec.subject]       = rec.tier
      subjectActionSteps[rec.subject] = rec.actionSteps
    })

    // Pathway (Junior: grade 7-9)
    const isJunior = student.grade >= 7 && student.grade <= 9
    let recommendedPathway: string | null = null
    let pathwayConfidence: string | null  = null
    let pathwayScores: Record<string, number> = {}

    if (isJunior) {
      const pathwayRec = calculateJuniorPathwayAffinity(scores)
      recommendedPathway = pathwayRec.top_pathway ?? null
      pathwayConfidence  = pathwayRec.confidence   ?? null
      pathwayScores = {
        STEM:               pathwayRec.stem_score,
        'Social Sciences':  pathwayRec.social_sciences_score,
        'Arts & Sports':    pathwayRec.arts_sports_score,
      }
    }

    // Compass rec
    const compassRec = generateLearningCompassRec(subjects)

    // Career engine — seniors only, non-blocking
    let compassBridge = null
    const isSenior = student.grade >= 10
    if (isSenior) {
      try {
        const engine = new CareerEngine()
        const allVals = Object.values(scores)
        const cbcAvg = allVals.reduce((a, b) => a + b, 0) / Math.max(allVals.length, 1)
        const perfTier: 'high' | 'mid' | 'low' = cbcAvg >= 3.0 ? 'high' : cbcAvg >= 2.0 ? 'mid' : 'low'
        const careerResult = await engine.analyze({
          studentId:        student.id,
          studentName:      student.name,
          grade:            student.grade,
          cbcScores:        scores,
          curriculumType:   (student.curriculum_type ?? 'cbc') as 'cbc' | 'igcse',
          performanceTier:  perfTier,
          enrichWithRealTime: false,
        })
        compassBridge = careerResult.compassBridge
      } catch (err) {
        console.error('[process] career engine failed (non-fatal):', err)
      }
    }

    // Save to student_learning_context
    await db.from('student_learning_context').upsert({
      student_id:          student.id,
      user_id:             teacherUserId,
      overall_tier:        adaptiveAnalysis.overallTier,
      subject_tiers:       subjectTiers,
      subject_action_steps: subjectActionSteps,
      recommended_pathway: recommendedPathway,
      pathway_confidence:  pathwayConfidence,
      pathway_scores:      pathwayScores,
      first_subject:       compassBridge?.subjectPriorities[0]?.subject ?? compassRec.firstSessionSubject,
      session_goal:        compassBridge?.sessionGoal ?? compassRec.sessionGoal,
      guided_topics:       compassBridge?.guidedTopics ?? compassRec.topicsToAsk,
      compass_bridge:      compassBridge,
      overall_level:       Math.round(subjects.reduce((s, sub) => s + sub.level, 0) / Math.max(subjects.length, 1)),
      curriculum_type:     student.curriculum_type ?? 'cbc',
      grade:               student.grade,
      last_assessment_id:  assessment.id,
    }, { onConflict: 'student_id' })

    // Generate PDF report
    const studentProfile: StudentProfile = {
      id:    student.id,
      name:  student.name,
      grade: student.grade,
      level: isJunior ? 'Junior School' : 'Senior School',
      term:  assessment.term,
      year:  assessment.year,
      school: student.school ?? undefined,
    }

    const vitals      = calculateVitals(subjects)
    const actionPlan  = generateActionPlan(subjects)
    const firstName   = student.name.split(' ')[0]
    const jGuidance   = isJunior  ? generateJuniorGuidance(subjects)           : undefined
    const sGuidance   = !isJunior ? generateSeniorGuidance(subjects, firstName, student.grade) : undefined
    const report      = generateReport(studentProfile, subjects, vitals, actionPlan, [], jGuidance, sGuidance)

    const pdfBlob   = await generateAcademicClinicPDF(report)
    const pdfBuffer = Buffer.from(await pdfBlob.arrayBuffer())

    // Load invite token for magic link
    const { data: invite } = await db
      .from('student_invites')
      .select('token')
      .eq('student_id', student.id)
      .is('used_at', null)
      .gt('expires_at', new Date().toISOString())
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle()

    const signupToken = !student.parent_user_id ? (invite?.token ?? undefined) : undefined

    // Fire notifications in parallel
    const parentName = student.parent_first_name ?? 'Parent'
    const notifyJobs: Promise<{ success: boolean }>[] = []

    if (student.notification_email && student.parent_email) {
      notifyJobs.push(sendReportEmail({
        studentId:   student.id,
        parentEmail: student.parent_email,
        parentName,
        studentName: student.name,
        grade:       student.grade,
        term:        assessment.term,
        year:        assessment.year,
        pdfBuffer,
        signupToken,
        userId:      teacherUserId,
      }))
    }

    if (student.notification_whatsapp && student.whatsapp_opted_in && student.parent_phone) {
      notifyJobs.push(sendReportWhatsApp({
        studentId:   student.id,
        parentPhone: student.parent_phone,
        parentName,
        studentName: student.name,
        teacherName,
        grade:       student.grade,
        term:        assessment.term,
        year:        assessment.year,
        signupToken,
        userId:      teacherUserId,
      }))
    }

    const [emailResult, whatsappResult] = await Promise.allSettled(notifyJobs)

    const emailSent    = student.parent_email ? (emailResult?.status === 'fulfilled' && emailResult.value.success) : false
    const whatsappSent = student.parent_phone ? (whatsappResult?.status === 'fulfilled' && whatsappResult.value.success) : false

    // Persist report record so teacher dashboard can track delivery
    if (teacherId) {
      try {
        await db.from('student_clinic_reports').upsert({
          student_id:       student.id,
          teacher_id:       teacherId,
          class_id:         classId ?? null,
          assessment_id:    assessment.id,
          term:             assessment.term,
          year:             assessment.year,
          whatsapp_sent_at: whatsappSent ? new Date().toISOString() : null,
          email_sent_at:    emailSent    ? new Date().toISOString() : null,
        }, { onConflict: 'student_id,assessment_id' })
      } catch { /* non-fatal — report record failure doesn't block the response */ }
    }

    return {
      student_id:    student.id,
      student_name:  student.name,
      status:        'ok',
      emailSent:     student.parent_email ? emailSent : undefined,
      whatsappSent:  student.parent_phone ? whatsappSent : undefined,
    }
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    console.error('[process pipeline]', studentId, message)
    return { student_id: studentId, student_name: '?', status: 'error', error: message }
  }
}

export async function POST(req: Request) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return apiUnauthorized()

    const db = createServiceClient()

    const { data: teacher } = await db
      .from('teachers')
      .select('id, full_name')
      .eq('user_id', user.id)
      .single()
    if (!teacher) return apiForbidden()

    const parsed = BodySchema.safeParse(await req.json())
    if (!parsed.success) {
      return apiBadRequest(parsed.error.issues.map(i => i.message).join(', '))
    }

    const { assessment_id, student_id, class_id } = parsed.data as {
      assessment_id: string
      student_id?: string
      class_id?: string
    }

    const teacherName = teacher.full_name ?? 'Your Teacher'

    let studentIds: string[] = []

    if (student_id) {
      // Single student
      studentIds = [student_id]
    } else if (class_id) {
      // Verify class belongs to teacher, get all students
      const { data: cls } = await db
        .from('teacher_classes')
        .select('id')
        .eq('id', class_id)
        .eq('teacher_id', teacher.id)
        .single()
      if (!cls) return apiForbidden()

      const { data: links } = await db
        .from('class_students')
        .select('student_id')
        .eq('class_id', class_id)

      studentIds = (links ?? []).map((l: { student_id: string }) => l.student_id)
    }

    if (studentIds.length === 0) {
      return apiBadRequest('No students found to process')
    }

    // Process all students (sequential to avoid overwhelming PDF renderer + Resend rate limits)
    const results: ProcessResult[] = []
    for (const sid of studentIds) {
      const result = await processOne(db, sid, assessment_id, teacherName, user.id, teacher.id, class_id)
      results.push(result)
    }

    const processed = results.filter(r => r.status === 'ok').length
    const failed    = results.filter(r => r.status === 'error').length

    return apiSuccess({ processed, failed, results })
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e)
    console.error('[teacher/assessments/process POST]', msg)
    return apiError('Internal server error')
  }
}
