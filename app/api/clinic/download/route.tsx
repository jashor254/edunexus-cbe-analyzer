import { NextResponse } from 'next/server';
import { renderToStream, Document } from '@react-pdf/renderer'; // Hakikisha Document ime-importiwa hapa
import { PremiumAcademicClinicPDF } from '@/lib/academicClinic/premiumpdfGenerator';
import { PremiumReportEngine } from '@/lib/academicClinic/premiumReportEngine';
import React from 'react';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(req: Request) {
  try {
    const { studentId } = await req.json();
    if (!studentId) return NextResponse.json({ error: 'Student ID is required' }, { status: 400 });

    const premiumEngine = new PremiumReportEngine();
    const reportData = await premiumEngine.generatePremiumReport(studentId);

    // ✅ NJIA YA UHAKIKA: Funga PremiumAcademicClinicPDF ndani ya <Document> hapa hapa
    // Hii inaondoa ile Error ya Incompatible Types
    const stream = await renderToStream(
      <Document>
        <PremiumAcademicClinicPDF report={reportData} />
      </Document>
    );

    const studentFirstName = reportData.studentProfile.name.split(' ')[0] || 'Student';
    const filename = `Premium_Clinic_${studentFirstName}_${new Date().toISOString().split('T')[0]}.pdf`;

    return new Response(stream as unknown as ReadableStream, {
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `attachment; filename="${filename}"`,
        'Cache-Control': 'no-cache',
      },
    });

  } catch (error: any) {
    console.error('❌ PDF Error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}