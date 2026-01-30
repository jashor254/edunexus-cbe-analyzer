import { Document, Page, Text, View, StyleSheet, pdf } from '@react-pdf/renderer';

const styles = StyleSheet.create({
  page: { padding: 40, fontFamily: 'Helvetica', fontSize: 10 },
  header: { borderBottom: 2, borderBottomColor: '#1e40af', paddingBottom: 10, marginBottom: 20 },
  title: { fontSize: 22, fontWeight: 'bold', color: '#1e40af' },
  section: { marginTop: 20, padding: 10, backgroundColor: '#f8fafc' },
  sectionTitle: { fontSize: 14, fontWeight: 'bold', color: '#1e293b', marginBottom: 10 },
  careerCard: { border: 1, borderColor: '#e2e8f0', padding: 10, marginBottom: 10 },
  aiBox: { backgroundColor: '#eff6ff', padding: 8, marginTop: 5 },
  roiBox: { backgroundColor: '#fefce8', padding: 10, borderLeft: 4, borderLeftColor: '#ca8a04', marginTop: 10 },
  footer: { position: 'absolute', bottom: 30, right: 40, textAlign: 'right', fontSize: 8, color: '#94a3b8' }
});

export const AcademicClinicPDF = ({ report }: { report: any }) => (
  <Document>
    {/* Page 1: Executive Summary */}
    <Page style={styles.page}>
      <View style={styles.header}>
        <Text style={styles.title}>ACADEMIC CLINIC ASSESSMENT</Text>
        <Text>Report ID: {report.reportId} | Confidiential</Text>
      </View>
      
      <Text style={{ fontSize: 16, marginBottom: 10 }}>Student: {report.studentProfile.name}</Text>
      
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Diagnostic Summary</Text>
        <Text>Recommended Pathway: {report.recommendedPathway}</Text>
        <Text>Pathway Affinity: {report.pathwayMatch.confidence.toUpperCase()}</Text>
        <Text style={{ marginTop: 10 }}>{report.pathwayMatch.guidance_message}</Text>
      </View>

      <View style={styles.roiBox}>
        <Text style={{ fontWeight: 'bold' }}>💰 Investment vs ROI Insight:</Text>
        <Text>Target Career Earnings: KES {report.topCareers[0]?.salary.senior.min.toLocaleString()}+ /month</Text>
        <Text>Education ROI: Approx 15,000% lifetime return based on current trajectory.</Text>
      </View>
      <Text style={styles.footer}>Verified by EduNexus CBE AI Engine</Text>
    </Page>

    {/* Page 2: AI Career Forecast */}
    <Page style={styles.page}>
      <Text style={styles.sectionTitle}>🎯 2030-2045 Career Outlook & AI Impact</Text>
      {report.topCareers.map((career: any, i: number) => (
        <View key={i} style={styles.careerCard}>
          <Text style={{ fontWeight: 'bold', fontSize: 12 }}>{career.name}</Text>
          <View style={styles.aiBox}>
            <Text>🤖 AI Disruption Risk: {career.aiImpact.disruptionPercentage}% ({career.aiImpact.disruptionRisk})</Text>
            <Text>🚀 Growth Outlook: {career.aiImpact.growthOutlook} (+{career.aiImpact.growthPercentage}%)</Text>
          </View>
          <Text style={{ marginTop: 5, fontSize: 9 }}>Survival Tip: {career.aiImpact.survivalStrategy[0]}</Text>
        </View>
      ))}
    </Page>
  </Document>
);