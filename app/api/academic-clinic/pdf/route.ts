import { z } from 'zod'
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/utils/supabase/server'
import { generateAcademicClinicPDF } from '@/lib/academicClinic/pdfGenerator'
import type { AcademicClinicReport } from '@/lib/academicClinic/types'

const ReportSchema = z.object({
  report: z.object({
    studentProfile: z.object({
      name: z.string().min(1),
      term: z.union([z.string(), z.number()]),
      year: z.union([z.string(), z.number()]),
    }).passthrough(),
  }).passthrough(),
})

export async function POST(req: NextRequest) {
  try {
    const supabase = await createClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const parsed = ReportSchema.safeParse(await req.json())
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.issues[0]?.message ?? 'Missing report data' }, { status: 400 })
    }
    const { report } = parsed.data as unknown as { report: AcademicClinicReport }

    const blob = await generateAcademicClinicPDF(report)
    const buffer = Buffer.from(await blob.arrayBuffer())

    const studentName = report.studentProfile.name.replace(/\s+/g, '_')
    const filename = `Academic_Clinic_${studentName}_Term${report.studentProfile.term}_${report.studentProfile.year}.pdf`

    return new NextResponse(buffer, {
      status: 200,
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `attachment; filename="${filename}"`,
      },
    })
  } catch (err) {
    console.error('[academic-clinic/pdf]', err)
    return NextResponse.json({ error: 'PDF generation failed' }, { status: 500 })
  }
}
