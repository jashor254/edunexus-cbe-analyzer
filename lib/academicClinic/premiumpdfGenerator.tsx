// lib/academicClinic/premiumPDFGenerator.tsx

import React from 'react';
import { Document, Page, Text, View, StyleSheet, Image } from '@react-pdf/renderer';
import { PremiumReport, PremiumReportEngine } from './premiumReportEngine';

const styles = StyleSheet.create({
  // Base page styles
  page: {
    padding: 40,
    fontFamily: 'Helvetica',
    fontSize: 10,
    lineHeight: 1.4,
  },
  
  // Header styles
  header: {
    marginBottom: 20,
    borderBottomWidth: 2,
    borderBottomColor: '#166534',
    paddingBottom: 10,
    alignItems: 'center',
  },
  logo: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#166534',
    textAlign: 'center',
  },
  subtitle: {
    fontSize: 10,
    color: '#64748b',
    marginTop: 4,
    textAlign: 'center',
  },
  
  // Pathway box
  pathwayBox: {
    backgroundColor: '#f0fdf4',
    borderLeftWidth: 4,
    borderLeftColor: '#16a34a',
    padding: 15,
    marginVertical: 15,
    borderRadius: 4,
  },
  pathwayTitle: {
    fontSize: 12,
    fontWeight: 'bold',
    color: '#166534',
    marginBottom: 8,
  },
  
  // Section styles
  section: {
    marginVertical: 15,
  },
  sectionTitle: {
    fontSize: 13,
    fontWeight: 'bold',
    color: '#0f172a',
    marginBottom: 10,
    textTransform: 'uppercase',
  },
  
  // Urgency banner
  urgencyBanner: {
    backgroundColor: '#dc2626',
    color: 'white',
    padding: 15,
    marginLeft: -40,
    marginRight: -40,
    marginTop: -40,
    textAlign: 'center',
  },
  urgencyText: {
    fontSize: 11,
    fontWeight: 'bold',
    color: 'white',
  },
  
  // ROI section
  roiHighlight: {
    backgroundColor: '#fefce8',
    borderWidth: 3,
    borderColor: '#eab308',
    padding: 20,
    marginVertical: 15,
    borderRadius: 8,
  },
  roiTitle: {
    fontSize: 14,
    fontWeight: 'bold',
    color: '#854d0e',
    marginBottom: 10,
  },
  roiNumber: {
    fontSize: 28,
    fontWeight: 'black',
    color: '#854d0e',
  },
  
  // Comparison table
  comparisonRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#e2e8f0',
  },
  
  // Bonus box
  bonusBox: {
    backgroundColor: '#f0fdf4',
    borderLeftWidth: 4,
    borderLeftColor: '#16a34a',
    padding: 12,
    marginVertical: 8,
    borderRadius: 4,
  },
  
  // Guarantee seal
  guaranteeSeal: {
    backgroundColor: '#dcfce7',
    borderWidth: 2,
    borderColor: '#16a34a',
    borderRadius: 50,
    padding: 20,
    alignItems: 'center',
    marginVertical: 20,
  },
  
  // CTA box
  ctaBox: {
    backgroundColor: '#dc2626',
    padding: 20,
    borderRadius: 8,
    textAlign: 'center',
    marginVertical: 20,
  },
  ctaText: {
    fontSize: 16,
    fontWeight: 'bold',
    color: 'white',
  },
  ctaSubtext: {
    fontSize: 11,
    color: '#fecaca',
    marginTop: 5,
  },
  
  // Scarcity footer
  scarcityFooter: {
    backgroundColor: '#1e293b',
    color: 'white',
    padding: 15,
    marginLeft: -40,
    marginRight: -40,
    marginBottom: -40,
    textAlign: 'center',
  },
  
  // Cost of inaction warning
  warningBox: {
    backgroundColor: '#fef2f2',
    padding: 15,
    borderRadius: 8,
    marginVertical: 15,
    borderLeftWidth: 4,
    borderLeftColor: '#dc2626',
  },
  warningTitle: {
    fontSize: 13,
    fontWeight: 'bold',
    color: '#991b1b',
    marginBottom: 8,
  },
  warningText: {
    fontSize: 10,
    color: '#7f1d1d',
    lineHeight: 1.6,
  },
  warningItalic: {
    fontSize: 10,
    color: '#7f1d1d',
    marginTop: 8,
    fontStyle: 'italic',
  },
  
  // Savings highlight
  savingsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    backgroundColor: '#f0fdf4',
    padding: 10,
    marginTop: 10,
    borderRadius: 4,
  },
  savingsText: {
    fontSize: 11,
    fontWeight: 'bold',
    color: '#166534',
  },
  savingsAmount: {
    fontSize: 11,
    fontWeight: 'bold',
    color: '#16a34a',
  },
});

