// app/api/clinic/download/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'
import { generateAcademicClinicPDF } from '@/lib/academicClinic/pdfGenerator'
import { 
  generateReport, 
  calculateVitals, 
  generateJuniorGuidance, 
  generateSeniorGuidance,
  formatSubjectName,
  type AcademicClinicReport,
  type StudentProfile,
  type SubjectProgress
} from '@/lib/academicClinic/reportGenerator'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

// Helper function to prepare report data from assessments
function prepareReportData(student: any, assessments: any[]): AcademicClinicReport | null {
  if (!assessments || assessments.length === 0) return null

  // Get latest assessment for current data
  const latest = assessments[assessments.length - 1]
  
  // Build subject progress from ALL assessments
  const subjectProgress: SubjectProgress[] = []
  const subjectMap = new Map<string, number[]>()
  
  // Collect all scores per subject from ALL assessments
  assessments.forEach(assessment => {
    if (assessment.subject_scores) {
      Object.entries(assessment.subject_scores).forEach(([subject, score]) => {
        if (!subjectMap.has(subject)) {
          subjectMap.set(subject, [])
        }
        subjectMap.get(subject)!.push(score as number)
      })
    }
  })

  // Calculate progress for each subject
  subjectMap.forEach((scores, subject) => {
    const latestScore = scores[scores.length - 1]
    const avgScore = scores.reduce((a, b) => a + b, 0) / scores.length
    
    // Calculate trend based on first vs last
    let trend: 'improving' | 'declining' | 'stable' = 'stable'
    if (scores.length > 1) {
      if (scores[scores.length - 1] > scores[0]) trend = 'improving'
      else if (scores[scores.length - 1] < scores[0]) trend = 'declining'
    }
    
    // Calculate velocity (average change per assessment)
    let velocity = 0
    if (scores.length > 1) {
      let totalChange = 0
      for (let i = 1; i < scores.length; i++) {
        totalChange += scores[i] - scores[i-1]
      }
      velocity = totalChange / (scores.length - 1)
    }
    
    subjectProgress.push({
      subject,
      displayName: formatSubjectName(subject),
      level: latestScore as 1 | 2 | 3 | 4,
      trend: trend as any,
      velocity: parseFloat(velocity.toFixed(2)),
      previousScores: scores
    })
  })

  // Create student profile
  const studentProfile: StudentProfile = {
    id: student.id,
    name: student.name,
    grade: student.grade,
    level: student.grade >= 10 ? 'Senior School' : 'Junior School',
    term: latest.term,
    year: latest.year
  }

  // Calculate vitals
  const vitals = calculateVitals(subjectProgress)

  // Create action plan based on struggling subjects
  const struggling = subjectProgress.filter(s => s.level <= 2)
  const improving = subjectProgress.filter(s => s.trend === 'improving')
  
  const actionPlan = {
    immediate: struggling.map(s => `Focus on improving ${s.displayName} (currently Level ${s.level})`),
    shortTerm: improving.map(s => `Continue good progress in ${s.displayName}`),
    longTerm: subjectProgress
      .filter(s => s.level >= 3)
      .map(s => `Maintain excellence in ${s.displayName}`)
  }

  // Generate guidance based on grade level
  const isJunior = student.grade <= 9
  const juniorGuidance = isJunior ? generateJuniorGuidance(subjectProgress) : undefined
  const seniorGuidance = !isJunior ? generateSeniorGuidance(subjectProgress) : undefined

  console.log('Generated subjectProgress:', subjectProgress) // Debug log
  console.log('Generated vitals:', vitals) // Debug log

  // Generate the final report
  return generateReport(
    studentProfile,
    subjectProgress,
    vitals,
    actionPlan,
    juniorGuidance,
    seniorGuidance
  )
}

export async function POST(request: NextRequest) {
  try {
    const cookieStore = await cookies()
    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        cookies: {
          get(name: string) {
            return cookieStore.get(name)?.value
          },
          set(name: string, value: string, options: any) {
            cookieStore.set({ name, value, ...options })
          },
          remove(name: string, options: any) {
            cookieStore.set({ name, value: '', ...options })
          },
        },
      }
    )

    const { data: { session } } = await supabase.auth.getSession()

    if (!session) {
      return NextResponse.json(
        { error: 'Unauthorized - Please log in' },
        { status: 401 }
      )
    }

    const body = await request.json()
    const { studentId, assessments, profile } = body

    console.log('Received request:', { studentId, assessmentsCount: assessments?.length, profile })

    if (!studentId || !assessments || !profile) {
      return NextResponse.json(
        { error: 'Missing required fields: studentId, assessments, profile' },
        { status: 400 }
      )
    }

    // Verify student belongs to user
    const { data: student, error: studentError } = await supabase
      .from('students')
      .select('*')
      .eq('id', studentId)
      .eq('user_id', session.user.id)
      .single()

    if (studentError || !student) {
      return NextResponse.json(
        { error: 'Student not found or access denied' },
        { status: 404 }
      )
    }

    // Prepare report data using ALL assessments
    const reportData = prepareReportData(student, assessments)

    if (!reportData) {
      return NextResponse.json(
        { error: 'Insufficient data to generate report. Need at least one assessment.' },
        { status: 400 }
      )
    }

    console.log('Report data generated:', reportData.reportId)

    // Generate PDF
    const pdfBlob = await generateAcademicClinicPDF(reportData)

    // Log report generation
    await supabase
      .from('report_downloads')
      .insert({
        user_id: session.user.id,
        student_id: studentId,
        report_id: reportData.reportId,
        downloaded_at: new Date().toISOString()
      })

    // Return PDF as download
    const filename = `${student.name.replace(/\s+/g, '_')}_Academic_Clinic_Report_${new Date().toLocaleDateString('en-GB').replace(/\//g, '-')}.pdf`

    return new NextResponse(pdfBlob, {
      status: 200,
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `attachment; filename="${filename}"`,
        'Content-Length': pdfBlob.size.toString(),
      },
    })

  } catch (error) {
    console.error('PDF Generation Error:', error)
    return NextResponse.json(
      { 
        error: 'Failed to generate report',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    )
  }
}

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams
  const studentId = searchParams.get('studentId')
  
  if (!studentId) {
    return NextResponse.json(
      { error: 'studentId is required' },
      { status: 400 }
    )
  }

  return NextResponse.json({
    endpoint: 'Academic Clinic Report Download',
    version: '1.0',
    available: true,
    formats: ['PDF'],
    description: 'POST to this endpoint with student data to generate a comprehensive Academic Clinic Report'
  })
}
