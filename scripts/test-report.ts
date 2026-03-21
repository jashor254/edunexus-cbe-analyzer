// scripts/test-report.ts
import { generateReport, formatSubjectName } from '@/lib/academicClinic/reportGenerator'
import { generateAcademicClinicPDF } from '@/lib/academicClinic/pdfGenerator'
import * as fs from 'fs'
import * as path from 'path'

async function testReport() {
  console.log('📝 TESTING REPORT GENERATOR...\n')
  
  // 1. Create mock student
  const studentProfile = {
    id: 'test-123',
    name: 'Wanjiku Kamau',
    grade: 8,
    level: 'Junior School' as const,
    term: 2,
    year: 2026
  }
  
  // 2. Create mock subject data (with trend)
  const subjectProgress = [
    {
      subject: 'mathematics',
      displayName: 'Mathematics',
      level: 3 as 1|2|3|4,
      trend: 'improving' as const,
      velocity: 0.5,
      previousScores: [2, 2, 3, 3]
    },
    {
      subject: 'english',
      displayName: 'English',
      level: 4 as 1|2|3|4,
      trend: 'stable' as const,
      velocity: 0,
      previousScores: [4, 4, 4, 4]
    },
    {
      subject: 'kiswahili',
      displayName: 'Kiswahili',
      level: 2 as 1|2|3|4,
      trend: 'declining' as const,
      velocity: -0.3,
      previousScores: [3, 2, 2, 1]
    },
    {
      subject: 'integrated_science',
      displayName: 'Integrated Science',
      level: 3 as 1|2|3|4,
      trend: 'improving' as const,
      velocity: 0.3,
      previousScores: [2, 2, 3, 3]
    },
    {
      subject: 'social_studies',
      displayName: 'Social Studies',
      level: 3 as 1|2|3|4,
      trend: 'stable' as const,
      velocity: 0,
      previousScores: [3, 3, 3, 3]
    }
  ]
  
  // 3. Calculate vitals
  const vitals = {
    overallAverage: 3.0,
    strengths: 2,
    needsWork: 1,
    urgent: 1
  }
  
  // 4. Create action plan
  const actionPlan = {
    immediate: [
      'Focus on improving Kiswahili (currently Level 2)',
      'Daily reading practice'
    ],
    shortTerm: [
      'Continue progress in Mathematics',
      'Join debate club'
    ],
    longTerm: [
      'Maintain excellence in English',
      'Prepare for KJSEA'
    ]
  }
  
  // 5. Generate junior guidance
  const juniorGuidance = {
    recommendedPathway: 'STEM' as const,
    reasoning: 'Strong performance in Mathematics and Science indicates STEM potential.',
    strengths: ['Mathematics', 'Integrated Science'],
    areasToImprove: ['Kiswahili']
  }
  
  console.log('✅ Test data created')
  console.log('📊 Subjects:', subjectProgress.length)
  console.log('🎯 Average:', vitals.overallAverage)
  
  // 6. Generate report
  console.log('\n⚙️ Generating report...')
  const report = generateReport(
    studentProfile,
    subjectProgress,
    vitals,
    actionPlan,
    juniorGuidance
  )
  
  console.log('✅ Report generated!')
  console.log('📄 Report ID:', report.reportId)
  console.log('📅 Generated:', report.generatedAt)
  
  // 7. Generate PDF
  console.log('\n⚙️ Generating PDF...')
  try {
    const pdfBlob = await generateAcademicClinicPDF(report)
    console.log('✅ PDF generated!')
    console.log('📦 Size:', (pdfBlob.size / 1024).toFixed(2), 'KB')
    
    // Save to file
    const buffer = Buffer.from(await pdfBlob.arrayBuffer())
    const outputPath = path.join(process.cwd(), 'test-report.pdf')
    fs.writeFileSync(outputPath, buffer)
    
    console.log('💾 Saved to:', outputPath)
    console.log('\n🎉 TEST PASSED! Open the PDF to view your report.')
    
  } catch (error) {
    console.error('❌ PDF generation failed:', error)
  }
}

// Run the test
testReport().catch(console.error)