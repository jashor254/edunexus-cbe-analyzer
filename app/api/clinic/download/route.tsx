import { NextResponse } from 'next/server';
import { pdf } from '@react-pdf/renderer';
import { AcademicClinicPDF } from '@/lib/academicClinic/pdfGenerator';
import { generateAcademicClinicReport } from '@/lib/academicClinic/reportGenerator';

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { studentId, scores, profile } = body;

    // 1. Generate report data
    const reportData = await generateAcademicClinicReport(profile, scores);

    // 2. Render PDF to a Buffer-like structure
    const doc = <AcademicClinicPDF report={reportData} />;
    
    // Tuseme .toBuffer() kwa Node environment au .toUint8Array()
    // Njia ya uhakika zaidi inayofanya kazi Next.js 14/15:
    const blob = await pdf(doc).toBlob();
    const arrayBuffer = await blob.arrayBuffer();
    const uint8Array = new Uint8Array(arrayBuffer);

    return new NextResponse(uint8Array, {
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `attachment; filename="Academic_Clinic_${studentId}.pdf"`,
        'Content-Length': uint8Array.length.toString(),
      },
    });
  } catch (error) {
    console.error('PDF Error:', error);
    return NextResponse.json({ error: 'Failed to generate PDF' }, { status: 500 });
  }
}