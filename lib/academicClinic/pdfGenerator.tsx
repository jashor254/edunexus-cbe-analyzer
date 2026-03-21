// lib/academicClinic/pdfGenerator.tsx

import React from 'react'
import { Document, Page, Text, View, StyleSheet, Font } from '@react-pdf/renderer'
import { 
  AcademicClinicReport,
  formatSubjectName
} from './reportGenerator'

// Register fonts
Font.register({
  family: 'Helvetica',
  fonts: [
    { src: 'Helvetica', fontWeight: 400 },
    { src: 'Helvetica-Bold', fontWeight: 700 },
    { src: 'Helvetica-Oblique', fontWeight: 400, fontStyle: 'italic' },
  ]
})

// Styles
const styles = StyleSheet.create({
  page: {
    padding: 40,
    fontFamily: 'Helvetica',
    fontSize: 11,
    lineHeight: 1.5,
  },
  coverPage: {
    backgroundColor: '#0a0a23',
    color: 'white',
    padding: 40,
    justifyContent: 'center',
  },
  coverTitle: {
    fontSize: 48,
    fontWeight: 700,
    color: 'white',
    marginBottom: 10,
  },
  coverSubtitle: {
    fontSize: 18,
    color: '#94a3b8',
    marginBottom: 40,
  },
  coverStudentName: {
    fontSize: 32,
    fontWeight: 700,
    color: '#fbbf24',
    marginBottom: 10,
  },
  coverInfo: {
    fontSize: 14,
    color: '#cbd5e1',
    marginBottom: 5,
  },
  coverFooter: {
    position: 'absolute',
    bottom: 40,
    left: 40,
    right: 40,
    fontSize: 10,
    color: '#64748b',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 20,
    paddingBottom: 10,
    borderBottomWidth: 2,
    borderBottomColor: '#fbbf24',
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: 700,
  },
  headerMeta: {
    fontSize: 9,
    color: '#64748b',
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: 700,
    marginTop: 20,
    marginBottom: 12,
  },
  vitalsGrid: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 20,
  },
  vitalCard: {
    flex: 1,
    padding: 12,
    backgroundColor: '#f8fafc',
    borderRadius: 8,
    borderLeftWidth: 4,
  },
  vitalLabel: {
    fontSize: 9,
    color: '#64748b',
    marginBottom: 5,
    textTransform: 'uppercase',
  },
  vitalValue: {
    fontSize: 20,
    fontWeight: 700,
  },
  subjectRow: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#e2e8f0',
  },
  levelBadge: {
    width: 30,
    height: 30,
    borderRadius: 15,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 10,
  },
  levelText: {
    fontSize: 12,
    fontWeight: 700,
  },
  subjectName: {
    width: 150,
    fontSize: 10,
    fontWeight: 600,
  },
  progressBar: {
    flex: 1,
    height: 6,
    backgroundColor: '#e2e8f0',
    borderRadius: 3,
    marginHorizontal: 10,
  },
  progressFill: {
    height: 6,
    borderRadius: 3,
  },
  trendText: {
    fontSize: 9,
    width: 50,
    textAlign: 'right',
  },
  guidanceBox: {
    backgroundColor: '#eff6ff',
    padding: 15,
    borderRadius: 8,
    marginTop: 10,
  },
  guidanceTitle: {
    fontSize: 12,
    fontWeight: 700,
    color: '#1e40af',
    marginBottom: 5,
  },
  guidanceText: {
    fontSize: 10,
    color: '#1e3a8a',
  },
  actionItem: {
    flexDirection: 'row',
    marginBottom: 6,
    fontSize: 10,
  },
  bullet: {
    width: 15,
    fontSize: 10,
  },
  footer: {
    position: 'absolute',
    bottom: 30,
    left: 40,
    right: 40,
    fontSize: 8,
    color: '#94a3b8',
    textAlign: 'center',
    borderTopWidth: 1,
    borderTopColor: '#e2e8f0',
    paddingTop: 10,
  },
})

// Helper functions for colors
const getLevelColor = (level: number): string => {
  const colors = ['#ef4444', '#f59e0b', '#10b981', '#8b5cf6']
  return colors[level - 1] || '#64748b'
}

const getLevelBg = (level: number): string => {
  const backgrounds = ['#fee2e2', '#fef3c7', '#d1fae5', '#ede9fe']
  return backgrounds[level - 1] || '#f1f5f9'
}

const getTrendIcon = (trend: string): string => {
  const icons: Record<string, string> = {
    accelerating: '📈',
    slowing: '📉',
    steady: '➡️',
    improving: '📈',
    declining: '📉',
    stable: '➡️',
  }
  return icons[trend] || '⏳'
}

