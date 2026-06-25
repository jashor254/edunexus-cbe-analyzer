// app/api/learner-intelligence/pdf/route.ts
// Generates a Learner Intelligence Report PDF from assessment + student data.
// Accepts the same payload as /api/clinic/download (studentId + assessments + profile)
// and also accepts a pre-built AcademicClinicReport to avoid redundant computation.

import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { createClient } from '@/utils/supabase/server'
import { createServiceClient } from '@/utils/supabase/service'
import { isAdmin } from '@/lib/auth/isAdmin'
import {
  generateReport,
  calculateVitals,
  generateActionPlan,
  generateJuniorGuidance,
  generateSeniorGuidance,
  formatSubjectName,
} from '@/lib/academicClinic/reportGenerator'
import type { SubjectProgress, StudentProfile } from '@/lib/academicClinic/types'
import { resolveLevel } from '@/lib/assessments/gradeCalculator'
import type { CBCLevel } from '@/lib/assessments/gradeCalculator'
import { buildLearnerIntelligenceReport } from '@/lib/learnerIntelligence/reportGenerator'
import { generateLearnerIntelligencePDF } from '@/lib/learnerIntelligence/pdfGenerator'

// ─── Request Schema ───────────────────────────────────────────────────────────

const RequestSchema = z.object({
  studentId:   z.string().uuid(),
  assessments: z.array(z.object({
    id:             z.string().optional(),
    term:           z.number(),
    year:           z.number(),
    subject_scores: z.record(z.string(), z.number()),
    source:         z.string().optional(),
    created_at:     z.string().optional(),
    dream_career:   z.string().nullable().optional(),
  })).min(1),
})

// ─── Route Handler ────────────────────────────────────────────────────────────

