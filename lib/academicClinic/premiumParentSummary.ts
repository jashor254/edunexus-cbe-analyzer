// lib/academicClinic/parentSummary.ts

import { AcademicClinicReport } from './reportGenerator';

/**
 * GENERATES A SIMPLE, JARGON-FREE SUMMARY FOR PARENTS
 * Can be used in:
 * - WhatsApp messages
 * - SMS notifications
 * - Email summaries
 * - Dashboard overview
 */

export function generateParentSummary(report: AcademicClinicReport): string {
  const studentFirstName = report.studentProfile.name.split(' ')[0];
  const topCareer = report.topCareers[0];
  const urgentCount = report.actionPlan.immediate.filter(a => a.currentLevel === 1).length;
  
  return `
🎓 ACADEMIC CLINIC SUMMARY
${report.studentProfile.name} | Grade ${report.studentProfile.grade}

━━━━━━━━━━━━━━━━━━━━━━━━

📊 RECOMMENDED PATH
${report.recommendedPathway}

${report.pathwayMatch.guidance_message}

━━━━━━━━━━━━━━━━━━━━━━━━

💼 BEST CAREER MATCH
${topCareer.name}

What this means:
${topCareer.marketReality.kenyanContext}

Earning Potential: ${topCareer.marketReality.earningPotential.replace('_', ' ')}
Job Security: ${topCareer.marketReality.jobSecurity}
Market Demand: ${topCareer.marketReality.demandLevel}

━━━━━━━━━━━━━━━━━━━━━━━━

⚠️ WHAT YOU NEED TO DO NOW

${urgentCount > 0 ? `
🚨 URGENT (${urgentCount} subject${urgentCount > 1 ? 's' : ''} need immediate help):
${report.actionPlan.immediate.filter(a => a.currentLevel === 1).map(action => 
  `• ${action.subject}: Currently Level ${action.currentLevel}, need Level 3
  First step: ${action.specificSteps[0]}`
).join('\n\n')}
` : '✅ No critical gaps! Good progress.'}

${report.actionPlan.immediate.filter(a => a.currentLevel === 2).length > 0 ? `
⚠️ IMPORTANT (needs attention soon):
${report.actionPlan.immediate.filter(a => a.currentLevel === 2).map(action =>
  `• ${action.subject}: Level ${action.currentLevel} → Target: Level 3`
).join('\n')}
` : ''}

━━━━━━━━━━━━━━━━━━━━━━━━

💰 INVESTMENT NEEDED
KES ${report.actionPlan.estimatedInvestment.total.toLocaleString()}

This covers:
- Learning materials: KES ${report.actionPlan.estimatedInvestment.books.toLocaleString()}
${report.actionPlan.estimatedInvestment.tutor > 0 ? 
  `• Tutoring support: KES ${report.actionPlan.estimatedInvestment.tutor.toLocaleString()}` : 
  '• Self-study program (no tutor needed)'}

Compare to typical tutoring:
KES 5,000-10,000/month × 6 months = KES 30,000-60,000
Your focused approach saves money AND targets exactly what ${studentFirstName} needs!

━━━━━━━━━━━━━━━━━━━━━━━━

📅 NEXT 30 DAYS

Week 1-2:
${report.actionPlan.immediate.slice(0, 1).map(action => 
  `• Get ${action.specificSteps[0]}\n• ${action.specificSteps[1]}`
).join('\n')}

Week 3-4:
${report.actionPlan.immediate.length > 0 ? 
  `• Start seeing progress - aim for ${report.actionPlan.immediate[0].successMetric}` :
  '• Continue current study routine'}
- ${report.actionPlan.midTerm[0]?.action}

━━━━━━━━━━━━━━━━━━━━━━━━

📱 ACCESS FULL REPORT
Download detailed PDF report with:
- All ${report.topCareers.length} career matches
- Complete 90-day action plan
- Step-by-step resources
- Progress tracking guide

Link: https://edunexus.app/clinic/${report.reportId}

━━━━━━━━━━━━━━━━━━━━━━━━

❓ QUESTIONS?
Chat with our Guardian Tutor AI:
https://edunexus.app/chat

━━━━━━━━━━━━━━━━━━━━━━━━

Report ID: ${report.reportId}
Generated: ${new Date(report.generatedAt).toLocaleDateString('en-KE')}

© EduNexus Kenya | Transforming CBC Learners
  `.trim();
}

