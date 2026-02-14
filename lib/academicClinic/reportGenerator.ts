// lib/academicClinic/reportGenerator.ts

import { calculateJuniorPathwayAffinity, formatSubjectName } from '../pathwayCalculator';
import { getCompetencyDescription } from '../competencyFramework';
import { CAREER_DATABASE, getMatchingCareers, CareerData } from './careerDatabase';

export type AcademicClinicReport = {
  reportId: string;
  studentProfile: {
    name: string;
    grade: number;
    school?: string;
  };
  overallHealthLabel: string;
  recommendedPathway: string;
  pathwayMatch: {
    confidence: string;
    guidance_message: string;
    top_pathway: string;
    stem_score: number;           // ✅ ADDED from PathwayRecommendation
    arts_sports_score: number;     // ✅ ADDED
    social_sciences_score: number; // ✅ ADDED
  };
  subjectBreakdown: Array<{
    subject: string;
    displayName: string;
    level: number;
    details: {
      description: string;
      nextSteps?: string[];
      examples?: string[];
    };
  }>;
  topCareers: CareerData[];
  actionPlan: {
    immediate: Array<{
      subject: string;
      currentLevel: number;
      targetLevel: number;
      urgency: string;
      action: string;
      specificSteps: string[];
      timeline: string;
      budget: number;
      successMetric: string;
    }>;
    midTerm: Array<{
      action: string;
      details: string;
      how: string;
      timeline: string;
      cost: string;
    }>;
    longTerm: Array<{
      action: string;
      details: string;
      timeline: string;
      resources: string[];
    }>;
    estimatedInvestment: {
      immediate: number;
      books: number;
      tutor: number;
      total: number;
    };
  };
  generatedAt: string;
};

/**
 * KENYAN-SPECIFIC RESOURCE RECOMMENDATIONS
 */
function getKenyanResources(subject: string): {
  books: string[];
  apps: string[];
  tutors: string;
  youtube: string;
  practice?: string;
} {
  const resourceMap: Record<string, any> = {
    'Mathematics': {
      books: ['KLB Mathematics Grade 7', 'Spotlight Mathematics', 'Longhorn Mathematics'],
      apps: ['Khan Academy (free)', 'Photomath', 'GeoGebra'],
      tutors: 'Check www.tutor.co.ke or local university students (KES 500-1500/hr)',
      youtube: 'Search: "CBC Grade 7 Mathematics Kenya" or "Mwalimu Explains Math"',
      practice: 'Work through KLB exercises daily, focus on word problems'
    },
    'Kiswahili': {
      books: ['Kiswahili Fasaha', 'Kiswahili Bora', 'KLB Kiswahili'],
      apps: ['Lugha Yetu', 'Learn Swahili (Google Play)'],
      tutors: 'Retired teachers or Form 4 leavers (KES 300-800/hr)',
      youtube: 'Search: "CBC Kiswahili sarufi" or "Kiswahili ni Rahisi"',
      practice: 'Daily 15-min reading (Taifa Leo newspaper, age-appropriate novels)'
    },
    'English': {
      books: ['Mentor English', 'Oxford Primary English', 'Macmillan English'],
      apps: ['Duolingo English', 'BBC Learning English'],
      tutors: 'University students (KES 500-1000/hr)',
      youtube: 'Search: "CBC English Grammar" or "Learn English with Emma"',
      practice: 'Read storybooks daily, write short paragraphs'
    },
    'Integrated Science': {
      books: ['KLB Integrated Science', 'Spotlight Science', 'Longhorn Science'],
      apps: ['Khan Academy Science', 'Phyphox (physics experiments)'],
      tutors: 'Science teachers or university students (KES 600-1200/hr)',
      youtube: 'Search: "CBC Science experiments Kenya" or "SciShow Kids"',
      practice: 'Conduct simple home experiments, observe nature'
    },
    'Social Studies': {
      books: ['KLB Social Studies', 'Spotlight Social Studies'],
      apps: ['Google Earth', 'Seterra Geography Quiz'],
      tutors: 'History/Geography teachers (KES 500-1000/hr)',
      youtube: 'Search: "CBC Social Studies Kenya" or "Kenya History"',
      practice: 'Discuss current events, visit museums/historical sites'
    },
    'Creative Arts': {
      books: ['KLB Creative Arts', 'Art and Craft for Primary Schools'],
      apps: ['YouTube Art for Kids Hub', 'Canva (for older students)'],
      tutors: 'Art teachers or artists (KES 500-1500/hr)',
      youtube: 'Search: "Art for Kids" or "Easy Drawing Tutorials"',
      practice: 'Daily drawing/crafts, visit art galleries'
    },
    'Agriculture': {
      books: ['KLB Agriculture', 'Longhorn Agriculture'],
      apps: ['iCow (farming app)', 'Plantix (plant disease identification)'],
      tutors: 'Agricultural officers or farmers (KES 300-800/hr)',
      youtube: 'Search: "Smart farming Kenya" or "Agriculture for beginners"',
      practice: 'Start small kitchen garden, visit demonstration farms'
    },
  };

  return resourceMap[subject] || {
    books: ['KLB textbooks for the subject'],
    apps: ['Search Google Play: "CBC [subject] Kenya"'],
    tutors: 'Local university students or retired teachers',
    youtube: `Search: "CBC ${subject} Kenya"`
  };
}

