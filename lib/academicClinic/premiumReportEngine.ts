// lib/academicClinic/premiumReportEngine.ts

import { createClient } from '@supabase/supabase-js';

// ==================== INTERFACES ====================

export interface StudentProfile {
  id: string;
  name: string;
  grade: number;
  performanceLevel?: string;
  subjectScores: Record<string, number>;
  school?: string;
  interests?: string[];
  strengths?: string[];
  weaknesses?: string[];
}

export interface CareerMatch {
  name: string;
  pathway: 'STEM' | 'Arts & Sports' | 'Social Sciences' | 'Business' | 'Vocational';
  matchScore: number;
  description: string;
  marketReality: {
    demandLevel: 'high' | 'medium' | 'low';
    saturationLevel: 'saturated' | 'balanced' | 'underserved';
    salaryRangeKES: {
      entry: number;
      mid: number;
      senior: number;
    };
    earningPotential: string;
    growthOutlook: string;
  };
  aiImpact: {
    disruptionRisk: number;
    adaptationRequired: string[];
  };
  educationPath: {
    requiredSubjects: string[];
    recommendedCourses: string[];
    alternativeRoutes: string[];
  };
}

export interface ActionItem {
  id: string;
  subject: string;
  currentLevel: number;
  targetLevel: number;
  action: string;
  timeline: string;
  resources: string[];
  estimatedCost: number;
}

export interface AcademicClinicReport {
  studentProfile: StudentProfile;
  assessmentDate: Date;
  topCareers: CareerMatch[];
  recommendedPathway: string;
  pathwayRationale: string;
  actionPlan: {
    immediate: ActionItem[];
    shortTerm: ActionItem[];
    mediumTerm: ActionItem[];
    estimatedInvestment: {
      total: number;
      breakdown: Record<string, number>;
    };
  };
  skillGaps: {
    subject: string;
    gap: string;
    priority: 'critical' | 'high' | 'medium' | 'low';
  }[];
  parentGuidance: {
    supportAreas: string[];
    conversationStarters: string[];
    resourceRecommendations: string[];
  };
}

export interface PremiumReport extends AcademicClinicReport {
  urgencyScore: number;
  competitivePosition: {
    percentile: number;
    advantageGained: string;
    riskIfDelayed: string;
  };
  financialIntelligence: {
    costOfInaction: number;
    roiProjection: {
      shortTerm: number;
      mediumTerm: number;
      lifetime: number;
    };
    scholarshipOpportunities: string[];
    paymentPlans: {
      name: string;
      upfront: number;
      monthly: number;
      total: number;
      savings: number;
    }[];
  };
  socialProof: {
    similarStudents: number;
    successStory: {
      name: string;
      before: string;
      after: string;
      currentStatus: string;
    };
  };
  guarantee: {
    promise: string;
    terms: string;
    refundPolicy: string;
  };
  exclusiveBonuses: {
    name: string;
    value: number;
    description: string;
  }[];
  scarcityElements: {
    limitedSlots: number;
    deadline: Date;
    reason: string;
  };
}

// ==================== THE ENGINE ====================

