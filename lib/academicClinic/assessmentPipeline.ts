// lib/academicClinic/assessmentPipeline.ts
// Shared processing pipeline: assessment scores → adaptive analysis → context save → PDF → notify parent.
// Used by both the teacher-run flow and the parent self-service flow.

import { repos } from '@/lib/repositories'
import { analyzePerformance } from '@/lib/adaptiveLearning'
import { calculateJuniorPathwayAffinity } from '@/lib/pathwayCalculator'
import {
  generateLearningCompassRec,
  generateReport,
  calculateVitals,
  generateActionPlan,
  generateJuniorGuidance,
  formatSubjectName,
} from '@/lib/academicClinic/reportGenerator'
import { buildSeniorGuidanceFromCanonical } from '@/lib/academicClinic/canonicalSeniorGuidance'
import { resolveCanonicalGrowthInput } from '@/lib/academicClinic/canonicalTrajectory'
import { resolveCanonicalCareerMatches } from '@/lib/learnerIntelligence/careerIntelligenceOrchestration'
import { CareerEngine } from '@/lib/academicClinic/careerEngine'
import { adaptCanonicalCareersForClinic } from '@/lib/academicClinic/canonicalCareerAdapter'
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
  studentId:     string
  assessmentId:  string
  actorName:     string
  actorUserId:   string
  notify:        boolean
  teacherId?:    string
  classId?:      string
}

export async function runAssessmentPipeline({
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
      repos.careers.findStudentForPipeline(studentId),
      repos.assessments.findAssessmentForPipeline(assessmentId, studentId),
    ])

    const student    = studentRes
    const assessment = assessmentRes

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
      knowledgeRootCauses = await analyseStudentRootCauses(student.id, student.grade)
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
    await repos.careers.upsertStudentLearningContext({
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
    // additionalCareers still needed for analyzeDreamCareer() inside
    // generateReport() below (Phase 9.1.6/9.1.7) — dream-career analysis
    // remains on the legacy CareerEngine corpus, out of Phase 2.1's scope
    // (Decision 2 covers the primary top-careers list, not this separate
    // feature — see the Phase 2.1 closeout's remaining-limitations section).
    let additionalCareers: import('@/lib/academicClinic/careerEngine').CareerData[] = []
    if (!isJunior) {
      try {
        const canonicalCareers = await repos.careers.getAllCareersWithCOS()
        additionalCareers = adaptCanonicalCareersForClinic(canonicalCareers)
      } catch (err) {
        console.error('[assessmentPipeline] canonical career fetch failed (non-fatal — falls back to CAREER_DATABASE only):', err)
      }
    }
    // Phase 2.1 (Decision 2 — one canonical career-ranking owner): the
    // top-careers list a parent actually sees now comes from
    // resolveCanonicalCareerMatches(), not the legacy CareerEngine. Errors
    // here are non-fatal — the report still generates, with an honest
    // "insufficient evidence" section, same shape as the zero-evidence path.
    let sGuidance: import('./types').SeniorGuidance | undefined
    if (!isJunior) {
      try {
        const canonical = await resolveCanonicalCareerMatches(student.id)
        sGuidance = buildSeniorGuidanceFromCanonical(canonical, subjects, firstName, student.grade)
      } catch (err) {
        console.error('[assessmentPipeline] canonical career match resolution failed (non-fatal — report still generates):', err)
        sGuidance = buildSeniorGuidanceFromCanonical({ matches: [], mode: 'planning', insufficientEvidence: true, generatedAt: null }, subjects, firstName, student.grade)
      }
    }
    // Phase 2.2 (canonical trajectory closure): this is the exact pipeline
    // that previously passed a hardcoded [] for assessment history,
    // structurally preventing 'IMPROVING' from ever being reachable here —
    // trajectory now comes from canonical Projection instead of that raw
    // history array. Non-fatal on error: the report still generates with
    // the legacy no-history-supplied fallback (current-state severity read,
    // no fabricated direction) rather than failing the whole delivery.
    let canonicalGrowth: import('./reportGenerator').CanonicalGrowthInput | null = null
    try {
      canonicalGrowth = await resolveCanonicalGrowthInput(student.id)
    } catch (err) {
      console.error('[assessmentPipeline] canonical growth resolution failed (non-fatal — report still generates):', err)
    }
    const report      = generateReport(studentProfile, subjects, vitals, actionPlan, [], jGuidance, sGuidance, knowledgeRootCauses.length > 0 ? knowledgeRootCauses : undefined, additionalCareers, canonicalGrowth)

    const pdfBlob   = await generateAcademicClinicPDF(report)
    const pdfBuffer = Buffer.from(await pdfBlob.arrayBuffer())

    // Load invite token for magic link
    const invite = await repos.careers.findStudentInviteToken(student.id)

    const signupToken = !student.parent_user_id ? (invite ?? undefined) : undefined

    // Fire notifications in parallel. Each channel keeps its own named
    // promise slot (rather than a conditionally-built array unpacked by
    // position) so a channel that wasn't attempted can never be confused
    // with a different channel's result — the bug this replaced let an
    // untried email get reported as "sent" (and a real WhatsApp send get
    // reported as "not sent") whenever email was the skipped channel,
    // because Promise.allSettled([whatsappJob]) shifted WhatsApp's result
    // into what the old code assumed was always the email slot.
    const parentName = student.parent_first_name ?? 'Parent'

    const emailJob: Promise<{ success: boolean }> | null =
      (student.notification_email && student.parent_email)
        ? sendReportEmail({
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
          })
        : null

    const whatsappJob: Promise<{ success: boolean }> | null =
      (student.notification_whatsapp && student.whatsapp_opted_in && student.parent_phone)
        ? sendReportWhatsApp({
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
          })
        : null

    const [emailResult, whatsappResult] = await Promise.allSettled([
      emailJob    ?? Promise.resolve(null),
      whatsappJob ?? Promise.resolve(null),
    ])

    const emailSent    = emailJob    !== null && emailResult.status    === 'fulfilled' && emailResult.value?.success    === true
    const whatsappSent = whatsappJob !== null && whatsappResult.status === 'fulfilled' && whatsappResult.value?.success === true

    // Persist report record so teacher dashboard can track delivery
    if (teacherId) {
      try {
        await repos.careers.upsertStudentClinicReport({
          student_id:       student.id,
          teacher_id:       teacherId,
          class_id:         classId ?? null,
          assessment_id:    assessment.id,
          term:             assessment.term,
          year:             assessment.year,
          whatsapp_sent_at: whatsappSent ? new Date().toISOString() : null,
          email_sent_at:    emailSent    ? new Date().toISOString() : null,
        })
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
