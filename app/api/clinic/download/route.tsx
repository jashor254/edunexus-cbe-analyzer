// app/api/clinic/download/route.ts
import { NextResponse } from 'next/server'
import { createClient } from '@/utils/supabase/server'
import { createServiceClient } from '@/utils/supabase/service'
import {
  generateReport,
  calculateVitals,
  generateActionPlan,
  generateJuniorGuidance,
  generateSeniorGuidance,
  formatSubjectName,
} from '@/lib/academicClinic/reportGenerator'
import { generateAcademicClinicPDF } from '@/lib/academicClinic/pdfGenerator'
import { isAdmin } from '@/lib/auth/isAdmin'
import type {
  SubjectProgress,
  StudentProfile,
} from '@/lib/academicClinic/reportGenerator'
import { resolveLevel } from '@/lib/assessments/gradeCalculator'
import type { CBCLevel } from '@/lib/assessments/gradeCalculator'

export async function POST(req: Request) {
  try {
    // ── 1. Auth check ────────────────────────────────────────────────────────
    const supabase = await createClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
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
      .eq('user_id', user.id)
      .single()

    if (studentError || !student) {
      return NextResponse.json(
        { error: 'Student not found or access denied' },
        { status: 404 }
      )
    }

    // ── 4. Check access — admin bypass, subscription, OR token balance ────────
    const adminAccess = await isAdmin(user.id, user.email)

    if (!adminAccess) {
      const [{ data: subscription }, { data: tokenBalance }] = await Promise.all([
        db
          .from('subscriptions')
          .select('plan, expires_at')
          .eq('user_id', user.id)
          .eq('status', 'active')
          .gt('expires_at', new Date().toISOString())
          .single(),

        db
          .from('token_balances')
          .select('balance')
          .eq('user_id', user.id)
          .single(),
      ])

      const hasSubscription = !!subscription
      const tokens          = tokenBalance?.balance || 0
      const hasTokens       = tokens > 0

      if (!hasSubscription && !hasTokens) {
        return NextResponse.json(
          { error: 'No active subscription or tokens. Please upgrade.' },
          { status: 403 }
        )
      }

      // ── 5. Deduct token if not on subscription ─────────────────────────────
      if (!hasSubscription && hasTokens) {
        const { error: deductError } = await db
          .from('token_balances')
          .update({ balance: tokens - 1 })
          .eq('user_id', user.id)

        if (deductError) {
          console.error('[clinic/download] token deduct error:', deductError)
          return NextResponse.json(
            { error: 'Could not deduct token. Try again.' },
            { status: 500 }
          )
        }

        await db.from('token_usage').insert({
          user_id:     user.id,
          action:      'clinic_report',
          tokens_used: 1,
          metadata: {
            student_id:   studentId,
            student_name: student.name,
          }
        })
      }
    }

    // ── 6. Build subject progress from assessments ───────────────────────────
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

    // ── 7. Build report ──────────────────────────────────────────────────────
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
    const juniorGuidance = isJunior  ? generateJuniorGuidance(subjectProgress)                  : undefined
    const seniorGuidance = !isJunior ? generateSeniorGuidance(subjectProgress, firstName, student.grade, student.current_pathway ?? undefined) : undefined

    const report = generateReport(
      studentProfile,
      subjectProgress,
      vitals,
      actionPlan,
      assessments,
      juniorGuidance,
      seniorGuidance
    )

    // ── 8. Generate PDF ──────────────────────────────────────────────────────
    const pdfBlob = await generateAcademicClinicPDF(report)
    const pdfBuffer = Buffer.from(await pdfBlob.arrayBuffer())

    // ── 9. Return PDF ────────────────────────────────────────────────────────
    const filename = `${student.name.replace(/\s+/g, '_')}_Academic_Report.pdf`

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