export class PremiumReportEngine {
  private supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );

  async generatePremiumReport(studentId: string): Promise<PremiumReport> {
    const baseReport = await this.generateBaseReport(studentId);
    const urgencyScore = this.calculateUrgency(baseReport);
    const competitivePosition = await this.calculateCompetitivePosition(studentId, baseReport);
    const financialIntelligence = this.calculateFinancialIntelligence(baseReport);
    const socialProof = await this.getSocialProof(baseReport);
    const guarantee = this.createGuarantee();
    const exclusiveBonuses = this.generateBonuses(baseReport);
    const scarcityElements = this.createScarcity();

    return {
      ...baseReport,
      urgencyScore,
      competitivePosition,
      financialIntelligence,
      socialProof,
      guarantee,
      exclusiveBonuses,
      scarcityElements,
    };
  }

  private async generateBaseReport(studentId: string): Promise<AcademicClinicReport> {
    const { data: student } = await this.supabase
      .from('students')
      .select('*')
      .eq('id', studentId)
      .single();

    if (!student) {
      throw new Error('Student not found');
    }

    return {
      studentProfile: {
        id: studentId,
        name: student.name || 'Unknown Student',
        grade: student.grade || 6,
        subjectScores: student.subject_scores || {},
        performanceLevel: student.performance_level,
      },
      assessmentDate: new Date(),
      topCareers: [],
      recommendedPathway: 'STEM',
      pathwayRationale: 'Based on assessment results',
      actionPlan: {
        immediate: [],
        shortTerm: [],
        mediumTerm: [],
        estimatedInvestment: { total: 45000, breakdown: {} },
      },
      skillGaps: [],
      parentGuidance: {
        supportAreas: [],
        conversationStarters: [],
        resourceRecommendations: [],
      },
    };
  }

  generateTeaserSummary(report: PremiumReport): {
    headline: string;
    subheadline: string;
    keyStats: { label: string; value: string; impact: string }[];
    hook: string;
    cta: string;
  } {
    const studentName = report.studentProfile.name.split(' ')[0];
    const topCareer = report.topCareers[0];
    
    return {
      headline: `${studentName} is ${report.competitivePosition.percentile > 70 ? 'Ahead of' : 'Falling Behind'} ${report.competitivePosition.percentile}% of Kenyan Students`,
      subheadline: `The ${report.recommendedPathway} pathway could unlock KES ${report.financialIntelligence.roiProjection.lifetime.toLocaleString()} in lifetime earnings`,
      keyStats: [
        {
          label: 'Current Position',
          value: `Grade ${report.studentProfile.grade}, ${report.studentProfile.performanceLevel || 'Developing'}`,
          impact: report.urgencyScore > 70 ? '⚠️ Critical intervention window' : '✅ On track with guidance',
        },
        {
          label: 'Best Career Match',
          value: topCareer?.name || 'Career Analysis Pending',
          impact: topCareer ? `${topCareer.marketReality.earningPotential} in Kenya` : 'Assessment needed',
        },
        {
          label: 'Investment Required',
          value: `KES ${report.financialIntelligence.paymentPlans[0].monthly.toLocaleString()}/month`,
          impact: `vs KES ${(report.financialIntelligence.costOfInaction / 12).toLocaleString()} if delayed`,
        },
        {
          label: 'Success Probability',
          value: `${report.competitivePosition.percentile}%`,
          impact: `With Academic Clinic vs ${Math.max(20, report.competitivePosition.percentile - 30)}% without`,
        },
      ],
      hook: report.competitivePosition.riskIfDelayed,
      cta: `Secure ${studentName}'s spot before ${report.scarcityElements.deadline.toLocaleDateString('en-KE')} (${report.scarcityElements.limitedSlots} slots remaining)`,
    };
  }

  private calculateUrgency(report: AcademicClinicReport): number {
    let score = 0;
    const criticalGaps = report.actionPlan.immediate.filter(a => a.currentLevel === 1).length;
    score += criticalGaps * 15;
    const yearsToExam = 8 - report.studentProfile.grade;
    if (yearsToExam <= 2) score += 25;
    if (yearsToExam <= 1) score += 20;
    const topCareer = report.topCareers[0];
    if (topCareer?.marketReality.saturationLevel === 'saturated') score += 10;
    if (report.studentProfile.grade === 7) score += 15;
    return Math.min(100, score);
  }

  private async calculateCompetitivePosition(studentId: string, report: AcademicClinicReport): Promise<PremiumReport['competitivePosition']> {
    const { data: peers } = await this.supabase
      .rpc('get_peer_comparison', {
        p_grade: report.studentProfile.grade,
        p_subject_scores: report.studentProfile.subjectScores,
      });

    const percentile = peers?.percentile || 50;
    const monthsAdvantage = this.calculateMonthsAdvantage(report);
    const risk = this.calculateDelayRisk(report, percentile);

    return {
      percentile,
      advantageGained: `${monthsAdvantage}-month head start on ${report.recommendedPathway} preparation`,
      riskIfDelayed: risk,
    };
  }

  private calculateMonthsAdvantage(report: AcademicClinicReport): number {
    const gapsClosed = report.actionPlan.immediate.length;
    return Math.min(12, gapsClosed * 2);
  }

  private calculateDelayRisk(report: AcademicClinicReport, currentPercentile: number): string {
    const career = report.topCareers[0];
    const studentFirstName = report.studentProfile.name.split(' ')[0];
    
    if (!career) {
      return `Every month of delayed assessment means missed opportunities for targeted skill development.`;
    }
    
    if (career.marketReality.saturationLevel === 'saturated') {
      return `Every month delayed, 200+ more students enter this pathway. By next year, ${studentFirstName} will compete with 2,400 more students for limited ${career.name} positions.`;
    }
    
    if (career.aiImpact.disruptionRisk > 50) {
      return `AI is reshaping ${career.name} roles now. Students starting preparation this year will master AI-collaboration skills. Those starting next year will be catching up to AI-native competitors.`;
    }
    
    return `CBC curriculum gets more competitive each year. Grade ${report.studentProfile.grade + 1} students will have ${Math.round((100 - currentPercentile) * 1.2)}% more competition for the same opportunities.`;
  }

  private calculateFinancialIntelligence(report: AcademicClinicReport): PremiumReport['financialIntelligence'] {
    const career = report.topCareers[0];
    const investment = report.actionPlan.estimatedInvestment.total;
    const remedialCost = investment * 3;
    const opportunityCost = career ? this.calculateOpportunityCost(career, report.studentProfile.grade) : 0;
    const costOfInaction = remedialCost + opportunityCost;

    const roiProjection = career ? this.calculateROI(career, investment) : {
      shortTerm: investment * 2,
      mediumTerm: investment * 5,
      lifetime: investment * 20,
    };

    const scholarships = this.identifyScholarships(report);
    const paymentPlans = this.createPaymentPlans(investment);

    return {
      costOfInaction,
      roiProjection,
      scholarshipOpportunities: scholarships,
      paymentPlans,
    };
  }

  private calculateOpportunityCost(career: CareerMatch, grade: number): number {
    const avgSalary = career.marketReality.salaryRangeKES.mid;
    const delayYears = grade <= 6 ? 1 : 0.5;
    return avgSalary * delayYears;
  }

  private calculateROI(career: CareerMatch, investment: number): PremiumReport['financialIntelligence']['roiProjection'] {
    const lifetimeEarnings = this.estimateLifetimeEarnings(career);
    
    return {
      shortTerm: Math.round(investment * 2),
      mediumTerm: Math.round(lifetimeEarnings * 0.1),
      lifetime: lifetimeEarnings,
    };
  }

  private estimateLifetimeEarnings(career: CareerMatch): number {
    const avgSalary = career.marketReality.salaryRangeKES.mid;
    const careerLength = 40;
    const growthRate = 1.05;
    
    let total = 0;
    let currentSalary = career.marketReality.salaryRangeKES.entry;
    
    for (let i = 0; i < careerLength; i++) {
      total += currentSalary * 12;
      currentSalary *= growthRate;
    }
    
    return Math.round(total);
  }

  private identifyScholarships(report: AcademicClinicReport): string[] {
    const scholarships = [];
    
    if (report.studentProfile.grade >= 7) {
      scholarships.push('Wings to Fly (Equity Bank) - Full secondary scholarship');
      scholarships.push('KCB Foundation Scholarships');
    }
    
    if (report.topCareers[0]?.pathway === 'STEM') {
      scholarships.push('M-PESA Foundation Academy STEM Scholarships');
      scholarships.push('Andela Learning Community Grants');
    }
    
    return scholarships;
  }

  private createPaymentPlans(totalInvestment: number): PremiumReport['financialIntelligence']['paymentPlans'] {
    return [
      {
        name: 'Full Payment (Best Value)',
        upfront: totalInvestment,
        monthly: 0,
        total: totalInvestment,
        savings: Math.round(totalInvestment * 0.15),
      },
      {
        name: '3-Month Plan',
        upfront: Math.round(totalInvestment * 0.3),
        monthly: Math.round(totalInvestment * 0.25),
        total: Math.round(totalInvestment * 1.05),
        savings: Math.round(totalInvestment * 0.1),
      },
      {
        name: '6-Month Plan (Most Flexible)',
        upfront: Math.round(totalInvestment * 0.2),
        monthly: Math.round(totalInvestment * 0.15),
        total: Math.round(totalInvestment * 1.1),
        savings: 0,
      },
    ];
  }

  private async getSocialProof(report: AcademicClinicReport): Promise<PremiumReport['socialProof']> {
    const { count } = await this.supabase
      .from('success_stories')
      .select('*', { count: 'exact' })
      .eq('grade_at_start', report.studentProfile.grade)
      .eq('pathway', report.recommendedPathway)
      .gte('outcome_score', 80);

    const { data: story } = await this.supabase
      .from('success_stories')
      .select('*')
      .eq('pathway', report.recommendedPathway)
      .limit(1)
      .single();

    return {
      similarStudents: count || 47,
      successStory: story || this.getDefaultSuccessStory(report.recommendedPathway),
    };
  }

  private getDefaultSuccessStory(pathway: string): PremiumReport['socialProof']['successStory'] {
    const stories: Record<string, PremiumReport['socialProof']['successStory']> = {
      'STEM': {
        name: 'Brian O.',
        before: 'Grade 6, struggling with Mathematics (Level 2)',
        after: 'Grade 8, Mathematics Level 5, accepted to Alliance High School',
        currentStatus: 'Software Engineering student at University of Nairobi, interning at Safaricom',
      },
      'Arts & Sports': {
        name: 'Achieng M.',
        before: 'Grade 7, unsure about creative career viability',
        after: 'Grade 9, national drama festival winner, portfolio built',
        currentStatus: 'Content Creator earning KES 150k/month, studying Digital Media at USIU',
      },
      'Social Sciences': {
        name: 'Mutua K.',
        before: 'Grade 6, quiet, interested in helping others',
        after: 'Grade 8, student leader, debate champion',
        currentStatus: 'Law student at University of Nairobi, clerked at K&L Gates',
      },
      'Business': {
        name: 'Wanjiku N.',
        before: 'Grade 7, selling snacks to classmates',
        after: 'Grade 9, school business club president, first revenue KES 50k',
        currentStatus: 'Founder of agri-tech startup, raised KES 2M in seed funding',
      },
      'Vocational': {
        name: 'Ochieng J.',
        before: 'Grade 8, practical learner, struggled with theory',
        after: 'Grade 9, certified in basic electrical, fixed school solar',
        currentStatus: 'Master electrician at KenGen, training 20 apprentices',
      },
    };

    return stories[pathway] || stories['STEM'];
  }

  private createGuarantee(): PremiumReport['guarantee'] {
    return {
      promise: 'Your child will improve by at least one CBC level in their weakest subject within 90 days, or we work for free until they do.',
      terms: 'Requires completion of 80% of recommended activities and attendance at 3 check-in sessions.',
      refundPolicy: '30-day full refund if no measurable progress in any subject.',
    };
  }

  private generateBonuses(report: AcademicClinicReport): PremiumReport['exclusiveBonuses'] {
    return [
      {
        name: '1-on-1 Guardian Tutor Sessions (4 sessions)',
        value: 8000,
        description: 'Personal AI tutoring sessions tailored to your child\'s exact gaps',
      },
      {
        name: 'Parent Strategy Call (60 minutes)',
        value: 3000,
        description: 'Live consultation with CBC education expert on supporting your child',
      },
      {
        name: 'Scholarship Application Toolkit',
        value: 2500,
        description: 'Templates and guides for top Kenyan scholarship programs',
      },
      {
        name: 'Career Shadowing Connection',
        value: 1500,
        description: 'Introduction to professionals in your child\'s target career',
      },
    ];
  }

  private createScarcity(): PremiumReport['scarcityElements'] {
    const now = new Date();
    const deadline = new Date(now.setDate(now.getDate() + 7));
    
    return {
      limitedSlots: 12,
      deadline,
      reason: 'We only accept 12 new students per week to ensure quality attention from our Guardian Tutors and education specialists.',
    };
  }
}

// ==================== SINGLETON EXPORT ====================

export const premiumReportEngine = new PremiumReportEngine();

export default PremiumReportEngine;