// PDF Component
export const AcademicClinicPDF = ({ report }: { report: AcademicClinicReport }) => {
  const isJunior = report.studentProfile.grade <= 9
  const firstName = report.studentProfile.name.split(' ')[0]
  
  return (
    <Document>
      {/* Cover Page */}
      <Page size="A4" style={styles.coverPage}>
        <View>
          <Text style={styles.coverTitle}>Academic Clinic</Text>
          <Text style={styles.coverSubtitle}>Personalized Learning Report</Text>
          
          <Text style={styles.coverStudentName}>{report.studentProfile.name}</Text>
          <Text style={styles.coverInfo}>Grade {report.studentProfile.grade} • {report.studentProfile.level}</Text>
          <Text style={styles.coverInfo}>Term {report.studentProfile.term} • {report.studentProfile.year}</Text>
          
          <View style={{ marginTop: 60 }}>
            <Text style={{ fontSize: 12, color: '#94a3b8', marginBottom: 5 }}>
              🎯 Overall Average: {report.vitals.overallAverage}/4.0
            </Text>
            <Text style={{ fontSize: 12, color: '#94a3b8' }}>
              📊 Subjects Tracked: {report.subjectBreakdown.length}
            </Text>
          </View>
          
          <View style={styles.coverFooter}>
            <Text>Report ID: {report.reportId}</Text>
            <Text style={{ marginTop: 5 }}>
              Generated: {new Date(report.generatedAt).toLocaleDateString('en-KE', {
                year: 'numeric',
                month: 'long',
                day: 'numeric'
              })}
            </Text>
          </View>
        </View>
      </Page>

      {/* Page 1: Performance Overview */}
      <Page size="A4" style={styles.page}>
        <View style={styles.header}>
          <View>
            <Text style={styles.headerTitle}>Performance Overview</Text>
            <Text style={styles.headerMeta}>{report.studentProfile.name} • Grade {report.studentProfile.grade}</Text>
          </View>
          <View>
            <Text style={styles.headerMeta}>Report ID</Text>
            <Text style={{ fontSize: 10 }}>{report.reportId}</Text>
          </View>
        </View>

        {/* Vitals */}
        <Text style={styles.sectionTitle}>📊 Key Metrics</Text>
        <View style={styles.vitalsGrid}>
          <View style={[styles.vitalCard, { borderLeftColor: '#3b82f6' }]}>
            <Text style={styles.vitalLabel}>Average</Text>
            <Text style={[styles.vitalValue, { color: '#3b82f6' }]}>
              {report.vitals.overallAverage}
            </Text>
          </View>
          
          <View style={[styles.vitalCard, { borderLeftColor: '#10b981' }]}>
            <Text style={styles.vitalLabel}>Strengths</Text>
            <Text style={[styles.vitalValue, { color: '#10b981' }]}>
              {report.vitals.strengths}
            </Text>
          </View>
          
          <View style={[styles.vitalCard, { borderLeftColor: '#f59e0b' }]}>
            <Text style={styles.vitalLabel}>Focus</Text>
            <Text style={[styles.vitalValue, { color: '#f59e0b' }]}>
              {report.vitals.needsWork}
            </Text>
          </View>
          
          <View style={[styles.vitalCard, { borderLeftColor: '#ef4444' }]}>
            <Text style={styles.vitalLabel}>Urgent</Text>
            <Text style={[styles.vitalValue, { color: '#ef4444' }]}>
              {report.vitals.urgent}
            </Text>
          </View>
        </View>

        {/* Subject Breakdown */}
        <Text style={styles.sectionTitle}>📚 Subject Performance</Text>
        {report.subjectBreakdown.map((subject, idx) => (
          <View key={idx} style={styles.subjectRow}>
            <View style={[styles.levelBadge, { backgroundColor: getLevelBg(subject.level) }]}>
              <Text style={[styles.levelText, { color: getLevelColor(subject.level) }]}>
                {subject.level}
              </Text>
            </View>
            
            <Text style={styles.subjectName}>{formatSubjectName(subject.subject)}</Text>
            
            <View style={styles.progressBar}>
              <View style={[
                styles.progressFill,
                {
                  width: `${(subject.level / 4) * 100}%`,
                  backgroundColor: getLevelColor(subject.level)
                }
              ]} />
            </View>
            
            <Text style={styles.trendText}>
              {getTrendIcon(subject.trend)} {subject.velocity > 0 ? '+' : ''}{subject.velocity.toFixed(2)}
            </Text>
          </View>
        ))}

        <View style={styles.footer}>
          <Text>Page 1 of 2 • Confidential Educational Report</Text>
        </View>
      </Page>

      {/* Page 2: Guidance & Actions */}
      <Page size="A4" style={styles.page}>
        <View style={styles.header}>
          <View>
            <Text style={styles.headerTitle}>Personalized Guidance</Text>
            <Text style={styles.headerMeta}>Next Steps for {firstName}</Text>
          </View>
          <View>
            <Text style={styles.headerMeta}>Report ID</Text>
            <Text style={{ fontSize: 10 }}>{report.reportId}</Text>
          </View>
        </View>

        {/* Junior Guidance */}
        {isJunior && report.juniorGuidance && (
          <View>
            <Text style={styles.sectionTitle}>🎓 Pathway Recommendation</Text>
            <View style={styles.guidanceBox}>
              <Text style={styles.guidanceTitle}>
                Recommended: {report.juniorGuidance.recommendedPathway}
              </Text>
              <Text style={styles.guidanceText}>{report.juniorGuidance.reasoning}</Text>
            </View>
            
            <View style={{ marginTop: 15 }}>
              <Text style={{ fontSize: 11, fontWeight: 700, marginBottom: 5 }}>💪 Strengths:</Text>
              {report.juniorGuidance.strengths.map((strength, idx) => (
                <Text key={idx} style={{ fontSize: 10, marginLeft: 10 }}>• {strength}</Text>
              ))}
              
              <Text style={{ fontSize: 11, fontWeight: 700, marginTop: 10, marginBottom: 5 }}>📝 Areas to Improve:</Text>
              {report.juniorGuidance.areasToImprove.map((area, idx) => (
                <Text key={idx} style={{ fontSize: 10, marginLeft: 10 }}>• {area}</Text>
              ))}
            </View>
          </View>
        )}

        {/* Senior Guidance */}
        {!isJunior && report.seniorGuidance && (
          <View>
            <Text style={styles.sectionTitle}>🚀 Career Recommendations</Text>
            {report.seniorGuidance.topCareers.map((career, idx) => (
              <View key={idx} style={[styles.guidanceBox, { marginBottom: 10 }]}>
                <Text style={styles.guidanceTitle}>{idx + 1}. {career.name}</Text>
                <Text style={styles.guidanceText}>{career.description}</Text>
                <Text style={[styles.guidanceText, { marginTop: 5, fontWeight: 700 }]}>
                  Match: {career.matchPercentage}%
                </Text>
              </View>
            ))}
          </View>
        )}

        {/* Action Plan */}
        <Text style={styles.sectionTitle}>✅ Action Plan</Text>
        
        <View style={{ marginTop: 10 }}>
          <Text style={{ fontSize: 11, fontWeight: 700, marginBottom: 5 }}>This Week:</Text>
          {report.actionPlan.immediate.slice(0, 3).map((action, idx) => (
            <View key={idx} style={styles.actionItem}>
              <Text style={styles.bullet}>•</Text>
              <Text style={{ fontSize: 10 }}>{action}</Text>
            </View>
          ))}
          
          <Text style={{ fontSize: 11, fontWeight: 700, marginTop: 10, marginBottom: 5 }}>This Month:</Text>
          {report.actionPlan.shortTerm.slice(0, 3).map((action, idx) => (
            <View key={idx} style={styles.actionItem}>
              <Text style={styles.bullet}>•</Text>
              <Text style={{ fontSize: 10 }}>{action}</Text>
            </View>
          ))}
        </View>

        {/* Competency Distribution */}
        <Text style={[styles.sectionTitle, { marginTop: 20 }]}>📊 Competency Distribution</Text>
        <View style={{ flexDirection: 'row', justifyContent: 'space-around', marginTop: 10 }}>
          {[1,2,3,4].map(level => (
            <View key={level} style={{ alignItems: 'center' }}>
              <View style={{ 
                width: 30, 
                height: 50, 
                backgroundColor: '#e2e8f0', 
                borderRadius: 4,
                overflow: 'hidden',
                marginBottom: 5
              }}>
                <View style={{ 
                  height: `${(report.graphData.competencyDistribution[`level${level}` as keyof typeof report.graphData.competencyDistribution] / report.subjectBreakdown.length) * 100}%`,
                  backgroundColor: getLevelColor(level),
                  position: 'absolute',
                  bottom: 0,
                  left: 0,
                  right: 0
                }} />
              </View>
              <Text style={{ fontSize: 9 }}>Level {level}</Text>
              <Text style={{ fontSize: 8, color: '#64748b' }}>
                {report.graphData.competencyDistribution[`level${level}` as keyof typeof report.graphData.competencyDistribution]}
              </Text>
            </View>
          ))}
        </View>

        <View style={styles.footer}>
          <Text>Page 2 of 2 • Generated by EduNexus Academic Clinic</Text>
        </View>
      </Page>
    </Document>
  )
}

// PDF Generator Function - ULTIMATE FIX using Buffer.from
export async function generateAcademicClinicPDF(report: AcademicClinicReport): Promise<Blob> {
  try {
    const { renderToBuffer } = await import('@react-pdf/renderer')
    
    // Get buffer from renderToBuffer
    const buffer = await renderToBuffer(<AcademicClinicPDF report={report} />)
    
    // Use Buffer.from to create a standard Buffer
    const standardBuffer = Buffer.from(buffer)
    
    // Create Blob from the standard Buffer
    return new Blob([standardBuffer], { type: 'application/pdf' })
  } catch (error) {
    console.error('Failed to generate PDF:', error)
    throw new Error('PDF generation failed')
  }
}