export async function POST(req: NextRequest) {
  try {
    // ── 1. Auth ───────────────────────────────────────────────────────────────
    const supabase = await createClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // ── 2. Parse + validate ───────────────────────────────────────────────────
    const body   = await req.json()
    const parsed = RequestSchema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json({ error: 'Invalid request body', details: parsed.error.flatten() }, { status: 400 })
    }
    const { studentId, assessments } = parsed.data

    // ── 3. Authorise student access ───────────────────────────────────────────
    const db = createServiceClient()
    const { data: student, error: studentErr } = await db
      .from('students')
      .select('id, user_id, name, grade, school, current_pathway, parent_email')
      .eq('id', studentId)
      .eq('user_id', user.id)
      .single()

    if (studentErr || !student) {
      return NextResponse.json({ error: 'Student not found or access denied' }, { status: 404 })
    }

    // ── 4. Access check: admin / active subscription / tokens ─────────────────
    const adminAccess = await isAdmin(user.id, user.email)
    if (!adminAccess) {
      const [{ data: subscription }, { data: tokenBalance }] = await Promise.all([
        db.from('subscriptions')
          .select('plan, expires_at')
          .eq('user_id', user.id)
          .eq('status', 'active')
          .gt('expires_at', new Date().toISOString())
          .single(),
        db.from('token_balances')
          .select('balance')
          .eq('user_id', user.id)
          .single(),
      ])

      const hasSubscription = !!subscription
      const tokens          = tokenBalance?.balance ?? 0

      if (!hasSubscription && tokens <= 0) {
        return NextResponse.json(
          { error: 'No active subscription or tokens. Please upgrade.' },
          { status: 403 }
        )
      }

      if (!hasSubscription && tokens > 0) {
        const { error: deductError } = await db
          .from('token_balances')
          .update({ balance: tokens - 1 })
          .eq('user_id', user.id)
        if (deductError) {
          return NextResponse.json({ error: 'Could not deduct token. Try again.' }, { status: 500 })
        }
        await db.from('token_usage').insert({
          user_id:     user.id,
          action:      'learner_intelligence_report',
          tokens_used: 1,
          metadata:    { student_id: studentId, student_name: student.name },
        })
      }
    }

    // ── 5. Build subject progress ─────────────────────────────────────────────
    const latestAssessment = assessments[assessments.length - 1]
    const teacherAss       = assessments.find(a =>
      a.source === 'teacher' && a.term === latestAssessment.term && a.year === latestAssessment.year
    )
    const baseScores: Record<string, number>    = latestAssessment.subject_scores
    const currentScores: Record<string, number> = teacherAss
      ? Object.fromEntries(
          Object.entries(baseScores).map(([subj, parentLevel]) => {
            const teacherLevel = (teacherAss.subject_scores as Record<string, number>)?.[subj] ?? null
            const resolved     = resolveLevel(teacherLevel as CBCLevel | null, parentLevel as CBCLevel | null)
            return [subj, resolved?.level ?? parentLevel]
          })
        )
      : baseScores

    const subjectProgress: SubjectProgress[] = Object.keys(currentScores).map(subject => {
      const history = assessments
        .map(a => a.subject_scores?.[subject])
        .filter((s): s is number => s !== undefined && s !== null)
      const latest  = history[history.length - 1]

      let trend: 'improving' | 'declining' | 'stable' = 'stable'
      let velocity = 0
      if (history.length > 1) {
        if (history[history.length - 1] > history[0]) trend = 'improving'
        else if (history[history.length - 1] < history[0]) trend = 'declining'
        let totalChange = 0
        for (let i = 1; i < history.length; i++) {
          totalChange += history[i] - history[i - 1]
        }
        velocity = parseFloat((totalChange / (history.length - 1)).toFixed(2))
      }

      return {
        subject,
        displayName:    formatSubjectName(subject),
        level:          Math.max(1, Math.min(4, Math.round(latest))) as 1 | 2 | 3 | 4,
        trend,
        velocity,
        previousScores: history,
      }
    })

    // ── 6. Build underlying AcademicClinicReport (reuses existing pipeline) ───
    const isJunior: boolean = student.grade >= 7 && student.grade <= 9
    const firstName         = student.name.split(' ')[0]

    const studentProfile: StudentProfile = {
      id:      student.id,
      name:    student.name,
      grade:   student.grade,
      level:   isJunior ? 'Junior School' : 'Senior School',
      term:    latestAssessment.term,
      year:    latestAssessment.year,
      pathway: student.current_pathway,
      school:  student.school,
    }

    const vitals        = calculateVitals(subjectProgress)
    const actionPlan    = generateActionPlan(subjectProgress)
    const juniorGuidance = isJunior  ? generateJuniorGuidance(subjectProgress)                                            : undefined
    const seniorGuidance = !isJunior ? generateSeniorGuidance(subjectProgress, firstName, student.grade, student.current_pathway ?? undefined) : undefined

    const clinicReport = generateReport(
      studentProfile,
      subjectProgress,
      vitals,
      actionPlan,
      assessments,
      juniorGuidance,
      seniorGuidance,
    )

    // ── 7. Build Learner Intelligence Report ──────────────────────────────────
    const liReport = buildLearnerIntelligenceReport(clinicReport)

    // ── 8. Generate PDF ───────────────────────────────────────────────────────
    const pdfBlob   = await generateLearnerIntelligencePDF(liReport)
    const pdfBuffer = Buffer.from(await pdfBlob.arrayBuffer())

    const safeName = student.name.replace(/\s+/g, '_')
    const filename  = `Learner_Intelligence_${safeName}_Term${latestAssessment.term}_${latestAssessment.year}.pdf`

    return new NextResponse(pdfBuffer, {
      status: 200,
      headers: {
        'Content-Type':        'application/pdf',
        'Content-Disposition': `attachment; filename="${filename}"`,
        'Content-Length':      pdfBuffer.length.toString(),
      },
    })
  } catch (err) {
    console.error('[learner-intelligence/pdf]', err instanceof Error ? err.message : err)
    return NextResponse.json({ error: 'Failed to generate Learner Intelligence Report.' }, { status: 500 })
  }
}
