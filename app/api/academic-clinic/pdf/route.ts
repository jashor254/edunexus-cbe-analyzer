import { NextRequest, NextResponse } from 'next/server'
import { generateAcademicClinicPDF } from '@/lib/academicClinic/pdfGenerator'
import type { AcademicClinicReport } from '@/lib/academicClinic/types'

export async function POST(req: NextRequest) {
  try {
    const { report } = (await req.json()) as { report: AcademicClinicReport }

    if (!report) {
      return NextResponse.json({ error: 'Missing report data' }, { status: 400 })
    }

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
