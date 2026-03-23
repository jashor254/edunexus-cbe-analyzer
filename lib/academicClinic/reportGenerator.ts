// lib/academicClinic/reportGenerator.ts

import { 
  StudentProfile, 
  SubjectProgress, 
  Vitals, 
  ActionPlan, 
  JuniorGuidance, 
  SeniorGuidance,
  CareerMatch,
  GraphData,
  AcademicClinicReport 
} from './types'

// ===== HELPER: Format Subject Name =====
export function formatSubjectName(key: string): string {
  const specialCases: Record<string, string> = {
    'core_mathematics': 'Core Mathematics',
    'essential_mathematics': 'Essential Mathematics',
    'integrated_science': 'Integrated Science',
    'social_studies': 'Social Studies',
    'creative_arts_sports': 'Creative Arts & Sports',
    'pre_technical': 'Pre-Technical Studies',
    'agriculture_nutrition': 'Agriculture & Nutrition',
    'kiswahili_ksl': 'Kiswahili/KSL',
    'community_service': 'Community Service Learning',
    'computer_studies': 'Computer Studies',
    'home_science': 'Home Science',
    'business_studies': 'Business Studies',
    'history_citizenship': 'History & Citizenship',
    'physical_education': 'Physical Education',
    'sports_recreation': 'Sports & Recreation',
    'music_dance': 'Music & Dance',
    'theatre_film': 'Theatre & Film',
    'fine_arts': 'Fine Arts'
  }
  
  if (specialCases[key]) return specialCases[key]
  
  return key.split('_').map(word => 
    word.charAt(0).toUpperCase() + word.slice(1).toLowerCase()
  ).join(' ')
}

// ===== HELPER: Calculate Vitals =====
export function calculateVitals(subjects: SubjectProgress[]): Vitals {
  const total = subjects.reduce((sum, s) => sum + s.level, 0)
  const average = total / subjects.length
  
  return {
    overallAverage: parseFloat(average.toFixed(1)),
    strengths: subjects.filter(s => s.level >= 3).length,
    needsWork: subjects.filter(s => s.level === 2).length,
    urgent: subjects.filter(s => s.level === 1).length,
  }
}

// ===== HELPER: Generate Junior Guidance =====
export function generateJuniorGuidance(subjects: SubjectProgress[]): JuniorGuidance {
  const vitals = calculateVitals(subjects)
  const average = vitals.overallAverage
  
  let recommendedPathway: 'STEM' | 'Social Sciences' | 'Arts & Sports Science'
  let reasoning: string
  
  if (average >= 3.5) {
    recommendedPathway = 'STEM'
    reasoning = `With an exceptional average of ${average}/4.0, your child shows strong potential for Science, Technology, Engineering, and Mathematics.`
  } else if (average >= 3.0) {
    recommendedPathway = 'STEM'
    reasoning = `With a solid average of ${average}/4.0, STEM pathway is recommended.`
  } else if (average >= 2.0) {
    recommendedPathway = 'Social Sciences'
    reasoning = `With an average of ${average}/4.0, Social Sciences pathway offers excellent opportunities.`
  } else {
    recommendedPathway = 'Arts & Sports Science'
    reasoning = `Every child has unique talents! Arts & Sports Science pathway celebrates creativity.`
  }
  
  const strengths = subjects
    .filter(s => s.level >= 3)
    .map(s => formatSubjectName(s.subject))
    .slice(0, 3)
  
  const areasToImprove = subjects
    .filter(s => s.level <= 2)
    .map(s => formatSubjectName(s.subject))
    .slice(0, 3)
  
  return {
    recommendedPathway,
    reasoning,
    strengths: strengths.length ? strengths : ['Keep building foundational skills'],
    areasToImprove: areasToImprove.length ? areasToImprove : ['Maintain current progress']
  }
}

// ===== HELPER: Generate Senior Guidance =====
export function generateSeniorGuidance(subjects: SubjectProgress[]): SeniorGuidance {
  const careers: CareerMatch[] = [
    {
      name: 'Software Engineering',
      description: 'Design and build applications, systems, and software solutions',
      matchPercentage: 85,
      requiredSubjects: ['Mathematics', 'Computer Studies', 'Physics']
    },
    {
      name: 'Medicine',
      description: 'Diagnose and treat illnesses, improve healthcare outcomes',
      matchPercentage: 78,
      requiredSubjects: ['Biology', 'Chemistry', 'Mathematics']
    },
    {
      name: 'Data Science',
      description: 'Analyze complex data to drive business decisions',
      matchPercentage: 82,
      requiredSubjects: ['Mathematics', 'Computer Studies', 'Business']
    },
    {
      name: 'Engineering',
      description: 'Design and build structures, machines, and systems',
      matchPercentage: 80,
      requiredSubjects: ['Physics', 'Mathematics', 'Chemistry']
    },
    {
      name: 'Business Management',
      description: 'Lead organizations and drive business growth',
      matchPercentage: 75,
      requiredSubjects: ['Business Studies', 'Mathematics', 'English']
    }
  ]
  
  return {
    topCareers: careers.slice(0, 3),
    reasoning: 'Based on your subject performance, these career paths show strong alignment with your strengths.',
    nextSteps: [
      'Focus on improving Mathematics and Sciences',
      'Research university requirements',
      'Join relevant clubs and activities'
    ]
  }
}

// ===== HELPER: Generate Action Plan =====
export function generateActionPlan(subjects: SubjectProgress[]): ActionPlan {
  const struggling = subjects.filter(s => s.level <= 2)
  const improving = subjects.filter(s => s.trend === 'improving')
  const excelling = subjects.filter(s => s.level >= 3)
  
  return {
    immediate: struggling.map(s => `Focus on improving ${formatSubjectName(s.subject)} (currently Level ${s.level})`),
    shortTerm: improving.map(s => `Continue progress in ${formatSubjectName(s.subject)}`),
    longTerm: excelling.map(s => `Maintain excellence in ${formatSubjectName(s.subject)}`)
  }
}

// ===== HELPER: Generate Graph Data =====
export function generateGraphData(subjects: SubjectProgress[]): GraphData {
  return {
    competencyDistribution: {
      level1: subjects.filter(s => s.level === 1).length,
      level2: subjects.filter(s => s.level === 2).length,
      level3: subjects.filter(s => s.level === 3).length,
      level4: subjects.filter(s => s.level === 4).length,
    },
    subjectTrends: subjects.map(subject => ({
      subject: subject.subject,
      data: subject.previousScores.map((score, index) => ({
        term: `T${index + 1}`,
        score
      }))
    }))
  }
}

// ===== MAIN: Generate Report =====
export function generateReport(
  studentProfile: StudentProfile,
  subjects: SubjectProgress[],
  vitals: Vitals,
  actionPlan: ActionPlan,
  juniorGuidance?: JuniorGuidance,
  seniorGuidance?: SeniorGuidance
): AcademicClinicReport {
  
  const graphData = generateGraphData(subjects)
  
  const reportId = `ACR-${Date.now()}-${Math.random().toString(36).substring(2, 7).toUpperCase()}`
  
  return {
    studentProfile,
    subjectBreakdown: subjects,
    vitals,
    actionPlan,
    juniorGuidance,
    seniorGuidance,
    graphData,
    reportId,
    generatedAt: new Date().toISOString()
  }
}

// ===== EXPORT everything =====
export type { 
  AcademicClinicReport, 
  StudentProfile, 
  SubjectProgress, 
  Vitals, 
  ActionPlan, 
  JuniorGuidance, 
  SeniorGuidance,
  CareerMatch,
  GraphData 
}