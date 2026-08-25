// lib/academicClinic/clinicPdfHandler.ts
//
// Single trusted security/commercial boundary for generating the paid
// Academic Clinic PDF (`clinic_report`). Every route that produces this PDF
// must delegate here — do not re-implement ownership, entitlement, or token
// logic in a route file. This closes the P0 found in the Learner Report
// Architecture audit: a second route (`/api/academic-clinic/pdf`) used to
// accept a client-supplied, pre-built report and skip ownership,
// `checkFeatureAccess('clinic_report')`, and token deduction entirely.
import { NextResponse } from 'next/server'
import { createServiceClient } from '@/utils/supabase/service'
import { checkFeatureAccess, deductFeatureTokens } from '@/lib/payments/access'
import { repos } from '@/lib/repositories'
import { adaptCanonicalCareersForClinic } from '@/lib/academicClinic/canonicalCareerAdapter'
import {
  generateReport,
  calculateVitals,
  generateActionPlan,
  generateJuniorGuidance,
  formatSubjectName,
} from '@/lib/academicClinic/reportGenerator'
import { buildSeniorGuidanceFromCanonical } from '@/lib/academicClinic/canonicalSeniorGuidance'
import { resolveCanonicalGrowthInput } from '@/lib/academicClinic/canonicalTrajectory'
import { resolveCanonicalCareerMatches } from '@/lib/learnerIntelligence/careerIntelligenceOrchestration'
import { generateAcademicClinicPDF } from '@/lib/academicClinic/pdfGenerator'
import type {
  SubjectProgress,
  StudentProfile,
  SeniorGuidance,
} from '@/lib/academicClinic/reportGenerator'
import { resolveLevel } from '@/lib/assessments/gradeCalculator'
import type { CBCLevel } from '@/lib/assessments/gradeCalculator'

