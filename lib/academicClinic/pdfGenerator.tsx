// lib/academicClinic/pdfGenerator.tsx

import React from 'react';
import { Document, Page, Text, View, StyleSheet } from '@react-pdf/renderer';
import type { AcademicClinicReport } from './reportGenerator';

// PROFESSIONAL KENYAN CORPORATE STYLES
const styles = StyleSheet.create({
  page: { 
    padding: 40, 
    fontFamily: 'Helvetica', 
    fontSize: 10,
    lineHeight: 1.6,
    color: '#1e293b'
  },
  
  // HEADER
  header: { 
    borderBottom: 3, 
    borderBottomColor: '#1e40af', 
    paddingBottom: 12, 
    marginBottom: 24,
    backgroundColor: '#f8fafc',
    padding: 15,
    marginLeft: -40,
    marginRight: -40,
    marginTop: -40,
    paddingTop: 20
  },
  logo: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#1e40af',
    letterSpacing: -1,
    marginBottom: 4
  },
  subtitle: {
    fontSize: 11,
    color: '#64748b',
    fontStyle: 'italic'
  },
  
  // STUDENT INFO
  studentSection: {
    backgroundColor: '#eff6ff',
    padding: 15,
    borderRadius: 8,
    marginBottom: 20,
    borderLeft: 4,
    borderLeftColor: '#3b82f6'
  },
  studentName: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#1e40af',
    marginBottom: 6
  },
  
  // SECTIONS
  section: { 
    marginTop: 20, 
    padding: 16, 
    backgroundColor: '#f8fafc',
    borderRadius: 8,
    border: 1,
    borderColor: '#e2e8f0'
  },
  sectionTitle: { 
    fontSize: 14, 
    fontWeight: 'bold', 
    color: '#0f172a', 
    marginBottom: 10,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    borderBottom: 2,
    borderBottomColor: '#cbd5e1',
    paddingBottom: 6
  },
  
  // PATHWAY SECTION
  pathwayBox: {
    backgroundColor: '#f0fdf4',
    padding: 15,
    borderRadius: 6,
    borderLeft: 4,
    borderLeftColor: '#16a34a',
    marginBottom: 15
  },
  pathwayTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#166534',
    marginBottom: 8
  },
  confidenceBadge: {
    backgroundColor: '#dcfce7',
    padding: 6,
    paddingLeft: 10,
    paddingRight: 10,
    borderRadius: 4,
    fontSize: 9,
    fontWeight: 'bold',
    color: '#166534',
    marginTop: 5
  },
  
  // CAREER CARDS
  careerCard: { 
    border: 1.5, 
    borderColor: '#cbd5e1', 
    padding: 14, 
    marginBottom: 14,
    borderRadius: 6,
    backgroundColor: '#ffffff'
  },
  careerTitle: {
    fontSize: 13,
    fontWeight: 'bold',
    color: '#1e40af',
    marginBottom: 8
  },
  careerSubtitle: {
    fontSize: 9,
    color: '#64748b',
    marginBottom: 10,
    fontStyle: 'italic'
  },
  
  // MARKET REALITY
  marketGrid: {
    marginBottom: 10,
    flexWrap: 'wrap'
  },
  marketBadge: {
    backgroundColor: '#fffbeb',
    padding: 6,
    paddingLeft: 10,
    paddingRight: 10,
    borderRadius: 4,
    fontSize: 8,
    border: 1,
    borderColor: '#fbbf24',
    marginBottom: 6
  },
  
  // AI IMPACT BOX
  aiBox: { 
    backgroundColor: '#eff6ff', 
    padding: 12, 
    marginTop: 10,
    borderRadius: 6,
    borderLeft: 3,
    borderLeftColor: '#3b82f6'
  },
  aiTitle: {
    fontSize: 10,
    fontWeight: 'bold',
    color: '#1e40af',
    marginBottom: 6
  },
  aiMetric: {
    fontSize: 9,
    marginBottom: 4,
    color: '#334155'
  },
  
  // SURVIVAL STRATEGY
  strategyBox: {
    backgroundColor: '#fef3c7',
    padding: 10,
    marginTop: 8,
    borderRadius: 4
  },
  strategyItem: {
    fontSize: 8,
    marginBottom: 3,
    paddingLeft: 12,
    color: '#78350f'
  },
  
  // KENYAN CONTEXT BOX
  kenyanContextBox: {
    backgroundColor: '#fff7ed',
    padding: 12,
    marginTop: 10,
    borderRadius: 6,
    borderLeft: 3,
    borderLeftColor: '#f97316'
  },
  
  // ACTION PLAN
  actionSection: {
    backgroundColor: '#fef2f2',
    padding: 15,
    borderRadius: 6,
    marginTop: 15,
    borderLeft: 4,
    borderLeftColor: '#dc2626'
  },
  actionTitle: {
    fontSize: 12,
    fontWeight: 'bold',
    color: '#991b1b',
    marginBottom: 10
  },
  actionItem: {
    marginBottom: 12,
    padding: 10,
    backgroundColor: '#ffffff',
    borderRadius: 4,
    border: 1,
    borderColor: '#fecaca'
  },
  actionItemTitle: {
    fontSize: 10,
    fontWeight: 'bold',
    color: '#dc2626',
    marginBottom: 4
  },
  
  // ROI / INVESTMENT BOX
  roiBox: { 
    backgroundColor: '#fefce8', 
    padding: 16, 
    borderLeft: 4, 
    borderLeftColor: '#eab308', 
    marginTop: 15,
    borderRadius: 6,
    border: 1,
    borderColor: '#fde047'
  },
  roiTitle: {
    fontSize: 12,
    fontWeight: 'bold',
    color: '#854d0e',
    marginBottom: 8
  },
  
  // GUARDIAN ADVICE
  adviceBox: {
    backgroundColor: '#f0fdf4',
    padding: 14,
    marginTop: 15,
    borderRadius: 6,
    borderLeft: 4,
    borderLeftColor: '#16a34a'
  },
  
  // FOOTER
  footer: { 
    position: 'absolute', 
    bottom: 30, 
    left: 40, 
    right: 40, 
    borderTop: 1,
    borderTopColor: '#cbd5e1',
    paddingTop: 8,
    textAlign: 'center', 
    fontSize: 7, 
    color: '#94a3b8' 
  },
  
  // UTILITIES
  bold: { fontWeight: 'bold' },
  highlight: { color: '#1e40af', fontWeight: 'bold' },
  small: { fontSize: 8 },
  tiny: { fontSize: 7 },
  mt10: { marginTop: 10 },
  mb10: { marginBottom: 10 },
});