/**
 * SHORTENED VERSION FOR SMS (160 chars limit)
 */
export function generateSMSSummary(report: AcademicClinicReport): string {
  const urgent = report.actionPlan.immediate.filter(a => a.currentLevel === 1).length;
  
  return `EDUNEXUS: ${report.studentProfile.name}'s Academic Clinic ready! Pathway: ${report.recommendedPathway}. ${urgent > 0 ? `${urgent} urgent action${urgent > 1 ? 's' : ''}` : 'Good progress'}. View: edunexus.app/clinic/${report.reportId}`;
}

/**
 * WHATSAPP-OPTIMIZED VERSION (with emojis & formatting)
 */
export function generateWhatsAppSummary(report: AcademicClinicReport): string {
  const student = report.studentProfile.name;
  const studentFirstName = student.split(' ')[0];
  const pathway = report.recommendedPathway;
  const career = report.topCareers[0];
  const urgent = report.actionPlan.immediate.filter(a => a.currentLevel === 1);
  
  return `
🎓 *ACADEMIC CLINIC REPORT*
*${student}* | Grade ${report.studentProfile.grade}

─────────────────────

📊 *RECOMMENDED PATHWAY*
*${pathway}*
Confidence: ${report.pathwayMatch.confidence.toUpperCase()}

${report.pathwayMatch.guidance_message}

─────────────────────

💼 *TOP CAREER MATCH*
*${career.name}*

🇰🇪 Kenyan Reality:
${career.marketReality.kenyanContext.substring(0, 150)}...

📈 Market Outlook:
- Earnings: ${career.marketReality.earningPotential.replace('_', ' ')}
- Security: ${career.marketReality.jobSecurity}
- Demand: ${career.marketReality.demandLevel}

🤖 AI Impact:
- Risk: ${career.aiImpact.disruptionRisk} (${career.aiImpact.disruptionPercentage}%)
- Growth: ${career.aiImpact.growthOutlook} (+${career.aiImpact.growthPercentage}%)

─────────────────────

${urgent.length > 0 ? `
🚨 *URGENT ACTIONS*
${urgent.map((action, i) => 
  `${i + 1}. *${action.subject}*: Level ${action.currentLevel} → ${action.targetLevel}
   Start: ${action.specificSteps[0]}`
).join('\n\n')}
` : '✅ *NO CRITICAL GAPS!*\nKeep up the good work!'}

─────────────────────

💰 *INVESTMENT: KES ${report.actionPlan.estimatedInvestment.total.toLocaleString()}*

This focused intervention is cheaper than:
❌ Generic tutoring: KES 30k-60k
✅ Your plan: KES ${report.actionPlan.estimatedInvestment.total.toLocaleString()}
💵 *Savings: ~KES ${(40000 - report.actionPlan.estimatedInvestment.total).toLocaleString()}!*

─────────────────────

📥 *DOWNLOAD FULL REPORT (3 pages)*
Complete analysis, all careers, 90-day plan
🔗 https://edunexus.app/clinic/${report.reportId}

💬 *CHAT WITH GUARDIAN TUTOR*
Get specific study advice for ${studentFirstName}
🔗 https://edunexus.app/chat

─────────────────────

_EduNexus Academic Clinic_
_Report: ${report.reportId}_
_${new Date(report.generatedAt).toLocaleDateString('en-KE')}_
  `.trim();
}

/**
 * EMAIL VERSION (HTML-friendly)
 */
