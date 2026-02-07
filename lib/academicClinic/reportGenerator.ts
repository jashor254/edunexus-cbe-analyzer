import { calculateJuniorPathwayAffinity, formatSubjectName } from '../pathwayCalculator';
import { getCompetencyDescription } from '../competencyFramework';
import { CAREER_DATABASE, getMatchingCareers } from './careerDatabase';

export type AcademicClinicReport = {
  reportId: string;
  studentProfile: any;
  overallHealthLabel: string;
  recommendedPathway: string;
  pathwayMatch: any;
  subjectBreakdown: any[];
  topCareers: any[];
  actionPlan: any;
  generatedAt: string;
};

export async function generateAcademicClinicReport(
  profile: any,
  scores: Record<string, number>,
  historicalData?: any
): Promise<AcademicClinicReport> {
  const pathwayData = calculateJuniorPathwayAffinity(scores);
  const matchingCareers = getMatchingCareers(pathwayData.top_pathway, scores);

  // Analyze subject competencies
  const subjectBreakdown = Object.entries(scores).map(([subject, level]) => ({
    subject,
    displayName: formatSubjectName(subject),
    level,
    // THE FIX: (level: number, subject: string)
    details: getCompetencyDescription(level, subject) 
  }));

  // Identify Critical Gaps (Level 1 or 2)
  const criticalGaps = subjectBreakdown.filter(s => s.level <= 2);

  // Build the 90-Day Action Plan
  const actionPlan = {
    immediate: criticalGaps.map(gap => ({
      action: `Intensive intervention for ${gap.displayName}`,
      // Added fallback if details is just a string
      rationale: `Currently at '${gap.level}'. Target is Level 3 for ${pathwayData.top_pathway} eligibility.`
    })),
    shortTerm: [
      { action: "Career Mentorship", rationale: `Connect with a professional in ${matchingCareers[0]?.name}` },
      { action: "Pathway Specific Club", rationale: `Join ${pathwayData.top_pathway === 'STEM' ? 'Coding/Science' : 'Music/Drama'} club` }
    ],
    estimatedInvestment: {
      tutor: criticalGaps.length * 3000,
      materials: 1500,
      total: (criticalGaps.length * 3000) + 1500
    }
  };

  return {
    reportId: `AC-${Math.random().toString(36).substr(2, 9).toUpperCase()}`,
    studentProfile: profile,
    overallHealthLabel: pathwayData.confidence === 'high' ? 'Robust' : 'Developing',
    recommendedPathway: pathwayData.top_pathway,
    pathwayMatch: pathwayData,
    subjectBreakdown,
    topCareers: matchingCareers,
    actionPlan,
    generatedAt: new Date().toISOString()
  };
}