// HELPER FUNCTIONS
const formatEarningPotential = (potential: string): string => {
  const map: Record<string, string> = {
    'exceptional': '💰💰💰💰 Exceptional',
    'very_lucrative': '💰💰💰 Very Lucrative',
    'lucrative': '💰💰 Lucrative',
    'moderate': '💰 Moderate',
    'lower_but_stable': '💵 Lower but Stable'
  };
  return map[potential] || potential;
};

const formatJobSecurity = (security: string): string => {
  const map: Record<string, string> = {
    'very_high': '🛡️ Very High',
    'high': '🛡️ High',
    'moderate': '⚖️ Moderate',
    'low': '⚠️ Lower'
  };
  return map[security] || security;
};

const formatDemand = (demand: string): string => {
  const map: Record<string, string> = {
    'very_high': '🔥 Very High',
    'high': '📈 High',
    'moderate': '📊 Moderate',
    'low': '📉 Lower'
  };
  return map[demand] || demand;
};

const formatDisruptionRisk = (risk: string): string => {
  const map: Record<string, string> = {
    'very_low': '✅ Very Low',
    'low': '✅ Low',
    'moderate': '⚠️ Moderate',
    'high': '⚠️ High',
    'very_high': '🚨 Very High'
  };
  return map[risk] || risk;
};

const formatGrowthOutlook = (outlook: string): string => {
  const map: Record<string, string> = {
    'booming': '🚀 Booming',
    'growing': '📈 Growing',
    'stable': '➡️ Stable',
    'declining': '📉 Declining'
  };
  return map[outlook] || outlook;
};

// MAIN PDF COMPONENT
interface PDFProps {
  report: AcademicClinicReport;
}