/**
 * GENERATE COMPREHENSIVE ACADEMIC CLINIC REPORT
 */
export async function generateAcademicClinicReport(
  profile: {
    name: string;
    grade: number;
    school?: string;
  },
  scores: Record<string, number>,
  historicalData?: any
): Promise<AcademicClinicReport> {
  
  // 1. CALCULATE PATHWAY AFFINITY
  const pathwayData = calculateJuniorPathwayAffinity(scores);
  
  // 2. GET MATCHING CAREERS
  const matchingCareers = getMatchingCareers(pathwayData.top_pathway, scores);
  
  // 3. ANALYZE SUBJECT COMPETENCIES
  const subjectBreakdown = Object.entries(scores).map(([subject, level]) => {
    const details = getCompetencyDescription(level, subject);
    
    return {
      subject,
      displayName: formatSubjectName(subject),
      level,
      details: typeof details === 'string' 
        ? { description: details, nextSteps: [], examples: [] }
        : details
    };
  });
  
  // 4. IDENTIFY CRITICAL GAPS (Level 1 or 2)
  const criticalGaps = subjectBreakdown.filter(s => s.level <= 2);
  
  // 5. BUILD IMMEDIATE ACTION PLAN
  const immediateActions = criticalGaps.map(gap => {
    const resources = getKenyanResources(gap.displayName);
    const isLevel1 = gap.level === 1;
    
    return {
      subject: gap.displayName,
      currentLevel: gap.level,
      targetLevel: 3,
      urgency: isLevel1 ? 'CRITICAL - Start immediately' : 'High - Start within 2 weeks',
      action: `Intensive ${gap.displayName} intervention`,
      specificSteps: [
        `Get textbook: ${resources.books[0]}`,
        `Install app: ${resources.apps[0]}`,
        resources.practice || 'Practice 30 minutes daily',
        isLevel1 ? `Find tutor: ${resources.tutors}` : 'Self-study with parent support',
        `Watch tutorials: ${resources.youtube}`
      ],
      timeline: isLevel1 ? '4-6 weeks (urgent)' : '6-8 weeks',
      budget: isLevel1 ? 5000 : 2000,
      successMetric: `Reach Level ${gap.level + 1} by next assessment`
    };
  });
  
  // 6. BUILD MID-TERM ACTION PLAN
  const topCareer = matchingCareers[0];
  const midTermActions = [
    {
      action: "Career Exposure Visit",
      details: `Visit a ${topCareer?.name || 'professional'} in their workplace`,
      how: "Contact professionals via LinkedIn, church, family network, or school career days",
      timeline: "During next school holiday (April or August)",
      cost: "Free - KES 1,000 (transport)"
    },
    {
      action: "Join Pathway-Specific Club",
      details: pathwayData.top_pathway === 'STEM' 
        ? "Science Club, Coding Club, Math Club, or Robotics if available"
        : pathwayData.top_pathway === 'Arts & Sports'
        ? "Drama Club, Music, Art Club, Debate, or Sports team"
        : "Debate Club, Business Club, Model UN, or Social Service/Community Service",
      how: "Ask class teacher or school principal about available clubs. If none exist, suggest starting one!",
      timeline: "Next term (Term 2 or 3)",
      cost: "Usually free in schools, sometimes KES 500-1000/term for materials"
    },
    {
      action: "Build Competency Portfolio",
      details: "Start documenting projects, achievements, and competency development",
      how: "Keep a simple notebook or digital folder. Include photos of projects, certificates, awards, creative work",
      timeline: "Start now, ongoing",
      cost: "Free (notebook) - KES 500 (fancy portfolio folder)"
    }
  ];
  
  // 7. BUILD LONG-TERM ACTION PLAN
  const longTermActions = [
    {
      action: "Senior Secondary Pathway Selection Preparation",
      details: "Research universities and TVET institutions offering programs in " + pathwayData.top_pathway,
      timeline: "Start by Grade 8, finalize by Grade 9",
      resources: [
        "KUCCPS website (www.kuccps.ac.ke) for university programs",
        "TVET Authority website for diploma/certificate courses",
        "School career guidance counselor",
        "University open days (usually November annually)"
      ]
    },
    {
      action: "Develop Digital Literacy",
      details: "Regardless of pathway, digital skills are essential for all 21st-century careers",
      timeline: "Ongoing, intensify in Grade 8-9",
      resources: [
        "Free coding: Code.org, Scratch (for beginners)",
        "Microsoft Office skills (Word, Excel, PowerPoint)",
        "Google Workspace basics",
        "YouTube: 'Digital literacy for students'"
      ]
    },
    {
      action: "Build Soft Skills",
      details: "Communication, teamwork, leadership - critical for all careers",
      timeline: "Ongoing through extracurriculars",
      resources: [
        "Join school debate, drama, or student leadership",
        "Volunteer in community service",
        "Participate in group projects",
        "Practice public speaking opportunities"
      ]
    }
  ];
  
  // 8. CALCULATE INVESTMENT
  const immediateInvestment = immediateActions.reduce((sum, action) => sum + action.budget, 0);
  const tutorCosts = criticalGaps.filter(g => g.level === 1).length * 5000;
  const booksCost = 1500;
  
  const estimatedInvestment = {
    immediate: immediateInvestment,
    books: booksCost,
    tutor: tutorCosts,
    total: immediateInvestment + booksCost
  };
  
  // 9. DETERMINE OVERALL HEALTH
  const overallHealthLabel = pathwayData.confidence === 'high' 
    ? 'Robust - On track for pathway success' 
    : pathwayData.confidence === 'medium'
    ? 'Developing - Needs focused intervention'
    : 'Needs Attention - Immediate action required';
  
  // 10. RETURN COMPLETE REPORT
  return {
    reportId: `AC-${Date.now().toString(36).toUpperCase()}-${Math.random().toString(36).substr(2, 5).toUpperCase()}`,
    studentProfile: profile,
    overallHealthLabel,
    recommendedPathway: pathwayData.top_pathway,
    pathwayMatch: {
      confidence: pathwayData.confidence,
      guidance_message: pathwayData.guidance_message,
      top_pathway: pathwayData.top_pathway,
      stem_score: pathwayData.stem_score,               // ✅ NOW INCLUDED
      arts_sports_score: pathwayData.arts_sports_score, // ✅ NOW INCLUDED
      social_sciences_score: pathwayData.social_sciences_score, // ✅ NOW INCLUDED
    },
    subjectBreakdown,
    topCareers: matchingCareers,
    actionPlan: {
      immediate: immediateActions,
      midTerm: midTermActions,
      longTerm: longTermActions,
      estimatedInvestment
    },
    generatedAt: new Date().toISOString()
  };
}