export async function handleClinicPdfDownload(req: Request): Promise<NextResponse> {
  try {
    // ── 1. Check access — admin bypass, teacher tier, subscription, OR token balance ──
    const access = await checkFeatureAccess('clinic_report')
    if (access.allowed === false) {
      return NextResponse.json(
        {
          error: access.reason === 'unauthenticated'
            ? 'Unauthorized'
            : 'No active subscription or tokens. Please upgrade.',
        },
        { status: access.reason === 'unauthenticated' ? 401 : 403 }
      )
    }

    // ── 2. Parse request body ────────────────────────────────────────────────
    const { studentId, assessments, profile } = await req.json()

    if (!studentId || !assessments || !profile) {
      return NextResponse.json(
        { error: 'Missing required fields: studentId, assessments, profile' },
        { status: 400 }
      )
    }

    // ── 3. Verify student belongs to user (security check) ───────────────────
    const db = createServiceClient()

    const { data: student, error: studentError } = await db
      .from('students')
      .select('id, user_id, name, grade, school, current_pathway')
      .eq('id', studentId)
      .eq('user_id', access.userId)
      .single()

    if (studentError || !student) {
      return NextResponse.json(
        { error: 'Student not found or access denied' },
        { status: 404 }
      )
    }

    // ── 4. Build subject progress from assessments ───────────────────────────
    const latestAssessment  = assessments[assessments.length - 1]

    // Resolve teacher-wins per subject for the latest term/year
    const teacherAss = assessments.find((a: any) =>
      a.source === 'teacher' && a.term === latestAssessment?.term && a.year === latestAssessment?.year
    )
    const baseScores: Record<string, number> = latestAssessment?.subject_scores || {}
    const currentScores: Record<string, number> = teacherAss
      ? Object.fromEntries(
          Object.entries(baseScores).map(([subj, parentLevel]) => {
            const teacherLevel = (teacherAss.subject_scores as Record<string, number>)?.[subj] ?? null
            const resolved = resolveLevel(teacherLevel as CBCLevel | null, parentLevel as CBCLevel | null)
            return [subj, resolved?.level ?? parentLevel]
          })
        )
      : baseScores

    const subjectProgress: SubjectProgress[] = Object.keys(currentScores).map(subject => {
      const scores = assessments
        .map((a: any) => a.subject_scores?.[subject])
        .filter((s: any): s is number => s !== undefined && s !== null)

      const latestScore = scores[scores.length - 1]

      // Trend
      let trend: 'improving' | 'declining' | 'stable' = 'stable'
      if (scores.length > 1) {
        if (scores[scores.length - 1] > scores[0]) trend = 'improving'
        else if (scores[scores.length - 1] < scores[0]) trend = 'declining'
      }

      // Velocity
      let velocity = 0
      if (scores.length > 1) {
        let totalChange = 0
        for (let i = 1; i < scores.length; i++) {
          totalChange += scores[i] - scores[i - 1]
        }
        velocity = totalChange / (scores.length - 1)
      }

      return {
        subject,
        displayName:    formatSubjectName(subject),
        level:          latestScore as 1 | 2 | 3 | 4,
        trend,
        velocity:       parseFloat(velocity.toFixed(2)),
        previousScores: scores,
      }
    })

    // ── 5. Build report ──────────────────────────────────────────────────────
    const vitals     = calculateVitals(subjectProgress)
    const actionPlan = generateActionPlan(subjectProgress)
    const isJunior   = student.grade >= 7 && student.grade <= 9  // Grade 7–9 = Junior School

    const studentProfile: StudentProfile = {
      id:       student.id,
      name:     student.name,
      grade:    student.grade,
      level:    isJunior ? 'Junior School' : 'Senior School',
      term:     latestAssessment?.term || 1,
      year:     latestAssessment?.year || new Date().getFullYear(),
      pathway:  student.current_pathway,
      school:   student.school,
    }

    const firstName      = student.name.split(' ')[0]

    // Phase 9.1.7 — same additive convergence as assessmentPipeline.ts
    // (Phase 9.1.6) and app/dashboard/clinic/reports/[studentId]/page.tsx.
    let additionalCareers: import('@/lib/academicClinic/careerEngine').CareerData[] = []
    try {
      const canonicalCareers = await repos.careers.getAllCareersWithCOS()
      additionalCareers = adaptCanonicalCareersForClinic(canonicalCareers)
    } catch (err) {
      console.error('[clinic/download] canonical career fetch failed (non-fatal — falls back to CAREER_DATABASE only):', err)
    }

    const juniorGuidance = isJunior  ? generateJuniorGuidance(subjectProgress)                  : undefined

    // Phase 2.1 (Decision 2 — one canonical career-ranking owner): the paid,
    // downloadable PDF's top-careers section now sources from
    // resolveCanonicalCareerMatches(), not the legacy CareerEngine. Errors
    // here are non-fatal to PDF generation — an honest "insufficient
    // evidence" section is shown rather than failing the whole download.
    let seniorGuidance: SeniorGuidance | undefined
    if (!isJunior) {
      try {
        const canonical = await resolveCanonicalCareerMatches(student.id)
        seniorGuidance = buildSeniorGuidanceFromCanonical(canonical, subjectProgress, firstName, student.grade)
      } catch (err) {
        console.error('[clinic/download] canonical career match resolution failed (non-fatal — report still generates):', err)
        seniorGuidance = buildSeniorGuidanceFromCanonical({ matches: [], mode: 'planning', insufficientEvidence: true, generatedAt: null }, subjectProgress, firstName, student.grade)
      }
    }

    // Phase 2.2 (canonical trajectory closure, Step 22 — cross-surface
    // consistency): this route already received real assessment history
    // (unlike assessmentPipeline.ts's hardcoded []), but its trajectory was
    // still computed via the same legacy pooled-average-diff algorithm
    // Projection's own team already identified as producing false
    // directional verdicts. Routing through canonical Projection here too
    // ensures the paid download can't disagree with the auto-emailed report
    // for the same learner at the same evidence state.
    let canonicalGrowth: import('@/lib/academicClinic/reportGenerator').CanonicalGrowthInput | null = null
    try {
      canonicalGrowth = await resolveCanonicalGrowthInput(student.id)
    } catch (err) {
      console.error('[clinic/download] canonical growth resolution failed (non-fatal — report still generates):', err)
    }

    const report = generateReport(
      studentProfile,
      subjectProgress,
      vitals,
      actionPlan,
      assessments,
      juniorGuidance,
      seniorGuidance,
      undefined,
      additionalCareers,
      canonicalGrowth
    )

    // ── 6. Generate PDF ──────────────────────────────────────────────────────
    const pdfBlob = await generateAcademicClinicPDF(report)
    const pdfBuffer = Buffer.from(await pdfBlob.arrayBuffer())

    // ── 7. Deduct tokens — only after report + PDF generation succeeded ───────
    if (access.deductTokens) {
      await deductFeatureTokens(access.userId, 'clinic_report', access.cost)
    }

    // ── 8. Return PDF ────────────────────────────────────────────────────────
    const filename = `${student.name.replace(/\s+/g, '_')}_Learner_Intelligence_Report.pdf`

    return new NextResponse(pdfBuffer, {
      status: 200,
      headers: {
        'Content-Type':        'application/pdf',
        'Content-Disposition': `attachment; filename="${filename}"`,
        'Content-Length':      pdfBuffer.length.toString(),
      },
    })

  } catch (error: unknown) {
    console.error('[clinic/download] error:', error instanceof Error ? error.message : String(error))
    return NextResponse.json(
      { error: 'Failed to generate report. Please try again.' },
      { status: 500 }
    )
  }
}