export const AcademicClinicPDF = ({ report }: PDFProps) => {
  const topCareer = report.topCareers[0];
  const studentFirstName = report.studentProfile.name.split(' ')[0];
  
  return (
    <Document title={`EduNexus Academic Clinic - ${report.studentProfile.name}`}>
      
      {/* ==================== PAGE 1: EXECUTIVE SUMMARY ==================== */}
      <Page size="A4" style={styles.page}>
        {/* HEADER */}
        <View style={styles.header}>
          <Text style={styles.logo}>EDUNEXUS</Text>
          <Text style={styles.subtitle}>Academic Clinic Report | CBC Pathway Analysis | Confidential</Text>
        </View>
        
        {/* STUDENT INFO */}
        <View style={styles.studentSection}>
          <Text style={styles.studentName}>{report.studentProfile.name}</Text>
          <Text style={{ fontSize: 10, color: '#64748b' }}>
            Grade {report.studentProfile.grade} | {report.studentProfile.school || 'CBC Learner'}
          </Text>
          <Text style={{ fontSize: 8, color: '#94a3b8', marginTop: 4 }}>
            Report ID: {report.reportId} | Generated: {new Date(report.generatedAt).toLocaleDateString('en-KE')}
          </Text>
        </View>
        
        {/* PATHWAY RECOMMENDATION */}
        <View style={styles.pathwayBox}>
          <Text style={styles.pathwayTitle}>🎯 RECOMMENDED PATHWAY</Text>
          <Text style={{ fontSize: 14, fontWeight: 'bold', color: '#166534', marginBottom: 6 }}>
            {report.recommendedPathway}
          </Text>
          <View style={styles.confidenceBadge}>
            <Text>CONFIDENCE: {report.pathwayMatch.confidence.toUpperCase()}</Text>
          </View>
          <Text style={{ fontSize: 9, marginTop: 10, color: '#15803d', lineHeight: 1.4 }}>
            {report.pathwayMatch.guidance_message}
          </Text>
        </View>
        
        {/* TOP CAREER MATCH */}
        {topCareer && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>💼 Top Career Match</Text>
            
            <Text style={styles.careerTitle}>{topCareer.name}</Text>
            <Text style={styles.careerSubtitle}>{topCareer.pathway} Pathway</Text>
            
            {/* MARKET REALITY */}
            <View style={styles.marketGrid}>
              <View style={styles.marketBadge}>
                <Text>{formatEarningPotential(topCareer.marketReality.earningPotential)}</Text>
              </View>
              <View style={styles.marketBadge}>
                <Text>{formatJobSecurity(topCareer.marketReality.jobSecurity)}</Text>
              </View>
              <View style={styles.marketBadge}>
                <Text>{formatDemand(topCareer.marketReality.demandLevel)}</Text>
              </View>
            </View>
            
            {/* KENYAN CONTEXT */}
            <View style={styles.kenyanContextBox}>
              <Text style={{ fontSize: 9, fontWeight: 'bold', color: '#ea580c', marginBottom: 6 }}>
                🇰🇪 KENYAN MARKET REALITY
              </Text>
              <Text style={{ fontSize: 8, color: '#7c2d12', lineHeight: 1.5 }}>
                {topCareer.marketReality.kenyanContext}
              </Text>
            </View>
            
            {/* AI IMPACT */}
            <View style={styles.aiBox}>
              <Text style={styles.aiTitle}>🤖 AI & FUTURE OUTLOOK</Text>
              <Text style={styles.aiMetric}>
                <Text style={styles.bold}>Disruption Risk:</Text> {formatDisruptionRisk(topCareer.aiImpact.disruptionRisk)} ({topCareer.aiImpact.disruptionPercentage}%)
              </Text>
              <Text style={styles.aiMetric}>
                <Text style={styles.bold}>Job Market Growth:</Text> {formatGrowthOutlook(topCareer.aiImpact.growthOutlook)} (+{topCareer.aiImpact.growthPercentage}%)
              </Text>
              
              {/* SURVIVAL STRATEGY */}
              <View style={styles.strategyBox}>
                <Text style={{ fontSize: 9, fontWeight: 'bold', color: '#78350f', marginBottom: 5 }}>
                  💡 HOW TO STAY AHEAD:
                </Text>
                {topCareer.aiImpact.survivalStrategy.slice(0, 3).map((strategy, i) => (
                  <Text key={i} style={styles.strategyItem}>
                    • {strategy}
                  </Text>
                ))}
              </View>
            </View>
          </View>
        )}
        
        {/* INVESTMENT SUMMARY */}
        <View style={styles.roiBox}>
          <Text style={styles.roiTitle}>💰 INVESTMENT REQUIRED</Text>
          
          <Text style={{ fontSize: 9, marginBottom: 8, color: '#713f12' }}>
            To put {studentFirstName} on track for the {topCareer?.name || 'recommended'} career:
          </Text>
          
          <View style={{ marginBottom: 8 }}>
            <Text style={{ fontSize: 8, color: '#854d0e', marginBottom: 3 }}>
              <Text style={styles.bold}>Immediate Interventions:</Text> KES {report.actionPlan.estimatedInvestment.immediate.toLocaleString()}
            </Text>
            <Text style={{ fontSize: 8, color: '#854d0e', marginBottom: 3 }}>
              <Text style={styles.bold}>Learning Materials:</Text> KES {report.actionPlan.estimatedInvestment.books.toLocaleString()}
            </Text>
            {report.actionPlan.estimatedInvestment.tutor > 0 && (
              <Text style={{ fontSize: 8, color: '#854d0e', marginBottom: 3 }}>
                <Text style={styles.bold}>Tutoring Support:</Text> KES {report.actionPlan.estimatedInvestment.tutor.toLocaleString()}
              </Text>
            )}
          </View>
          
          <Text style={{ fontSize: 11, fontWeight: 'bold', color: '#78350f', borderTop: 1, borderTopColor: '#fde047', paddingTop: 6 }}>
            TOTAL INVESTMENT: KES {report.actionPlan.estimatedInvestment.total.toLocaleString()}
          </Text>
          
          <Text style={{ fontSize: 7, color: '#92400e', marginTop: 8, fontStyle: 'italic' }}>
            This focused investment now prevents costly remediation later.
          </Text>
        </View>
        
        {/* FOOTER */}
        <Text style={styles.footer}>
          © 2026 EduNexus Kenya | Transforming CBC Learners | Page 1 of 2
        </Text>
      </Page>
      
      {/* ==================== PAGE 2: ACTION PLAN ==================== */}
      <Page size="A4" style={styles.page}>
        <View style={styles.header}>
          <Text style={styles.logo}>EDUNEXUS</Text>
          <Text style={styles.subtitle}>90-Day Action Plan for {studentFirstName}</Text>
        </View>
        
        {/* IMMEDIATE ACTIONS */}
        {report.actionPlan.immediate.length > 0 && (
          <View style={styles.actionSection}>
            <Text style={styles.actionTitle}>
              🚨 URGENT: Address These Gaps Immediately
            </Text>
            <Text style={{ fontSize: 8, color: '#991b1b', marginBottom: 10 }}>
              These subjects need attention for {report.recommendedPathway} pathway success.
            </Text>
            
            {report.actionPlan.immediate.map((action, i) => (
              <View key={i} style={styles.actionItem}>
                <Text style={styles.actionItemTitle}>
                  {action.subject}: Level {action.currentLevel} → Target: Level {action.targetLevel}
                </Text>
                <Text style={{ fontSize: 8, color: '#dc2626', marginBottom: 6 }}>
                  ⚠️ {action.urgency}
                </Text>
                
                <Text style={{ fontSize: 9, fontWeight: 'bold', color: '#0f172a', marginBottom: 4 }}>
                  Action Steps:
                </Text>
                {action.specificSteps.map((step, j) => (
                  <Text key={j} style={{ fontSize: 8, marginBottom: 2, paddingLeft: 10, color: '#334155' }}>
                    {j + 1}. {step}
                  </Text>
                ))}
                
                <Text style={{ fontSize: 7, color: '#64748b', marginTop: 6 }}>
                  <Text style={styles.bold}>Timeline:</Text> {action.timeline} | <Text style={styles.bold}>Budget:</Text> KES {action.budget.toLocaleString()}
                </Text>
              </View>
            ))}
          </View>
        )}
        
        {/* GUARDIAN ADVICE */}
        <View style={styles.adviceBox}>
          <Text style={{ fontSize: 11, fontWeight: 'bold', color: '#166534', marginBottom: 6 }}>
            💡 GUARDIAN TUTOR ADVICE
          </Text>
          <Text style={{ fontSize: 8, color: '#15803d', lineHeight: 1.5 }}>
            The 21st-century job market values "Adaptability" over "Memorization." Focus on building {studentFirstName}'s 
            core competencies through the specific actions above. Track progress weekly using the EduNexus dashboard.
          </Text>
        </View>
        
        <Text style={styles.footer}>
          © 2026 EduNexus Kenya | Track progress at edunexus.app | Page 2 of 2
        </Text>
      </Page>
      
    </Document>
  );
};