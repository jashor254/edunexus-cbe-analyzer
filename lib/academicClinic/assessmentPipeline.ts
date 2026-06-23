// lib/academicClinic/assessmentPipeline.ts
// Shared processing pipeline: assessment scores → adaptive analysis → context save → PDF → notify parent.
// Used by both the teacher-run flow and the parent self-service flow.

import type { createServiceClient } from '@/utils/supabase/service'
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
import { analyseStudentRootCauses } from '@/lib/knowledgeGraph'
import type { RootCauseResult } from '@/lib/knowledgeGraph'
import { sendReportEmail } from '@/lib/email/reportEmail'
import { sendReportWhatsApp } from '@/lib/whatsapp/reportNotify'

// Maps senior CBC subject keys → junior-equivalent keys that the career engine understands.
// biology/chemistry/physics all feed into integrated_science (best score wins so top performers
// get credit). core/essential_mathematics → mathematics. kiswahili_ksl → kiswahili.
function normalizeSeniorScores(scores: Record<string, number>): Record<string, number> {
  const out: Record<string, number> = { ...scores }

  // Kiswahili
  if (out.kiswahili_ksl !== undefined && out.kiswahili === undefined) {
    out.kiswahili = out.kiswahili_ksl
  }

  // Mathematics
  if (out.core_mathematics !== undefined && out.mathematics === undefined) {
    out.mathematics = out.core_mathematics
  } else if (out.essential_mathematics !== undefined && out.mathematics === undefined) {
    out.mathematics = out.essential_mathematics
  }

  // Sciences — use best of biology/chemistry/physics as integrated_science proxy
  const sciences = [out.biology, out.chemistry, out.physics].filter((v): v is number => v !== undefined)
  if (sciences.length > 0 && out.integrated_science === undefined) {
    out.integrated_science = Math.max(...sciences)
  }

  return out
}

export type AssessmentPipelineResult = {
  student_id:   string
  student_name: string
  status:       'ok' | 'error'
  error?:       string
  emailSent?:   boolean
  whatsappSent?: boolean
}

export type RunAssessmentPipelineParams = {
  db:            ReturnType<typeof createServiceClient>
  studentId:     string
  assessmentId:  string
  actorName:     string
  actorUserId:   string
  notify:        boolean
  teacherId?:    string
  classId?:      string
}

export async function runAssessmentPipeline({
  db,
  studentId,
  assessmentId,
  actorName,
  actorUserId,
  notify,
  teacherId,
  classId,
}: RunAssessmentPipelineParams): Promise<AssessmentPipelineResult> {
  try {
    // Load student + assessment
    const [studentRes, assessmentRes] = await Promise.all([
      db.from('students')
        .select('id, name, grade, curriculum_type, school, current_pathway, parent_email, parent_phone, parent_first_name, parent_user_id, notification_email, notification_whatsapp, whatsapp_opted_in')
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

    // Knowledge graph — root cause analysis (non-blocking, requires strand_assessments data)
    let knowledgeRootCauses: RootCauseResult[] = []
    try {
      knowledgeRootCauses = await analyseStudentRootCauses(db, student.id, student.grade)
    } catch (err) {
      console.error('[assessmentPipeline] knowledge graph traversal failed (non-fatal):', err)
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
          cbcScores:        normalizeSeniorScores(scores),
          curriculumType:   (student.curriculum_type ?? 'cbc') as 'cbc' | 'igcse',
          performanceTier:  perfTier,
          enrichWithRealTime: false,
        })
        compassBridge = careerResult.compassBridge
      } catch (err) {
        console.error('[assessmentPipeline] career engine failed (non-fatal):', err)
      }
    }

    // Derive Compass start topic from deepest knowledge-graph root cause when available
    const graphDerivedTopic = knowledgeRootCauses.length > 0
      ? (() => {
          // Pick the failing topic with the biggest performance gap
          const topFailing = [...knowledgeRootCauses].sort((a, b) => (b.performance ? 3 - b.performance : 3) - (a.performance ? 3 - a.performance : 3))[0]
          // Use the deepest root cause (highest depth) so Compass starts at the true foundation
          const deepestCause = topFailing.root_causes.slice().sort((a, b) => b.depth - a.depth)[0]
          return deepestCause ?? null
        })()
      : null

    const graphGuidedTopics = graphDerivedTopic
      ? knowledgeRootCauses.flatMap(r => r.root_causes.slice(0, 2).map(c => c.name)).slice(0, 4)
      : null

    const graphSessionGoal = graphDerivedTopic
      ? `Resolve foundational gap in "${graphDerivedTopic.name}" (${graphDerivedTopic.strand}) to unblock downstream topics`
      : null

    // Save to student_learning_context
    await db.from('student_learning_context').upsert({
      student_id:          student.id,
      user_id:             actorUserId,
      overall_tier:        adaptiveAnalysis.overallTier,
      subject_tiers:       subjectTiers,
      subject_action_steps: subjectActionSteps,
      recommended_pathway: recommendedPathway,
      pathway_confidence:  pathwayConfidence,
      pathway_scores:      pathwayScores,
      first_subject:       compassBridge?.subjectPriorities[0]?.subject ?? compassRec.firstSessionSubject,
      session_goal:        graphSessionGoal ?? compassBridge?.sessionGoal ?? compassRec.sessionGoal,
      guided_topics:       graphGuidedTopics ?? compassBridge?.guidedTopics ?? compassRec.topicsToAsk,
      compass_bridge:      compassBridge,
      overall_level:       Math.round(subjects.reduce((s, sub) => s + sub.level, 0) / Math.max(subjects.length, 1)),
      curriculum_type:     student.curriculum_type ?? 'cbc',
      grade:               student.grade,
      last_assessment_id:  assessment.id,
      knowledge_root_causes:       knowledgeRootCauses.length > 0 ? knowledgeRootCauses : null,
      knowledge_graph_computed_at: knowledgeRootCauses.length > 0 ? new Date().toISOString() : null,
    }, { onConflict: 'student_id' })

    if (!notify) {
      return { student_id: student.id, student_name: student.name, status: 'ok' }
    }

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
    const sGuidance   = !isJunior ? generateSeniorGuidance(subjects, firstName, student.grade, (student as { current_pathway?: string | null }).current_pathway ?? undefined) : undefined
    const report      = generateReport(studentProfile, subjects, vitals, actionPlan, [], jGuidance, sGuidance, knowledgeRootCauses.length > 0 ? knowledgeRootCauses : undefined)

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
        userId:      actorUserId,
      }))
    }

    if (student.notification_whatsapp && student.whatsapp_opted_in && student.parent_phone) {
      notifyJobs.push(sendReportWhatsApp({
        studentId:   student.id,
        parentPhone: student.parent_phone,
        parentName,
        studentName: student.name,
        teacherName: actorName,
        grade:       student.grade,
        term:        assessment.term,
        year:        assessment.year,
        signupToken,
        userId:      actorUserId,
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
    console.error('[assessmentPipeline]', studentId, message)
    return { student_id: studentId, student_name: '?', status: 'error', error: message }
  }
}