export function generateEmailSummary(report: AcademicClinicReport): {
  subject: string;
  body: string;
} {
  const studentFirstName = report.studentProfile.name.split(' ')[0];
  const topCareer = report.topCareers[0];
  
  return {
    subject: `Academic Clinic Report Ready: ${studentFirstName}'s ${report.recommendedPathway} Pathway`,
    body: `
<html>
<body style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
  <div style="background: linear-gradient(135deg, #1e40af 0%, #3b82f6 100%); color: white; padding: 30px; border-radius: 10px; margin-bottom: 20px;">
    <h1 style="margin: 0; font-size: 28px;">EduNexus Academic Clinic</h1>
    <p style="margin: 10px 0 0 0; font-size: 14px; opacity: 0.9;">${report.studentProfile.name} | Grade ${report.studentProfile.grade}</p>
  </div>
  
  <div style="background: #f0fdf4; border-left: 4px solid #16a34a; padding: 20px; margin-bottom: 20px; border-radius: 6px;">
    <h2 style="margin: 0 0 10px 0; color: #166534;">📊 Recommended Pathway</h2>
    <p style="font-size: 18px; font-weight: bold; color: #166534; margin: 0;">${report.recommendedPathway}</p>
    <p style="margin: 10px 0 0 0; color: #15803d;">${report.pathwayMatch.guidance_message}</p>
  </div>
  
  <div style="background: #eff6ff; border-left: 4px solid #3b82f6; padding: 20px; margin-bottom: 20px; border-radius: 6px;">
    <h2 style="margin: 0 0 10px 0; color: #1e40af;">💼 Top Career Match</h2>
    <p style="font-size: 16px; font-weight: bold; color: #1e40af; margin: 0 0 10px 0;">${topCareer.name}</p>
    <p style="margin: 0; color: #334155; font-size: 14px;">${topCareer.marketReality.kenyanContext}</p>
    
    <div style="display: flex; gap: 10px; margin-top: 15px; flex-wrap: wrap;">
      <span style="background: #fef3c7; padding: 8px 12px; border-radius: 4px; font-size: 12px; font-weight: bold;">
        💰 ${topCareer.marketReality.earningPotential.replace('_', ' ')}
      </span>
      <span style="background: #dbeafe; padding: 8px 12px; border-radius: 4px; font-size: 12px; font-weight: bold;">
        🛡️ ${topCareer.marketReality.jobSecurity}
      </span>
      <span style="background: #fce7f3; padding: 8px 12px; border-radius: 4px; font-size: 12px; font-weight: bold;">
        📈 ${topCareer.marketReality.demandLevel}
      </span>
    </div>
  </div>
  
  ${report.actionPlan.immediate.length > 0 ? `
  <div style="background: #fef2f2; border-left: 4px solid #dc2626; padding: 20px; margin-bottom: 20px; border-radius: 6px;">
    <h2 style="margin: 0 0 10px 0; color: #991b1b;">🚨 Immediate Actions Required</h2>
    ${report.actionPlan.immediate.map(action => `
      <div style="background: white; padding: 15px; margin-bottom: 10px; border-radius: 4px; border: 1px solid #fecaca;">
        <p style="margin: 0 0 5px 0; font-weight: bold; color: #dc2626;">${action.subject}: Level ${action.currentLevel} → Level ${action.targetLevel}</p>
        <p style="margin: 5px 0; font-size: 13px; color: #334155;">First step: ${action.specificSteps[0]}</p>
        <p style="margin: 5px 0 0 0; font-size: 12px; color: #64748b;">Timeline: ${action.timeline} | Budget: KES ${action.budget.toLocaleString()}</p>
      </div>
    `).join('')}
  </div>
  ` : ''}
  
  <div style="background: #fffbeb; border-left: 4px solid #eab308; padding: 20px; margin-bottom: 20px; border-radius: 6px;">
    <h2 style="margin: 0 0 10px 0; color: #78350f;">💰 Investment Required</h2>
    <p style="font-size: 24px; font-weight: bold; color: #78350f; margin: 10px 0;">KES ${report.actionPlan.estimatedInvestment.total.toLocaleString()}</p>
    <p style="margin: 10px 0 0 0; font-size: 13px; color: #713f12;">
      This targeted intervention is significantly cheaper than generic tutoring (KES 30,000-60,000) 
      and addresses exactly what ${studentFirstName} needs.
    </p>
  </div>
  
  <div style="text-align: center; margin: 30px 0;">
    <a href="https://edunexus.app/clinic/${report.reportId}" 
       style="display: inline-block; background: #1e40af; color: white; padding: 15px 40px; 
              text-decoration: none; border-radius: 6px; font-weight: bold; font-size: 16px;">
      📥 Download Full PDF Report
    </a>
  </div>
  
  <div style="background: #f8fafc; padding: 20px; border-radius: 6px; text-align: center; margin-top: 30px;">
    <p style="margin: 0; color: #64748b; font-size: 12px;">
      EduNexus Kenya | Report ID: ${report.reportId}<br>
      Generated: ${new Date(report.generatedAt).toLocaleDateString('en-KE')}<br>
      Questions? support@edunexus.app | +254 700 000 000
    </p>
  </div>
</body>
</html>
    `
  };
}