export const PremiumAcademicClinicPDF = ({ report }: { report: PremiumReport }) => {
  const studentFirstName = report.studentProfile.name.split(' ')[0];
  const teaser = new PremiumReportEngine().generateTeaserSummary(report);
  const topCareer = report.topCareers[0];
  
  return (
    <Document>
      {/* PAGE 1: THE HOOK */}
      <Page size="A4" style={styles.page}>
        {/* URGENCY BANNER */}
        <View style={styles.urgencyBanner}>
          <Text style={styles.urgencyText}>
            ⏰ EXCLUSIVE INVITATION: Only {report.scarcityElements.limitedSlots} spots remaining for this intake
          </Text>
        </View>
        
        {/* HEADER */}
        <View style={styles.header}>
          <Text style={styles.logo}>EDUNEXUS ACADEMIC CLINIC</Text>
          <Text style={styles.subtitle}>Premium Career Pathway Analysis • Confidential</Text>
        </View>
        
        {/* STUDENT ALERT */}
        <View style={styles.pathwayBox}>
          <Text style={styles.pathwayTitle}>🎯 YOUR CHILD'S POSITION</Text>
          <Text style={{ fontSize: 20, fontWeight: 'black', color: '#166534', marginBottom: 8 }}>
            {teaser.headline}
          </Text>
          <Text style={{ fontSize: 11, color: '#15803d', lineHeight: 1.5 }}>
            {teaser.subheadline}
          </Text>
        </View>
        
        {/* THE ROI SECTION */}
        <View style={styles.roiHighlight}>
          <Text style={styles.roiTitle}>💰 THE RETURN ON YOUR INVESTMENT</Text>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginTop: 10 }}>
            <View style={{ textAlign: 'center' }}>
              <Text style={styles.roiNumber}>
                KES {(report.financialIntelligence.roiProjection.lifetime / 1000000).toFixed(1)}M
              </Text>
              <Text style={{ fontSize: 10, color: '#713f12' }}>Lifetime Career Value</Text>
            </View>
            <View style={{ textAlign: 'center' }}>
              <Text style={[styles.roiNumber, { color: '#16a34a' }]}>
                {((report.financialIntelligence.roiProjection.lifetime / report.financialIntelligence.paymentPlans[0].total)).toFixed(0)}x
              </Text>
              <Text style={{ fontSize: 10, color: '#713f12' }}>Return on Investment</Text>
            </View>
          </View>
        </View>
        
        {/* COST OF INACTION */}
        <View style={styles.warningBox}>
          <Text style={styles.warningTitle}>
            ⚠️ THE COST OF WAITING
          </Text>
          <Text style={styles.warningText}>
            If you delay 6 months: KES {report.financialIntelligence.costOfInaction.toLocaleString()} in remedial costs + lost opportunities
          </Text>
          <Text style={styles.warningItalic}>
            {report.competitivePosition.riskIfDelayed}
          </Text>
        </View>
        
        {/* COMPARISON TABLE */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>📊 INVESTMENT COMPARISON</Text>
          
          <View style={styles.comparisonRow}>
            <Text style={{ fontSize: 10, fontWeight: 'bold', color: '#0f172a' }}>Academic Clinic (Now)</Text>
            <Text style={{ fontSize: 10, color: '#16a34a', fontWeight: 'bold' }}>
              KES {report.financialIntelligence.paymentPlans[0].total.toLocaleString()}
            </Text>
          </View>
          
          <View style={styles.comparisonRow}>
            <Text style={{ fontSize: 10, color: '#334155' }}>Generic Tutoring (1 year)</Text>
            <Text style={{ fontSize: 10, color: '#94a3b8' }}>KES 60,000</Text>
          </View>
          
          <View style={styles.comparisonRow}>
            <Text style={{ fontSize: 10, color: '#334155' }}>Remedial (If delayed)</Text>
            <Text style={{ fontSize: 10, color: '#dc2626' }}>
              KES {report.financialIntelligence.costOfInaction.toLocaleString()}
            </Text>
          </View>
          
          <View style={styles.savingsRow}>
            <Text style={styles.savingsText}>YOUR SAVINGS TODAY</Text>
            <Text style={styles.savingsAmount}>
              KES {(report.financialIntelligence.costOfInaction - report.financialIntelligence.paymentPlans[0].total).toLocaleString()}
            </Text>
          </View>
        </View>
        
        {/* BONUSES */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>🎁 FREE BONUSES (Worth KES 15,000)</Text>
          {report.exclusiveBonuses.map((bonus, i) => (
            <View key={i} style={styles.bonusBox}>
              <Text style={{ fontSize: 11, fontWeight: 'bold', color: '#166534' }}>
                ✓ {bonus.name}
              </Text>
              <Text style={{ fontSize: 9, color: '#15803d', marginTop: 2 }}>
                Value: KES {bonus.value.toLocaleString()} • {bonus.description}
              </Text>
            </View>
          ))}
        </View>
        
        {/* GUARANTEE */}
        <View style={styles.guaranteeSeal}>
          <Text style={{ fontSize: 14, fontWeight: 'bold', color: '#166534', textAlign: 'center' }}>
            🛡️ GUARANTEE
          </Text>
          <Text style={{ fontSize: 10, color: '#15803d', textAlign: 'center', marginTop: 5 }}>
            {report.guarantee.promise}
          </Text>
        </View>
        
        {/* CTA */}
        <View style={styles.ctaBox}>
          <Text style={styles.ctaText}>SECURE {studentFirstName.toUpperCase()}'S SPOT NOW</Text>
          <Text style={styles.ctaSubtext}>
            KES {report.financialIntelligence.paymentPlans[0].monthly.toLocaleString()}/month • M-Pesa • Instant Access
          </Text>
        </View>
        
        {/* SCARCITY */}
        <View style={styles.scarcityFooter}>
          <Text style={{ fontSize: 11, fontWeight: 'bold', color: 'white' }}>
            ⏰ Offer expires: {report.scarcityElements.deadline.toLocaleDateString('en-KE')}
          </Text>
          <Text style={{ fontSize: 9, color: '#94a3b8', marginTop: 5 }}>
            {report.scarcityElements.reason}
          </Text>
        </View>
      </Page>
      
      {/* PAGE 2: THE ANALYSIS */}
      <Page size="A4" style={styles.page}>
        {/* HEADER */}
        <View style={styles.header}>
          <Text style={styles.logo}>DETAILED ANALYSIS</Text>
          <Text style={styles.subtitle}>For {report.studentProfile.name} • Grade {report.studentProfile.grade}</Text>
        </View>

        {/* COMPETITIVE POSITION */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>🏆 COMPETITIVE POSITION</Text>
          <View style={styles.pathwayBox}>
            <Text style={{ fontSize: 16, fontWeight: 'bold', color: '#166534', marginBottom: 5 }}>
              {report.competitivePosition.percentile}th Percentile
            </Text>
            <Text style={{ fontSize: 11, color: '#15803d', marginBottom: 10 }}>
              {report.competitivePosition.advantageGained}
            </Text>
            <Text style={{ fontSize: 10, color: '#7f1d1d', fontStyle: 'italic' }}>
              {report.competitivePosition.riskIfDelayed}
            </Text>
          </View>
        </View>

        {/* TOP CAREER MATCHES */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>🎯 TOP CAREER MATCHES</Text>
          {report.topCareers.slice(0, 3).map((career, i) => (
            <View key={i} style={[styles.bonusBox, { marginVertical: 5 }]}>
              <Text style={{ fontSize: 12, fontWeight: 'bold', color: '#166534' }}>
                {i + 1}. {career.name} ({career.matchScore}% Match)
              </Text>
              <Text style={{ fontSize: 9, color: '#64748b', marginTop: 2 }}>
                {career.description}
              </Text>
              <Text style={{ fontSize: 9, color: '#15803d', marginTop: 2 }}>
                💰 {career.marketReality.earningPotential} • 📈 {career.marketReality.growthOutlook}
              </Text>
            </View>
          ))}
        </View>

        {/* ACTION PLAN */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>⚡ IMMEDIATE ACTION PLAN</Text>
          {report.actionPlan.immediate.slice(0, 4).map((action, i) => (
            <View key={i} style={{ marginVertical: 5, padding: 10, backgroundColor: '#f8fafc', borderRadius: 4 }}>
              <Text style={{ fontSize: 11, fontWeight: 'bold', color: '#0f172a' }}>
                {action.subject}: {action.action}
              </Text>
              <Text style={{ fontSize: 9, color: '#64748b', marginTop: 2 }}>
                Timeline: {action.timeline} • Cost: KES {action.estimatedCost.toLocaleString()}
              </Text>
            </View>
          ))}
        </View>

        {/* SOCIAL PROOF */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>💪 SUCCESS STORIES</Text>
          <Text style={{ fontSize: 11, color: '#0f172a', marginBottom: 10 }}>
            {report.socialProof.similarStudents} students with similar profiles have succeeded through our program
          </Text>
          <View style={[styles.pathwayBox, { backgroundColor: '#fefce8', borderLeftColor: '#eab308' }]}>
            <Text style={{ fontSize: 11, fontWeight: 'bold', color: '#854d0e', marginBottom: 5 }}>
              Meet {report.socialProof.successStory.name}
            </Text>
            <Text style={{ fontSize: 9, color: '#713f12', marginBottom: 3 }}>
              Before: {report.socialProof.successStory.before}
            </Text>
            <Text style={{ fontSize: 9, color: '#713f12', marginBottom: 3 }}>
              After: {report.socialProof.successStory.after}
            </Text>
            <Text style={{ fontSize: 9, color: '#16a34a', fontWeight: 'bold' }}>
              Now: {report.socialProof.successStory.currentStatus}
            </Text>
          </View>
        </View>

        {/* SCHOLARSHIPS */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>🎓 SCHOLARSHIP OPPORTUNITIES</Text>
          {report.financialIntelligence.scholarshipOpportunities.map((scholarship, i) => (
            <Text key={i} style={{ fontSize: 10, color: '#15803d', marginVertical: 2 }}>
              • {scholarship}
            </Text>
          ))}
        </View>

        {/* PAYMENT PLANS */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>💳 PAYMENT OPTIONS</Text>
          {report.financialIntelligence.paymentPlans.map((plan, i) => (
            <View key={i} style={[styles.comparisonRow, { backgroundColor: i === 0 ? '#f0fdf4' : 'transparent', padding: 8, borderRadius: 4 }]}>
              <View>
                <Text style={{ fontSize: 11, fontWeight: 'bold', color: '#0f172a' }}>{plan.name}</Text>
                <Text style={{ fontSize: 9, color: '#64748b' }}>
                  Upfront: KES {plan.upfront.toLocaleString()} + {plan.monthly > 0 ? `${plan.monthly.toLocaleString()}/month` : 'No monthly'}
                </Text>
              </View>
              <View style={{ textAlign: 'right' }}>
                <Text style={{ fontSize: 11, fontWeight: 'bold', color: plan.savings > 0 ? '#16a34a' : '#0f172a' }}>
                  KES {plan.total.toLocaleString()}
                </Text>
                {plan.savings > 0 && (
                  <Text style={{ fontSize: 9, color: '#16a34a' }}>
                    Save KES {plan.savings.toLocaleString()}
                  </Text>
                )}
              </View>
            </View>
          ))}
        </View>

        {/* FINAL CTA */}
        <View style={styles.ctaBox}>
          <Text style={styles.ctaText}>DON'T LET THIS OPPORTUNITY SLIP AWAY</Text>
          <Text style={styles.ctaSubtext}>
            Every day delayed is a day of potential lost. Secure {studentFirstName}'s future today.
          </Text>
        </View>
      </Page>
    </Document>
  );
};