import React from 'react';
import { Document, Page, Text, View, StyleSheet } from '@react-pdf/renderer';

// 1. STYLES: Safi na Professional (Kenyan Corporate Theme)
const styles = StyleSheet.create({
  page: { 
    padding: 40, 
    fontFamily: 'Helvetica', 
    fontSize: 10,
    lineHeight: 1.5,
    color: '#334155'
  },
  header: { 
    borderBottom: 2, 
    borderBottomColor: '#1e40af', 
    paddingBottom: 10, 
    marginBottom: 20 
  },
  title: { 
    fontSize: 22, 
    fontWeight: 'bold', 
    color: '#1e40af',
    letterSpacing: -0.5
  },
  section: { 
    marginTop: 20, 
    padding: 15, 
    backgroundColor: '#f8fafc',
    borderRadius: 8
  },
  sectionTitle: { 
    fontSize: 14, 
    fontWeight: 'bold', 
    color: '#1e293b', 
    marginBottom: 8,
    textTransform: 'uppercase'
  },
  careerCard: { 
    border: 1, 
    borderColor: '#e2e8f0', 
    padding: 12, 
    marginBottom: 12,
    borderRadius: 6 
  },
  aiBox: { 
    backgroundColor: '#eff6ff', 
    padding: 10, 
    marginTop: 8,
    borderRadius: 4,
    borderLeft: 3,
    borderLeftColor: '#3b82f6'
  },
  roiBox: { 
    backgroundColor: '#fffbeb', 
    padding: 15, 
    borderLeft: 4, 
    borderLeftColor: '#ca8a04', 
    marginTop: 15,
    borderRadius: 4
  },
  footer: { 
    position: 'absolute', 
    bottom: 30, 
    left: 40, 
    right: 40, 
    borderTop: 1,
    borderTopColor: '#e2e8f0',
    paddingTop: 10,
    textAlign: 'center', 
    fontSize: 8, 
    color: '#94a3b8' 
  },
  bold: { fontWeight: 'bold' },
  highlight: { color: '#1e40af', fontWeight: 'bold' }
});

// 2. DATA TYPE: Kuhakikisha LangChain inatupa data tunayoelewa
interface PDFProps {
  report: {
    reportId: string;
    studentProfile: {
      name: string;
      grade: number;
    };
    recommendedPathway: string;
    pathwayMatch: {
      confidence: string;
      guidance_message: string;
    };
    topCareers: Array<{
      name: string;
      salary: { senior: { min: number } };
      aiImpact: {
        disruptionRisk: string;
        disruptionPercentage: number;
        growthOutlook: string;
        growthPercentage: number;
        survivalStrategy: string[];
      };
    }>;
  };
}

// 3. THE COMPONENT: Safi, No Placeholders
export const AcademicClinicPDF = ({ report }: PDFProps) => (
  <Document title={`Edunexus Report - ${report.studentProfile.name}`}>
    {/* Page 1: Executive Strategy & ROI */}
    <Page style={styles.page}>
      <View style={styles.header}>
        <Text style={styles.title}>EDUNEXUS ACADEMIC CLINIC</Text>
        <Text>Ref: {report.reportId} | CBE Alignment Report | Confidential</Text>
      </View>
      
      <Text style={{ fontSize: 16, marginBottom: 5 }}>
        Student Name: <Text style={styles.bold}>{report.studentProfile.name}</Text>
      </Text>
      <Text style={{ marginBottom: 15 }}>Education Level: Grade {report.studentProfile.grade}</Text>
      
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Diagnostic Pathway Analysis</Text>
        <Text>Recommended Pathway: <Text style={styles.highlight}>{report.recommendedPathway}</Text></Text>
        <Text>Confidence Score: <Text style={styles.bold}>{report.pathwayMatch.confidence.toUpperCase()}</Text></Text>
        <Text style={{ marginTop: 10, fontStyle: 'italic', fontSize: 9 }}>
          {report.pathwayMatch.guidance_message}
        </Text>
      </View>

      <View style={styles.roiBox}>
        <Text style={{ fontWeight: 'bold', color: '#854d0e', marginBottom: 5 }}>💰 ECONOMIC FORECAST & ROI:</Text>
        <Text>
          Based on the <Text style={styles.bold}>{report.topCareers[0]?.name}</Text> trajectory, 
          estimated senior-level earnings are <Text style={styles.bold}>KES {report.topCareers[0]?.salary.senior.min.toLocaleString()}+ per month.</Text>
        </Text>
        <Text style={{ marginTop: 5 }}>
          Investment Strategy: This pathway shows a significant lifetime Return on Investment (ROI) compared to traditional generic schooling.
        </Text>
      </View>

      <Text style={styles.footer}>
        © 2026 EduNexus Kenya - Transforming CBE Learners into Global Leaders. Verified by Guardian AI.
      </Text>
    </Page>

    {/* Page 2: AI Future-Proofing */}
    <Page style={styles.page}>
      <Text style={styles.sectionTitle}>🎯 2030-2045 Career Future-Proofing</Text>
      <Text style={{ marginBottom: 15, fontSize: 9 }}>
        How AI will shape your chosen career paths in the next 15 years:
      </Text>

      {report.topCareers.map((career, i) => (
        <View key={i} style={styles.careerCard}>
          <Text style={{ fontWeight: 'bold', fontSize: 12, color: '#1e40af' }}>{career.name}</Text>
          
          <View style={styles.aiBox}>
            <Text>🤖 AI Disruption Risk: <Text style={styles.bold}>{career.aiImpact.disruptionPercentage}% ({career.aiImpact.disruptionRisk})</Text></Text>
            <Text>🚀 Job Market Growth: <Text style={styles.bold}>{career.aiImpact.growthOutlook} (+{career.aiImpact.growthPercentage}%)</Text></Text>
          </View>

          <Text style={{ marginTop: 8, fontSize: 9 }}>
            <Text style={styles.bold}>SURVIVAL STRATEGY:</Text> {career.aiImpact.survivalStrategy[0]}
          </Text>
        </View>
      ))}

      <View style={[styles.section, { backgroundColor: '#f0fdf4', borderLeft: 4, borderLeftColor: '#16a34a' }]}>
        <Text style={[styles.sectionTitle, { color: '#166534' }]}>Guardian Advice</Text>
        <Text style={{ fontSize: 9 }}>
          The 21st-century job market values "Adaptability" over "Memorization." 
          Ensure the learner engages in extra-curricular activities that build the core competencies 
          identified in this report.
        </Text>
      </View>

      <Text style={styles.footer}>
        This report is generated based on current CBE assessment levels and AI market projections.
      </Text>
    </Page>
  </Document>
);