// lib/academicClinic/careerEngine.ts
// ============================================================
// SINGLE UNIFIED FILE — replaces careerDatabase.ts,
// careerIntelligence.ts, careerMatcher.ts, dynamicCareerGenerator.ts
// ============================================================

import { createServiceClient } from '@/utils/supabase/service'
import { DEEPSEEK_CONFIG } from '@/lib/config/api'
import { analyzePerformance } from '@/lib/adaptiveLearning'
import { formatSubjectName } from '@/lib/pathwayCalculator'
import { unstable_cache } from 'next/cache'

// ============================================================
// SECTION 1 — LEGACY TYPES (from careerDatabase.ts)
// ============================================================

export type AIDisruptionRisk = 'very_low' | 'low' | 'moderate' | 'high' | 'very_high'
export type JobGrowthOutlook = 'declining' | 'stable' | 'growing' | 'booming'
export type EarningPotential = 'lower_but_stable' | 'moderate' | 'lucrative' | 'very_lucrative' | 'exceptional'
export type JobSecurity = 'low' | 'moderate' | 'high' | 'very_high'
export type DemandLevel = 'low' | 'moderate' | 'high' | 'very_high'

export type CareerData = {
  id: string
  name: string
  pathway: 'STEM' | 'Arts & Sports' | 'Social Sciences'
  kenyaShortageScore: number   // 0-100: how urgently Kenya needs this profession
  matchRequirements: {
    primarySubjects: string[]
    minimumLevels: Record<string, number>
  }
  marketReality: {
    earningPotential: EarningPotential
    jobSecurity: JobSecurity
    demandLevel: DemandLevel
    kenyanContext: string
  }
  cbeReadiness: {
    coreCompetencies: string[]
    recommendedSeniorPath: string
    universities: string[]
    tvetOptions: string[]
  }
  aiImpact: {
    disruptionRisk: AIDisruptionRisk
    disruptionPercentage: number
    growthOutlook: JobGrowthOutlook
    growthPercentage: number
    timeline: { shortTerm: string; midTerm: string; longTerm: string }
    survivalStrategy: string[]
  }
  realityCheck: {
    pros: string[]
    challenges: string[]
    typicalDay: string
  }
}

// ============================================================
// SECTION 2 — NEW KENYA-SPECIFIC TYPES
// ============================================================

export type KenyaAIDisruption =
  | 'protected'     // Human skills dominate — safe 20+ years
  | 'resilient'     // AI assists but doesn't replace — safe 10-15 years
  | 'evolving'      // Role changing — adapt skills by 2030
  | 'vulnerable'    // Core tasks automating — specialize urgently
  | 'transforming'  // Role will look completely different by 2028

export interface KenyaDisruptionAssessment {
  level: KenyaAIDisruption
  timelineYears: number
  kenyaReason: string
  humanAdvantages: string[]
  adaptationAdvice: string
  globalVsKenya: string
}

export interface MarketSignal {
  jobPostingsCount: number | null
  salaryTrend: 'rising' | 'stable' | 'declining' | 'unknown'
  sectorNews: string | null
  lastChecked: string
  source: 'live' | 'cached' | 'static'
}

export interface CareerMatch {
  career: CareerData
  matchScore: number
  matchReasons: string[]
  gapSubjects: string[]
}

export interface EnrichedCareerMatch extends CareerMatch {
  marketSignal: MarketSignal
  disruption: KenyaDisruptionAssessment
  shortDescription: string
  urgency: 'start_now' | 'build_toward' | 'long_term'
}

export interface CompassBridge {
  openingMessage: string
  subjectPriorities: Array<{
    subject: string
    displayName: string
    currentLevel: number
    targetLevel: number
    careerReason: string
    urgency: 'critical' | 'important' | 'helpful'
    actionSteps: string[]
  }>
  guidedTopics: string[]
  sessionGoal: string
  weeklyMilestones: Array<{
    week: number
    focus: string
    careerRelevance: string
    goal: string
  }>
  parentMessage: string
}

export interface CareerAnalysisResult {
  topCareers: EnrichedCareerMatch[]
  hiddenGems: EnrichedCareerMatch[]
  compassBridge: CompassBridge
  summary: {
    recommendedPathway: string
    pathwayConfidence: 'high' | 'medium' | 'low'
    criticalSubject: string
    careerReadiness: string
  }
}

// ============================================================
// SECTION 3 — LEGACY TYPES (from careerIntelligence.ts)
// ============================================================

export interface KenyanMarketData {
  sectorGrowth: 'declining' | 'stable' | 'growing' | 'booming'
  entryBarriers: 'low' | 'medium' | 'high' | 'very_high'
  saturationLevel: 'underserved' | 'balanced' | 'saturated' | 'oversaturated'
  keyEmployers: string[]
  salaryRangeKES: { entry: number; mid: number; senior: number }
  ruralVsUrban: 'rural_viable' | 'urban_only' | 'hybrid'
}

export interface CBCPathwayMapping {
  juniorSchoolFocus: string[]
  seniorSchoolPathways: ('STEM' | 'Arts & Sports' | 'Social Sciences' | 'TVET')[]
  keyLearningAreas: string[]
  suggestedCCAs: string[]
  portfolioProjects: string[]
}

export interface AIImpactForecast {
  automationRisk: number
  timeline: 'immediate' | '5_years' | '10_years' | '20_years'
  humanAdvantage: string[]
  pivotOpportunities: string[]
}

export interface CareerIntelligence {
  id: string
  name: string
  category: 'traditional' | 'emerging' | 'future' | 'hybrid'
  description: string
  kenyanMarket: KenyanMarketData
  cbcMapping: CBCPathwayMapping
  aiForecast: AIImpactForecast
  realStories: {
    successProfile: string
    challengesFaced: string[]
    adviceForStudents: string
  }
  verificationStatus: 'ai_generated' | 'expert_reviewed' | 'profession_validated'
  lastUpdated: Date
}

export type CareerProfile = {
  studentName: string
  grade: number
  pathway: string
  subjectScores: Record<string, number>
  strengths: string[]
  weaknesses: string[]
  pathwayConfidence: 'high' | 'medium' | 'low'
}

export type CareerRecommendation = {
  career: string
  matchScore: number
  reasoning: string
  requiredSubjects: string[]
  currentGaps: string[]
  kenyanUniversities: string[]
  tvetOptions: string[]
  internationalOptions: string[]
  industryDemand: 'very_high' | 'high' | 'moderate' | 'low'
  earningPotential: 'exceptional' | 'very_lucrative' | 'lucrative' | 'moderate' | 'lower_but_stable'
  jobSecurity: 'very_high' | 'high' | 'moderate' | 'low'
  kenyanMarketReality: string
  aiDisruptionRisk: 'very_low' | 'low' | 'moderate' | 'high' | 'very_high'
  careerPath: string[]
}

export type IntegratedLearningPlan = {
  career: string
  subject: string
  currentLevel: number
  targetLevel: number
  whyItMatters: string
  careerSpecificSteps: string[]
  careerSpecificResources: string[]
  successStories: string[]
  milestones: Array<{ month: number; goal: string; careerRelevance: string }>
}

// ============================================================
// SECTION 4 — DYNAMIC CAREER TYPE (from dynamicCareerGenerator.ts)
// ============================================================

export interface DynamicCareer {
  name: string
  description: string
  match_percentage?: number
  salary_range: string
  education_path: string
  education_duration: string
  why_matched?: string
  required_subjects: string[]
  required_subjects_display?: string[]
  current_gaps?: unknown[]
  outlook: 'excellent' | 'good' | 'moderate' | 'emerging' | 'stable'
  demand_in_kenya: 'very_high' | 'high' | 'moderate' | 'low'
  ai_disruption_risk: 'very_low' | 'low' | 'moderate' | 'high'
  universities_in_kenya?: string[]
  tvet_options?: string[]
  career_path?: string[]
  is_ai_generated?: boolean
}

// ============================================================
// SECTION 5 — CAREER DATABASE (40 careers with kenyaShortageScore)
// ============================================================

export const CAREER_DATABASE: CareerData[] = [
  // ── STEM (17 careers) ──────────────────────────────────────
  {
    id: 'software_engineer',
    name: 'Software Engineer / Developer',
    pathway: 'STEM',
    kenyaShortageScore: 80,
    matchRequirements: {
      primarySubjects: ['mathematics', 'integrated_science'],
      minimumLevels: { mathematics: 3, integrated_science: 3 },
    },
    marketReality: {
      earningPotential: 'very_lucrative',
      jobSecurity: 'high',
      demandLevel: 'very_high',
      kenyanContext: 'Tech startups, banks, telcos, and international remote jobs. Can work from anywhere. High demand, but competitive field requiring constant learning.',
    },
    cbeReadiness: {
      coreCompetencies: ['Critical Thinking', 'Digital Literacy', 'Problem Solving', 'Creativity'],
      recommendedSeniorPath: 'STEM - Computer Science & ICT',
      universities: ['JKUAT', 'UoN', 'Strathmore', 'Multimedia University', 'KCA'],
      tvetOptions: ['Nairobi Technical Training Institute', 'NIBS Tech', 'Zetech College'],
    },
    aiImpact: {
      disruptionRisk: 'moderate',
      disruptionPercentage: 45,
      growthOutlook: 'booming',
      growthPercentage: 180,
      timeline: {
        shortTerm: 'AI tools like GitHub Copilot speed up coding but create MORE software jobs.',
        midTerm: 'Shift toward AI system architecture, ethics, and complex problem-solving.',
        longTerm: 'Human creativity and business understanding remain irreplaceable.',
      },
      survivalStrategy: [
        "Learn AI/ML fundamentals - don't fear AI, USE it",
        'Master system design and architecture (not just coding)',
        'Develop soft skills - communication, teamwork, business thinking',
        'Specialize in a niche (fintech, healthtech, agritech)',
      ],
    },
    realityCheck: {
      pros: [
        'Work remotely for global companies (earn in USD/EUR)',
        'Flexible hours and work-life balance',
        'Continuous learning keeps work interesting',
        'Can freelance or start your own tech company',
      ],
      challenges: [
        'Requires constant upskilling - tech changes fast',
        'Can be sedentary - health concerns if not careful',
        'Competitive job market for entry-level',
        'Imposter syndrome is common in the field',
      ],
      typicalDay: 'Write code, attend team meetings (often virtual), debug issues, learn new technologies, collaborate on projects. Mix of solo deep work and team collaboration.',
    },
  },

  {
    id: 'medical_doctor',
    name: 'Medical Doctor',
    pathway: 'STEM',
    kenyaShortageScore: 95,
    matchRequirements: {
      primarySubjects: ['mathematics', 'integrated_science'],
      minimumLevels: { mathematics: 3, integrated_science: 4 },
    },
    marketReality: {
      earningPotential: 'very_lucrative',
      jobSecurity: 'very_high',
      demandLevel: 'very_high',
      kenyanContext: 'Always in demand. Can work in public hospitals, private clinics, or start own practice. Long training but guaranteed employment. Rural areas desperate for doctors.',
    },
    cbeReadiness: {
      coreCompetencies: ['Empathy', 'Communication', 'Ethical Decision Making', 'Critical Thinking'],
      recommendedSeniorPath: 'STEM - Biological Sciences',
      universities: ['UoN', 'Moi University', 'Aga Khan University', 'KU', 'JKUAT'],
      tvetOptions: [],
    },
    aiImpact: {
      disruptionRisk: 'very_low',
      disruptionPercentage: 5,
      growthOutlook: 'growing',
      growthPercentage: 60,
      timeline: {
        shortTerm: 'High demand persists across Kenya - urban and rural.',
        midTerm: 'AI assists diagnosis and surgery, but human touch critical.',
        longTerm: 'Bedside manner, empathy, and complex decision-making stay human.',
      },
      survivalStrategy: [
        'Embrace medical technology and AI diagnostic tools',
        'Specialize (cardiology, pediatrics, surgery, etc.)',
        'Develop excellent patient communication skills',
        'Consider public health or healthcare administration',
      ],
    },
    realityCheck: {
      pros: [
        'Saving lives - deeply fulfilling career',
        'Highly respected in society',
        'Job security guaranteed',
        'Multiple specialization options',
      ],
      challenges: [
        'Long education (6-8 years minimum)',
        'Emotionally and physically demanding',
        'Irregular hours, night shifts, emergencies',
        'High stress and burnout risk',
      ],
      typicalDay: 'Patient consultations, diagnose conditions, prescribe treatment, perform procedures, update medical records, continuous learning on new treatments.',
    },
  },

  {
    id: 'data_scientist',
    name: 'Data Scientist / AI Specialist',
    pathway: 'STEM',
    kenyaShortageScore: 88,
    matchRequirements: {
      primarySubjects: ['mathematics', 'integrated_science'],
      minimumLevels: { mathematics: 4, integrated_science: 3 },
    },
    marketReality: {
      earningPotential: 'exceptional',
      jobSecurity: 'high',
      demandLevel: 'very_high',
      kenyanContext: 'Fastest growing tech field. Banks, insurance, telcos, government all need data scientists. Can work remotely for international companies. Shortage of qualified professionals.',
    },
    cbeReadiness: {
      coreCompetencies: ['Critical Thinking', 'Digital Literacy', 'Analytical Skills', 'Problem Solving'],
      recommendedSeniorPath: 'STEM - Data Science & Analytics',
      universities: ['Strathmore', 'USIU', 'JKUAT', 'UoN', 'Multimedia University'],
      tvetOptions: ['NIBS Tech - Data Analytics', 'Nairobi Tech - AI Fundamentals'],
    },
    aiImpact: {
      disruptionRisk: 'low',
      disruptionPercentage: 20,
      growthOutlook: 'booming',
      growthPercentage: 250,
      timeline: {
        shortTerm: 'Explosive demand as Kenyan companies adopt data-driven decisions.',
        midTerm: 'AI builds basic models, but humans needed for strategy and ethics.',
        longTerm: 'Data governance, privacy, and ethical AI become critical roles.',
      },
      survivalStrategy: [
        'Master both technical skills AND business communication',
        'Specialize in industry verticals (fintech, health, agriculture)',
        'Focus on data ethics and explainable AI',
        'Build storytelling skills - translate data to decisions',
      ],
    },
    realityCheck: {
      pros: [
        'Cutting-edge field with constant innovation',
        'High demand, low supply of talent',
        'Can work across any industry',
        'Combination of math, tech, and business',
      ],
      challenges: [
        'Requires strong math and programming skills',
        'Fast-changing field - constant learning required',
        "Can be frustrating when business doesn't act on insights",
        'Need to explain complex concepts to non-technical people',
      ],
      typicalDay: 'Clean and analyze data, build predictive models, create visualizations, present findings to stakeholders, collaborate with engineers and business teams.',
    },
  },

  {
    id: 'civil_engineer',
    name: 'Civil Engineer / Infrastructure Specialist',
    pathway: 'STEM',
    kenyaShortageScore: 70,
    matchRequirements: {
      primarySubjects: ['mathematics', 'integrated_science'],
      minimumLevels: { mathematics: 4, integrated_science: 3 },
    },
    marketReality: {
      earningPotential: 'lucrative',
      jobSecurity: 'high',
      demandLevel: 'very_high',
      kenyanContext: "Massive infrastructure projects (roads, buildings, dams). Government, private contractors, Chinese firms all hiring. Can start own construction consultancy.",
    },
    cbeReadiness: {
      coreCompetencies: ['Problem Solving', 'Spatial Intelligence', 'Project Management', 'Attention to Detail'],
      recommendedSeniorPath: 'STEM - Engineering & Technology',
      universities: ['UoN', 'JKUAT', 'Moi University', 'Egerton', 'TUK'],
      tvetOptions: ['Kenya Institute of Highways', 'Mombasa Technical Training Institute'],
    },
    aiImpact: {
      disruptionRisk: 'low',
      disruptionPercentage: 25,
      growthOutlook: 'growing',
      growthPercentage: 90,
      timeline: {
        shortTerm: "Kenya's infrastructure boom continues (Vision 2030, Affordable Housing).",
        midTerm: 'AI assists design and planning, humans manage on-ground execution.',
        longTerm: 'Site judgment, safety, and stakeholder management remain human.',
      },
      survivalStrategy: [
        'Master BIM (Building Information Modeling) software',
        'Specialize in sustainable/green building',
        'Develop strong project management skills',
        'Get registered with Engineers Board of Kenya (EBK)',
      ],
    },
    realityCheck: {
      pros: [
        'See tangible results of your work (buildings, roads, bridges)',
        'Variety - office work and site visits',
        'Can own construction firm after experience',
        'Government and private sector opportunities',
      ],
      challenges: [
        'Site work can be physically demanding',
        'Dealing with contractors and deadlines stressful',
        'Weather-dependent work schedules',
        'Corruption in tender processes (ethical challenges)',
      ],
      typicalDay: 'Site inspections, design reviews, coordinate with contractors, solve on-site problems, prepare reports, attend project meetings, ensure safety compliance.',
    },
  },

  {
    id: 'agricultural_scientist',
    name: 'Agricultural Scientist / Agri-Tech Specialist',
    pathway: 'STEM',
    kenyaShortageScore: 75,
    matchRequirements: {
      primarySubjects: ['integrated_science', 'agriculture_nutrition'],
      minimumLevels: { integrated_science: 3, agriculture_nutrition: 3 },
    },
    marketReality: {
      earningPotential: 'lucrative',
      jobSecurity: 'very_high',
      demandLevel: 'very_high',
      kenyanContext: 'Kenya is agricultural. Food security is national priority. Tech-enabled farming (drones, IoT, precision agriculture) growing fast. Can be researcher, extension officer, or entrepreneur.',
    },
    cbeReadiness: {
      coreCompetencies: ['Innovation', 'Environmental Stewardship', 'Problem Solving', 'Entrepreneurship'],
      recommendedSeniorPath: 'STEM - Agriculture & Food Systems',
      universities: ['Egerton University', 'JKUAT', 'UoN', 'Moi University'],
      tvetOptions: ['Bukura Agricultural College', 'Embu University College'],
    },
    aiImpact: {
      disruptionRisk: 'very_low',
      disruptionPercentage: 10,
      growthOutlook: 'booming',
      growthPercentage: 200,
      timeline: {
        shortTerm: 'Climate change and food security create massive opportunity.',
        midTerm: 'Tech-enabled farming (drones, sensors, AI) becomes standard.',
        longTerm: 'Human expertise in local conditions and adaptation critical.',
      },
      survivalStrategy: [
        'Learn precision agriculture and IoT systems',
        'Study climate-resilient crops and techniques',
        'Combine traditional knowledge with modern tech',
        'Build agri-business and value-addition skills',
      ],
    },
    realityCheck: {
      pros: [
        'Solve real problems (hunger, poverty, sustainability)',
        'Work outdoors and in labs',
        'Can own profitable agri-business',
        'Government support for agriculture',
      ],
      challenges: [
        'Weather and climate unpredictability',
        'Dealing with conservative farmers resistant to change',
        'Initial capital for experiments/startups',
        'Rural work may require relocation',
      ],
      typicalDay: 'Field research, soil/crop testing, advise farmers, design irrigation systems, analyze data, write reports, conduct training sessions.',
    },
  },

  {
    id: 'pharmacist',
    name: 'Pharmacist',
    pathway: 'STEM',
    kenyaShortageScore: 72,
    matchRequirements: {
      primarySubjects: ['integrated_science', 'mathematics'],
      minimumLevels: { integrated_science: 4, mathematics: 3 },
    },
    marketReality: {
      earningPotential: 'lucrative',
      jobSecurity: 'very_high',
      demandLevel: 'high',
      kenyanContext: 'Every hospital, clinic, and pharmacy needs licensed pharmacists. Can own retail pharmacy. Growing demand for pharmaceutical consultants and researchers.',
    },
    cbeReadiness: {
      coreCompetencies: ['Attention to Detail', 'Communication', 'Ethical Decision Making', 'Analytical Skills'],
      recommendedSeniorPath: 'STEM - Biological Sciences',
      universities: ['UoN', 'KU', 'Mount Kenya University', 'JKUAT'],
      tvetOptions: [],
    },
    aiImpact: {
      disruptionRisk: 'low',
      disruptionPercentage: 15,
      growthOutlook: 'growing',
      growthPercentage: 70,
      timeline: {
        shortTerm: 'Steady demand, aging population needs more medication.',
        midTerm: 'AI assists drug interaction checking, but counseling stays human.',
        longTerm: 'Personalized medicine and patient care require human expertise.',
      },
      survivalStrategy: [
        'Specialize (clinical pharmacy, industrial pharmacy, research)',
        'Develop excellent patient counseling skills',
        'Stay updated on new medications and treatments',
        'Consider pharmaceutical manufacturing or research',
      ],
    },
    realityCheck: {
      pros: [
        'Direct patient interaction and helping people',
        'Can own profitable retail pharmacy',
        'Regular working hours (compared to doctors)',
        'Respected profession with good income',
      ],
      challenges: [
        'Long hours standing in retail pharmacies',
        'Dealing with difficult patients and insurance',
        'High responsibility - medication errors can be fatal',
        'Competitive retail pharmacy market in cities',
      ],
      typicalDay: 'Dispense medications, counsel patients on usage, check drug interactions, manage inventory, advise doctors on medications, ensure regulatory compliance.',
    },
  },

  {
    id: 'architect',
    name: 'Architect / Building Designer',
    pathway: 'STEM',
    kenyaShortageScore: 60,
    matchRequirements: {
      primarySubjects: ['mathematics', 'creative_arts_sports'],
      minimumLevels: { mathematics: 3, creative_arts_sports: 3 },
    },
    marketReality: {
      earningPotential: 'very_lucrative',
      jobSecurity: 'moderate',
      demandLevel: 'high',
      kenyanContext: 'Real estate boom creates demand. Affordable housing projects, commercial buildings, renovation market. Can start own firm. Competitive but lucrative for good designers.',
    },
    cbeReadiness: {
      coreCompetencies: ['Creativity', 'Spatial Intelligence', 'Problem Solving', 'Attention to Detail'],
      recommendedSeniorPath: 'STEM - Engineering & Design',
      universities: ['UoN', 'JKUAT', 'TUK - Technical University of Kenya'],
      tvetOptions: ['Kenya Polytechnic', 'Mombasa Polytechnic'],
    },
    aiImpact: {
      disruptionRisk: 'moderate',
      disruptionPercentage: 40,
      growthOutlook: 'growing',
      growthPercentage: 65,
      timeline: {
        shortTerm: 'AI generates basic floor plans, but creativity and client needs require humans.',
        midTerm: "Architects who use AI tools will outcompete those who don't.",
        longTerm: 'Cultural context, sustainability, and human-centered design stay human.',
      },
      survivalStrategy: [
        'Master AI design tools (Midjourney, parametric design)',
        'Focus on sustainable and green architecture',
        'Develop strong client relationship skills',
        'Specialize in a niche (heritage, eco-design, smart buildings)',
      ],
    },
    realityCheck: {
      pros: [
        'Creative and technical work combined',
        'See your designs become reality',
        'Can build own successful firm',
        'Work on diverse projects',
      ],
      challenges: [
        'Long education and apprenticeship period',
        'Dealing with contractors and clients can be stressful',
        'Projects can be delayed or cancelled',
        'Competitive field - need strong portfolio',
      ],
      typicalDay: 'Meet clients, create design concepts, use CAD software, coordinate with engineers, visit construction sites, prepare presentations, manage budgets.',
    },
  },

  {
    id: 'environmental_scientist',
    name: 'Environmental Scientist / Conservationist',
    pathway: 'STEM',
    kenyaShortageScore: 62,
    matchRequirements: {
      primarySubjects: ['integrated_science', 'social_studies'],
      minimumLevels: { integrated_science: 3, social_studies: 3 },
    },
    marketReality: {
      earningPotential: 'moderate',
      jobSecurity: 'high',
      demandLevel: 'high',
      kenyanContext: 'Climate change makes this critical. NGOs, NEMA, KWS, research institutions hiring. Growing corporate ESG (environmental, social, governance) roles.',
    },
    cbeReadiness: {
      coreCompetencies: ['Environmental Stewardship', 'Critical Thinking', 'Research Skills', 'Communication'],
      recommendedSeniorPath: 'STEM - Environmental Science',
      universities: ['Egerton', 'KU', 'UoN', 'Moi University'],
      tvetOptions: ['Kenya Wildlife Service Training Institute'],
    },
    aiImpact: {
      disruptionRisk: 'very_low',
      disruptionPercentage: 10,
      growthOutlook: 'booming',
      growthPercentage: 150,
      timeline: {
        shortTerm: 'Climate crisis accelerates demand for environmental experts.',
        midTerm: 'AI helps data analysis, but field work and policy require humans.',
        longTerm: 'Community engagement and conservation leadership stay human.',
      },
      survivalStrategy: [
        'Combine science with policy and advocacy',
        'Learn GIS and environmental modeling tools',
        'Build community engagement skills',
        'Specialize (water, wildlife, renewable energy, waste management)',
      ],
    },
    realityCheck: {
      pros: [
        'Meaningful work protecting planet',
        'Work outdoors and in field',
        'Can work with wildlife and nature',
        'Growing field with job security',
      ],
      challenges: [
        'Pay lower than engineering/medicine initially',
        'Can be frustrating dealing with politics/bureaucracy',
        'Field work can be physically demanding',
        'Remote locations for some roles',
      ],
      typicalDay: 'Environmental impact assessments, field data collection, lab analysis, write reports, advise on conservation, coordinate with communities and government.',
    },
  },

  {
    id: 'electrical_engineer',
    name: 'Electrical Engineer / Power Systems Specialist',
    pathway: 'STEM',
    kenyaShortageScore: 78,
    matchRequirements: {
      primarySubjects: ['mathematics', 'integrated_science'],
      minimumLevels: { mathematics: 4, integrated_science: 4 },
    },
    marketReality: {
      earningPotential: 'very_lucrative',
      jobSecurity: 'very_high',
      demandLevel: 'very_high',
      kenyanContext: 'Power infrastructure expansion (Last Mile Connectivity, renewable energy). KPLC, REA, private contractors, manufacturing companies all need electrical engineers.',
    },
    cbeReadiness: {
      coreCompetencies: ['Problem Solving', 'Critical Thinking', 'Safety Consciousness', 'Innovation'],
      recommendedSeniorPath: 'STEM - Engineering & Technology',
      universities: ['UoN', 'JKUAT', 'Moi University', 'TUK'],
      tvetOptions: ['Kenya Power Training School', 'Eldoret Polytechnic'],
    },
    aiImpact: {
      disruptionRisk: 'low',
      disruptionPercentage: 20,
      growthOutlook: 'booming',
      growthPercentage: 120,
      timeline: {
        shortTerm: 'Renewable energy transition creates massive opportunities.',
        midTerm: 'Smart grids and automation require electrical engineers.',
        longTerm: 'Hands-on installation and safety oversight stay human.',
      },
      survivalStrategy: [
        'Specialize in renewable energy (solar, wind)',
        'Learn automation and control systems',
        'Master power system design software',
        'Get professional engineering license (EBK)',
      ],
    },
    realityCheck: {
      pros: [
        'Critical infrastructure work',
        'Good job security',
        'Can work across industries',
        'Opportunity in renewable energy boom',
      ],
      challenges: [
        'High-risk work environment (electricity)',
        'Emergency call-outs at odd hours',
        'Physically demanding site work',
        'High responsibility for safety',
      ],
      typicalDay: 'Design electrical systems, supervise installations, troubleshoot power issues, ensure safety compliance, coordinate with contractors, prepare technical drawings.',
    },
  },

  {
    id: 'veterinarian',
    name: 'Veterinary Doctor',
    pathway: 'STEM',
    kenyaShortageScore: 65,
    matchRequirements: {
      primarySubjects: ['integrated_science', 'agriculture_nutrition'],
      minimumLevels: { integrated_science: 4, agriculture_nutrition: 3 },
    },
    marketReality: {
      earningPotential: 'lucrative',
      jobSecurity: 'high',
      demandLevel: 'high',
      kenyanContext: 'Livestock is huge in Kenya. Private clinics, government, NGOs, pharmaceutical companies. Can specialize in pets (urban) or livestock (rural). Growing pet ownership in cities.',
    },
    cbeReadiness: {
      coreCompetencies: ['Empathy', 'Problem Solving', 'Manual Dexterity', 'Communication'],
      recommendedSeniorPath: 'STEM - Biological Sciences',
      universities: ['UoN', 'Egerton University'],
      tvetOptions: [],
    },
    aiImpact: {
      disruptionRisk: 'very_low',
      disruptionPercentage: 5,
      growthOutlook: 'growing',
      growthPercentage: 80,
      timeline: {
        shortTerm: 'Increasing pet ownership and livestock investments.',
        midTerm: 'AI helps diagnosis, but treatment stays hands-on.',
        longTerm: 'Animal handling and surgery remain human-dependent.',
      },
      survivalStrategy: [
        'Specialize (small animals, large animals, exotic)',
        'Build strong client relationships',
        'Stay updated on veterinary medicine advances',
        'Consider pharmaceutical or research roles',
      ],
    },
    realityCheck: {
      pros: [
        'Work with animals (if you love them!)',
        'Can own profitable clinic',
        'Variety - pets, livestock, wildlife',
        'Respected profession',
      ],
      challenges: [
        'Emotional toll (euthanasia, sick animals)',
        'Physically demanding (restraining animals)',
        'Irregular hours (emergencies)',
        'Dealing with difficult pet owners',
      ],
      typicalDay: 'Examine animals, diagnose conditions, perform surgeries, prescribe medications, advise owners, conduct vaccinations, manage clinic operations.',
    },
  },

  {
    id: 'cybersecurity_analyst',
    name: 'Cybersecurity Analyst',
    pathway: 'STEM',
    kenyaShortageScore: 82,
    matchRequirements: {
      primarySubjects: ['mathematics', 'integrated_science'],
      minimumLevels: { mathematics: 3, integrated_science: 3 },
    },
    marketReality: {
      earningPotential: 'very_lucrative',
      jobSecurity: 'very_high',
      demandLevel: 'very_high',
      kenyanContext: 'Banks, telcos, government all under cyberattack. Massive shortage of skilled professionals. Can work remotely for international firms. Fastest growing tech specialization in EA.',
    },
    cbeReadiness: {
      coreCompetencies: ['Critical Thinking', 'Digital Literacy', 'Problem Solving', 'Ethical Awareness'],
      recommendedSeniorPath: 'STEM - Computer Science & ICT',
      universities: ['UoN', 'Strathmore', 'KCA University', 'JKUAT'],
      tvetOptions: ['Zetech College', 'NIBS Tech'],
    },
    aiImpact: {
      disruptionRisk: 'low',
      disruptionPercentage: 15,
      growthOutlook: 'booming',
      growthPercentage: 220,
      timeline: {
        shortTerm: 'AI creates new attack vectors — demand for defenders rising fast.',
        midTerm: 'Automated threat detection needs humans to interpret and respond.',
        longTerm: 'Human creativity in adversarial thinking irreplaceable.',
      },
      survivalStrategy: [
        'Get certified (CISSP, CEH, CompTIA Security+)',
        'Specialize in cloud security or ethical hacking',
        'AI creates new attack vectors — humans needed to defend',
        'Build bug bounty portfolio on HackerOne',
      ],
    },
    realityCheck: {
      pros: ['Job security', 'High pay', 'Can work remotely', 'Always in demand'],
      challenges: ['Constant learning', 'High stress', 'Irregular hours', 'Heavy responsibility'],
      typicalDay: 'Monitor network threats, respond to incidents, conduct penetration testing, advise on security policies, patch vulnerabilities, train staff on security awareness.',
    },
  },

  {
    id: 'ux_ui_designer',
    name: 'UX/UI Designer',
    pathway: 'STEM',
    kenyaShortageScore: 65,
    matchRequirements: {
      primarySubjects: ['creative_arts_sports', 'mathematics'],
      minimumLevels: { creative_arts_sports: 3, mathematics: 2 },
    },
    marketReality: {
      earningPotential: 'lucrative',
      jobSecurity: 'high',
      demandLevel: 'very_high',
      kenyanContext: 'Every app and website needs UX. Fintech boom (M-PESA, banking apps) driving massive demand. Can freelance globally. Nairobi design scene growing fast with iHub, Nailab.',
    },
    cbeReadiness: {
      coreCompetencies: ['Creativity', 'Digital Literacy', 'Critical Thinking', 'Communication'],
      recommendedSeniorPath: 'STEM - Computer Science & Design',
      universities: ['Multimedia University', 'USIU', 'Strathmore', 'Kenyatta'],
      tvetOptions: ['NIBS', 'Nairobi Institute of Technology'],
    },
    aiImpact: {
      disruptionRisk: 'moderate',
      disruptionPercentage: 35,
      growthOutlook: 'booming',
      growthPercentage: 160,
      timeline: {
        shortTerm: 'Fintech boom drives unprecedented UX demand in Nairobi.',
        midTerm: 'AI generates wireframes — UX researchers become more valuable.',
        longTerm: 'Human empathy and user research irreplaceable.',
      },
      survivalStrategy: [
        'Master AI design tools (Figma AI, Midjourney)',
        "Focus on user research — AI can't talk to users",
        'Specialize in fintech or healthtech UX',
        'Build strong portfolio on Behance/Dribbble',
      ],
    },
    realityCheck: {
      pros: ['Creative + technical', 'Remote work possible', 'High demand', 'Diverse projects'],
      challenges: ['Constant revision cycles', 'Subjective feedback', 'Need to justify design decisions', 'Fast-changing tools'],
      typicalDay: 'User research, wireframing, prototyping in Figma, usability testing, presenting to stakeholders, iterating on feedback.',
    },
  },

  {
    id: 'renewable_energy_engineer',
    name: 'Renewable Energy Engineer',
    pathway: 'STEM',
    kenyaShortageScore: 85,
    matchRequirements: {
      primarySubjects: ['mathematics', 'integrated_science'],
      minimumLevels: { mathematics: 4, integrated_science: 3 },
    },
    marketReality: {
      earningPotential: 'very_lucrative',
      jobSecurity: 'very_high',
      demandLevel: 'very_high',
      kenyanContext: 'Kenya leads Africa in renewable energy (geothermal, solar, wind). Last Mile Connectivity, rural solar boom. KenGen, KPLC, solar companies all hiring. Government priority sector.',
    },
    cbeReadiness: {
      coreCompetencies: ['Problem Solving', 'Innovation', 'Environmental Stewardship', 'Critical Thinking'],
      recommendedSeniorPath: 'STEM - Engineering & Technology',
      universities: ['JKUAT', 'UoN', 'TUK', 'Moi University'],
      tvetOptions: ['Kenya Power Training School', 'Eldoret National Polytechnic'],
    },
    aiImpact: {
      disruptionRisk: 'very_low',
      disruptionPercentage: 8,
      growthOutlook: 'booming',
      growthPercentage: 190,
      timeline: {
        shortTerm: 'Government renewable energy projects create massive hiring wave.',
        midTerm: 'Solar and storage technology advancement requires engineers.',
        longTerm: 'Site work, safety, and grid management stay human.',
      },
      survivalStrategy: [
        'Specialize in solar installation and maintenance',
        'Learn energy storage systems (batteries)',
        'Get certified by Energy Regulatory Commission',
        'Combine engineering with project management',
      ],
    },
    realityCheck: {
      pros: ['Future-proof career', 'Government support', 'Meaningful environmental impact', 'Good pay'],
      challenges: ['Field work in remote areas', 'Project delays', 'Government bureaucracy', 'Weather-dependent'],
      typicalDay: 'Site assessments, system design, supervise installations, troubleshoot faults, coordinate with contractors, prepare technical reports, client training.',
    },
  },

  {
    id: 'drone_pilot_gis',
    name: 'Drone Pilot / GIS Specialist',
    pathway: 'STEM',
    kenyaShortageScore: 70,
    matchRequirements: {
      primarySubjects: ['mathematics', 'social_studies'],
      minimumLevels: { mathematics: 3, social_studies: 3 },
    },
    marketReality: {
      earningPotential: 'lucrative',
      jobSecurity: 'high',
      demandLevel: 'high',
      kenyanContext: 'Surveying, agriculture, construction, conservation all using drones. Survey of Kenya, county governments, NGOs hiring. New frontier with few qualified professionals. KCAA licensing required.',
    },
    cbeReadiness: {
      coreCompetencies: ['Digital Literacy', 'Spatial Intelligence', 'Problem Solving', 'Attention to Detail'],
      recommendedSeniorPath: 'STEM - Geospatial & Environmental Science',
      universities: ['Survey of Kenya Training Institute', 'UoN - Surveying', 'JKUAT'],
      tvetOptions: ['Kenya Aeronautical College', 'Nairobi Aviation College'],
    },
    aiImpact: {
      disruptionRisk: 'low',
      disruptionPercentage: 20,
      growthOutlook: 'booming',
      growthPercentage: 175,
      timeline: {
        shortTerm: 'Every county government starting GIS mapping projects.',
        midTerm: 'Autonomous drones need pilots for oversight and maintenance.',
        longTerm: 'Data interpretation and field operations stay human.',
      },
      survivalStrategy: [
        'Get KCAA Remote Pilot License',
        'Learn GIS software (ArcGIS, QGIS)',
        'Specialize in a sector (agriculture, construction, wildlife)',
        'Build portfolio of aerial surveys and maps',
      ],
    },
    realityCheck: {
      pros: ['Exciting cutting-edge work', 'Few competitors', 'Work outdoors', 'Growing field'],
      challenges: ['Weather dependent', 'Strict regulations', 'Expensive equipment', 'Rural deployment'],
      typicalDay: 'Flight planning, drone operations, data collection, GIS data processing, create maps and reports, coordinate with clients and ground teams.',
    },
  },

  {
    id: 'actuary',
    name: 'Actuary',
    pathway: 'STEM',
    kenyaShortageScore: 92,
    matchRequirements: {
      primarySubjects: ['mathematics', 'social_studies'],
      minimumLevels: { mathematics: 4, social_studies: 3 },
    },
    marketReality: {
      earningPotential: 'exceptional',
      jobSecurity: 'very_high',
      demandLevel: 'very_high',
      kenyanContext: 'Nairobi is East Africa insurance capital. Every insurance company needs actuaries. Very few qualified professionals in Kenya — severe shortage. IRA requires actuarial certification for insurance companies.',
    },
    cbeReadiness: {
      coreCompetencies: ['Analytical Thinking', 'Critical Thinking', 'Attention to Detail', 'Problem Solving'],
      recommendedSeniorPath: 'STEM - Mathematics & Statistics',
      universities: ['UoN', 'Strathmore', 'USIU', 'KU'],
      tvetOptions: [],
    },
    aiImpact: {
      disruptionRisk: 'moderate',
      disruptionPercentage: 30,
      growthOutlook: 'growing',
      growthPercentage: 85,
      timeline: {
        shortTerm: 'Severe shortage means immediate employment for qualified actuaries.',
        midTerm: 'AI handles routine calculations; actuaries focus on complex modeling.',
        longTerm: 'Strategic risk advisory and regulatory oversight stay human.',
      },
      survivalStrategy: [
        'Complete professional exams (IFoA, SOA, CAS)',
        'Combine with data science skills',
        'Specialize (life, health, pension, general insurance)',
        'Move into risk management and consulting',
      ],
    },
    realityCheck: {
      pros: ['Exceptional pay', 'High prestige', 'Severe talent shortage', 'Stable'],
      challenges: ['Very difficult professional exams', 'Years of study alongside work', 'Complex mathematical work', 'High responsibility'],
      typicalDay: 'Statistical modeling, pricing insurance products, reserving calculations, risk assessment, regulatory reporting, advising management on financial risk.',
    },
  },

  {
    id: 'quantity_surveyor',
    name: 'Quantity Surveyor',
    pathway: 'STEM',
    kenyaShortageScore: 65,
    matchRequirements: {
      primarySubjects: ['mathematics', 'pre_technical_studies'],
      minimumLevels: { mathematics: 3, pre_technical_studies: 3 },
    },
    marketReality: {
      earningPotential: 'lucrative',
      jobSecurity: 'high',
      demandLevel: 'very_high',
      kenyanContext: 'Construction boom (affordable housing, infrastructure) driving demand. Every building project needs a QS. Government, private contractors, consulting firms all hiring. Can start own practice.',
    },
    cbeReadiness: {
      coreCompetencies: ['Attention to Detail', 'Analytical Thinking', 'Problem Solving', 'Communication'],
      recommendedSeniorPath: 'STEM - Engineering & Construction',
      universities: ['UoN', 'TUK', 'Moi University', 'JKUAT'],
      tvetOptions: ['Kenya Polytechnic', 'Mombasa Technical Training Institute'],
    },
    aiImpact: {
      disruptionRisk: 'moderate',
      disruptionPercentage: 30,
      growthOutlook: 'growing',
      growthPercentage: 80,
      timeline: {
        shortTerm: 'Affordable housing agenda creates massive QS demand.',
        midTerm: 'BIM software assists cost planning; judgment stays human.',
        longTerm: 'Dispute resolution and complex project management irreplaceable.',
      },
      survivalStrategy: [
        'Get registered with BORAQS (Board of Registration)',
        'Learn BIM (Building Information Modeling)',
        'Specialize in government or large infrastructure',
        'Develop dispute resolution and arbitration skills',
      ],
    },
    realityCheck: {
      pros: ['Good pay', 'Stable demand', 'Can own firm', 'Variety of projects'],
      challenges: ['Contractor disputes stressful', 'Site visits in tough conditions', 'Payment delays common', 'Tight project deadlines'],
      typicalDay: 'Cost estimation, bills of quantities, tender evaluation, contract management, site measurements, valuations, final accounts preparation.',
    },
  },

  {
    id: 'digital_health_specialist',
    name: 'Digital Health Specialist',
    pathway: 'STEM',
    kenyaShortageScore: 70,
    matchRequirements: {
      primarySubjects: ['integrated_science', 'mathematics'],
      minimumLevels: { integrated_science: 3, mathematics: 3 },
    },
    marketReality: {
      earningPotential: 'very_lucrative',
      jobSecurity: 'high',
      demandLevel: 'high',
      kenyanContext: 'Telemedicine, health apps, digital records all growing post-COVID. WHO, MOH, NGOs, private health tech companies hiring. Combines health and tech uniquely. Remote work possible for international orgs.',
    },
    cbeReadiness: {
      coreCompetencies: ['Digital Literacy', 'Critical Thinking', 'Communication', 'Innovation'],
      recommendedSeniorPath: 'STEM - Health Informatics',
      universities: ['KU', 'UoN', 'Aga Khan University', 'USIU'],
      tvetOptions: ['Kenya Medical Training College (KMTC)'],
    },
    aiImpact: {
      disruptionRisk: 'low',
      disruptionPercentage: 20,
      growthOutlook: 'booming',
      growthPercentage: 140,
      timeline: {
        shortTerm: 'Post-COVID telemedicine adoption accelerates across Kenya.',
        midTerm: 'AI diagnostics need human oversight and patient communication.',
        longTerm: 'Health data governance and ethics require human specialists.',
      },
      survivalStrategy: [
        'Get both health and tech qualifications',
        'Learn health informatics and EMR systems',
        'Understand health data privacy (HIPAA, Kenya Data Act)',
        'Specialize in telemedicine or AI diagnostics',
      ],
    },
    realityCheck: {
      pros: ['Meaningful impact on health outcomes', 'Combines two growing fields', 'International opportunities', 'Remote work possible'],
      challenges: ['Requires dual expertise', 'Complex regulations', 'Slow adoption in rural areas', 'Interoperability challenges'],
      typicalDay: 'Design health information systems, analyze patient data, implement telemedicine platforms, train healthcare workers on digital tools, ensure data security and compliance.',
    },
  },

  // ── Arts & Sports (11 careers) ─────────────────────────────

  {
    id: 'creative_director',
    name: 'Creative Director / Brand Strategist',
    pathway: 'Arts & Sports',
    kenyaShortageScore: 42,
    matchRequirements: {
      primarySubjects: ['creative_arts_sports', 'english'],
      minimumLevels: { creative_arts_sports: 3, english: 3 },
    },
    marketReality: {
      earningPotential: 'lucrative',
      jobSecurity: 'moderate',
      demandLevel: 'high',
      kenyanContext: 'Every brand needs creative strategy. Advertising agencies, corporates, startups. Can freelance or start own agency. Nairobi creative scene growing fast.',
    },
    cbeReadiness: {
      coreCompetencies: ['Creativity', 'Communication', 'Cultural Awareness', 'Critical Thinking'],
      recommendedSeniorPath: 'Arts & Sports - Visual & Performing Arts',
      universities: ['Kenyatta University', 'USIU', 'Daystar', 'Multimedia University'],
      tvetOptions: ['Nairobi Institute of Business Studies (NIBS)', 'Kenya Institute of Mass Communication'],
    },
    aiImpact: {
      disruptionRisk: 'moderate',
      disruptionPercentage: 35,
      growthOutlook: 'growing',
      growthPercentage: 85,
      timeline: {
        shortTerm: 'AI generates images/copy, but strategy requires human insight.',
        midTerm: 'Creatives who embrace AI tools will dominate.',
        longTerm: 'Cultural nuance and emotional storytelling stay human.',
      },
      survivalStrategy: [
        'Master AI creative tools (Midjourney, ChatGPT, Runway)',
        'Focus on strategy and concept over execution',
        'Build personal brand and thought leadership',
        'Develop business acumen - creativity + commerce',
      ],
    },
    realityCheck: {
      pros: [
        'Exciting, dynamic work environment',
        'See your ideas become campaigns',
        'Can build successful agency',
        'Work with diverse brands and industries',
      ],
      challenges: [
        'Tight deadlines and client pressure',
        'Subjective work - dealing with criticism',
        'Competitive field - need strong portfolio',
        'Irregular income if freelancing',
      ],
      typicalDay: 'Brainstorm campaigns, present concepts to clients, manage design team, review creative work, track industry trends, pitch for new business.',
    },
  },

  {
    id: 'journalist',
    name: 'Journalist / Content Creator',
    pathway: 'Arts & Sports',
    kenyaShortageScore: 40,
    matchRequirements: {
      primarySubjects: ['english', 'kiswahili'],
      minimumLevels: { english: 3, kiswahili: 3 },
    },
    marketReality: {
      earningPotential: 'moderate',
      jobSecurity: 'moderate',
      demandLevel: 'moderate',
      kenyanContext: 'Traditional media struggling, but digital content booming. YouTube, podcasts, blogs, social media. Can work for media houses or be independent content creator.',
    },
    cbeReadiness: {
      coreCompetencies: ['Communication', 'Critical Thinking', 'Digital Literacy', 'Ethical Awareness'],
      recommendedSeniorPath: 'Arts & Sports - Languages & Communication',
      universities: ['Daystar', 'USIU', 'Multimedia University', 'Maseno University'],
      tvetOptions: ['Kenya Institute of Mass Communication (KIMC)', 'Nairobi Aviation College'],
    },
    aiImpact: {
      disruptionRisk: 'high',
      disruptionPercentage: 55,
      growthOutlook: 'stable',
      growthPercentage: 30,
      timeline: {
        shortTerm: 'AI writes basic news, but investigation and storytelling need humans.',
        midTerm: 'Shift to multimedia (video, podcasts, social media).',
        longTerm: 'Trust and authentic voices matter - human connection wins.',
      },
      survivalStrategy: [
        'Build personal brand - become the story',
        'Master video and multimedia production',
        'Develop investigative and data journalism skills',
        'Create niche expertise (politics, tech, sports, etc.)',
      ],
    },
    realityCheck: {
      pros: [
        'Tell important stories, impact society',
        'Meet interesting people',
        'Variety - no two days the same',
        'Can build large following as influencer',
      ],
      challenges: [
        'Lower pay in traditional media',
        'Irregular hours, working weekends',
        'Stressful deadlines',
        'Online harassment and trolling',
      ],
      typicalDay: 'Research stories, conduct interviews, write articles/scripts, edit content, manage social media, attend press conferences, pitch story ideas.',
    },
  },

  {
    id: 'musician',
    name: 'Professional Musician / Music Producer',
    pathway: 'Arts & Sports',
    kenyaShortageScore: 20,
    matchRequirements: {
      primarySubjects: ['creative_arts_sports'],
      minimumLevels: { creative_arts_sports: 3 },
    },
    marketReality: {
      earningPotential: 'very_lucrative',
      jobSecurity: 'low',
      demandLevel: 'moderate',
      kenyanContext: 'Kenyan music industry growing (Gengetone, Afrobeats). Multiple income streams: performances, streaming, production, teaching. Highly competitive but rewarding for talented.',
    },
    cbeReadiness: {
      coreCompetencies: ['Creativity', 'Discipline', 'Collaboration', 'Entrepreneurship'],
      recommendedSeniorPath: 'Arts & Sports - Performing Arts',
      universities: ['Kenyatta University - Music', 'Daystar - Music Production'],
      tvetOptions: ['Sauti Academy', 'Bomas of Kenya Music School'],
    },
    aiImpact: {
      disruptionRisk: 'moderate',
      disruptionPercentage: 40,
      growthOutlook: 'growing',
      growthPercentage: 75,
      timeline: {
        shortTerm: 'AI generates beats and melodies, but hits need human creativity.',
        midTerm: 'Musicians who use AI production tools will have advantage.',
        longTerm: 'Live performances and authentic artistry irreplaceable.',
      },
      survivalStrategy: [
        'Learn music production AND performance',
        'Build strong social media presence',
        'Diversify income (teaching, licensing, production)',
        'Master digital distribution and marketing',
      ],
    },
    realityCheck: {
      pros: [
        'Do what you love (if passionate about music)',
        'Creative freedom',
        'Potential for fame and high earnings',
        'Multiple income streams',
      ],
      challenges: [
        "Very competitive, many don't make it",
        'Unstable income, especially starting out',
        'Requires thick skin (criticism, rejection)',
        'Need business skills to succeed',
      ],
      typicalDay: 'Practice instrument/vocals, write songs, record in studio, promote on social media, network with industry, perform at gigs, negotiate deals.',
    },
  },

  {
    id: 'athlete',
    name: 'Professional Athlete / Sports Coach',
    pathway: 'Arts & Sports',
    kenyaShortageScore: 15,
    matchRequirements: {
      primarySubjects: ['creative_arts_sports'],
      minimumLevels: { creative_arts_sports: 4 },
    },
    marketReality: {
      earningPotential: 'exceptional',
      jobSecurity: 'low',
      demandLevel: 'moderate',
      kenyanContext: 'Kenya dominates distance running. Football, rugby, basketball growing. Short career, so need transition plan. Coaching and sports management are stable alternatives.',
    },
    cbeReadiness: {
      coreCompetencies: ['Discipline', 'Resilience', 'Teamwork', 'Goal Setting'],
      recommendedSeniorPath: 'Arts & Sports - Physical Education',
      universities: ['Kenyatta University - Sports Science', 'Moi University', 'Egerton'],
      tvetOptions: ['Kenya Academy of Sports', 'Coast Institute of Technology'],
    },
    aiImpact: {
      disruptionRisk: 'very_low',
      disruptionPercentage: 5,
      growthOutlook: 'stable',
      growthPercentage: 40,
      timeline: {
        shortTerm: 'AI helps training optimization, but performance is human.',
        midTerm: 'Sports science and data analysis grow.',
        longTerm: 'Human athleticism and competition irreplaceable.',
      },
      survivalStrategy: [
        'Get sports science education alongside training',
        'Plan for life after playing (coaching, management)',
        'Build personal brand during peak years',
        'Invest earnings wisely',
      ],
    },
    realityCheck: {
      pros: [
        'Represent Kenya globally',
        'Top athletes earn very well',
        'Do what you love (if passionate)',
        'Build lasting fame',
      ],
      challenges: [
        'Extremely competitive',
        'Injury can end career suddenly',
        'Short career span (usually 10-15 years)',
        'Need discipline and sacrifice',
      ],
      typicalDay: 'Intense training sessions, diet management, physiotherapy, strategy meetings with coaches, competitions, recovery and rest, sponsor obligations.',
    },
  },

  {
    id: 'interior_designer',
    name: 'Interior Designer / Space Planner',
    pathway: 'Arts & Sports',
    kenyaShortageScore: 42,
    matchRequirements: {
      primarySubjects: ['creative_arts_sports', 'mathematics'],
      minimumLevels: { creative_arts_sports: 3, mathematics: 2 },
    },
    marketReality: {
      earningPotential: 'lucrative',
      jobSecurity: 'moderate',
      demandLevel: 'high',
      kenyanContext: 'Real estate boom drives demand. Homes, offices, hotels, restaurants all need designers. Can start own firm. Growing middle class wants nice interiors.',
    },
    cbeReadiness: {
      coreCompetencies: ['Creativity', 'Spatial Intelligence', 'Attention to Detail', 'Client Management'],
      recommendedSeniorPath: 'Arts & Sports - Visual Arts & Design',
      universities: ['UoN - Architecture Interior option', 'Daystar', 'USIU'],
      tvetOptions: ['Kenya Institute of Interior Design', 'Nairobi Technical Training Institute'],
    },
    aiImpact: {
      disruptionRisk: 'moderate',
      disruptionPercentage: 35,
      growthOutlook: 'growing',
      growthPercentage: 70,
      timeline: {
        shortTerm: 'AI generates mood boards, but client taste is personal.',
        midTerm: 'Designers who use AI visualization tools win more clients.',
        longTerm: 'Understanding client psychology and space functionality stay human.',
      },
      survivalStrategy: [
        'Master 3D visualization software',
        'Build strong portfolio and social media',
        'Develop excellent client communication',
        'Specialize (luxury, sustainable, minimalist, etc.)',
      ],
    },
    realityCheck: {
      pros: [
        'Creative and practical work',
        'See transformations you create',
        'Can build profitable business',
        'Work with variety of clients',
      ],
      challenges: [
        'Dealing with demanding clients',
        'Managing budgets and contractors',
        'Competitive market',
        'Need business skills to succeed',
      ],
      typicalDay: 'Meet clients, create design concepts, source furniture/materials, coordinate with contractors, visit sites, manage projects, maintain supplier relationships.',
    },
  },

  {
    id: 'film_director',
    name: 'Film Director / Video Producer',
    pathway: 'Arts & Sports',
    kenyaShortageScore: 38,
    matchRequirements: {
      primarySubjects: ['creative_arts_sports', 'english'],
      minimumLevels: { creative_arts_sports: 3, english: 3 },
    },
    marketReality: {
      earningPotential: 'lucrative',
      jobSecurity: 'moderate',
      demandLevel: 'high',
      kenyanContext: 'Kenyan film/TV industry growing (Riverwood). Corporate videos, ads, YouTube content booming. Netflix, Showmax commissioning local content. Can freelance or start production company.',
    },
    cbeReadiness: {
      coreCompetencies: ['Creativity', 'Leadership', 'Storytelling', 'Technical Skills'],
      recommendedSeniorPath: 'Arts & Sports - Film & Media Production',
      universities: ['USIU', 'Daystar', 'Multimedia University', 'Kenyatta'],
      tvetOptions: ['Kenya Institute of Mass Communication', 'Film School Kenya'],
    },
    aiImpact: {
      disruptionRisk: 'moderate',
      disruptionPercentage: 30,
      growthOutlook: 'booming',
      growthPercentage: 120,
      timeline: {
        shortTerm: 'Content demand exploding (streaming, social media).',
        midTerm: 'AI assists editing and effects, but storytelling stays human.',
        longTerm: 'Direction, performance, and cultural narratives remain human.',
      },
      survivalStrategy: [
        'Master AI editing and effects tools',
        'Develop strong storytelling skills',
        'Build production and business skills',
        'Create unique voice/style',
      ],
    },
    realityCheck: {
      pros: [
        'Creative fulfillment',
        'Tell Kenyan stories to world',
        'Growing industry opportunities',
        'Can become famous/influential',
      ],
      challenges: [
        'Project-based income (feast or famine)',
        'Long, irregular hours',
        'High equipment costs initially',
        'Competitive field',
      ],
      typicalDay: 'Develop scripts, plan shoots, direct actors/crew, edit footage, pitch projects, manage budgets, coordinate with clients, market your work.',
    },
  },

  {
    id: 'graphic_designer',
    name: 'Graphic Designer / Visual Communicator',
    pathway: 'Arts & Sports',
    kenyaShortageScore: 45,
    matchRequirements: {
      primarySubjects: ['creative_arts_sports', 'english'],
      minimumLevels: { creative_arts_sports: 3, english: 2 },
    },
    marketReality: {
      earningPotential: 'moderate',
      jobSecurity: 'moderate',
      demandLevel: 'high',
      kenyanContext: 'Every business needs design. Agencies, corporates, NGOs, startups. Easy to freelance globally. Nairobi has vibrant design scene. Can work remotely for international clients.',
    },
    cbeReadiness: {
      coreCompetencies: ['Creativity', 'Digital Literacy', 'Visual Communication', 'Attention to Detail'],
      recommendedSeniorPath: 'Arts & Sports - Visual Arts',
      universities: ['UoN', 'Kenyatta', 'USIU', 'Daystar'],
      tvetOptions: ['NIBS', 'Nairobi Institute of Technology', 'Kenya School of Professional Studies'],
    },
    aiImpact: {
      disruptionRisk: 'high',
      disruptionPercentage: 60,
      growthOutlook: 'stable',
      growthPercentage: 45,
      timeline: {
        shortTerm: 'AI generates basic designs, threatening junior designers.',
        midTerm: 'Designers who use AI as tool will dominate.',
        longTerm: 'Strategic design thinking and brand expertise stay valuable.',
      },
      survivalStrategy: [
        'Master AI tools (Midjourney, Adobe Firefly, etc.)',
        'Move from execution to strategy (senior roles)',
        'Specialize (motion graphics, UX/UI, branding)',
        'Build strong portfolio and personal brand',
      ],
    },
    realityCheck: {
      pros: [
        'Creative work daily',
        'Can work remotely/freelance',
        'Diverse projects',
        'Relatively easy to start (laptop + skills)',
      ],
      challenges: [
        'Competitive and saturated market',
        'Client revisions can be frustrating',
        'Pressure to constantly learn new tools',
        'Lower pay for junior designers',
      ],
      typicalDay: 'Create designs (logos, posters, social media, packaging), revise based on feedback, communicate with clients, research trends, manage multiple projects.',
    },
  },

  {
    id: 'event_planner',
    name: 'Event Planner / Hospitality Manager',
    pathway: 'Arts & Sports',
    kenyaShortageScore: 40,
    matchRequirements: {
      primarySubjects: ['social_studies', 'creative_arts_sports'],
      minimumLevels: { social_studies: 3, creative_arts_sports: 2 },
    },
    marketReality: {
      earningPotential: 'lucrative',
      jobSecurity: 'moderate',
      demandLevel: 'high',
      kenyanContext: 'Kenyans love events (weddings, corporate, conferences). Growing middle class spending on celebrations. Tourism and hospitality recovering. Can start own events company.',
    },
    cbeReadiness: {
      coreCompetencies: ['Organization', 'Communication', 'Creativity', 'Problem Solving'],
      recommendedSeniorPath: 'Arts & Sports - Hospitality',
      universities: ['Kenyatta - Hospitality', 'USIU', 'Moi University', 'Multimedia'],
      tvetOptions: ['Kenya Utalii College', 'Nairobi Aviation College'],
    },
    aiImpact: {
      disruptionRisk: 'low',
      disruptionPercentage: 20,
      growthOutlook: 'growing',
      growthPercentage: 80,
      timeline: {
        shortTerm: 'Events are social and human-centered.',
        midTerm: 'AI helps logistics, but client relationship is key.',
        longTerm: 'Personal touch and crisis management stay human.',
      },
      survivalStrategy: [
        'Use tech for efficiency (booking systems, design tools)',
        'Build strong vendor network',
        'Develop niche (corporate, weddings, international)',
        'Excellent client service and reputation',
      ],
    },
    realityCheck: {
      pros: [
        'Exciting, social work',
        'See immediate results',
        'Can build profitable business',
        'Meet diverse people',
      ],
      challenges: [
        'High stress (everything must be perfect)',
        'Long hours, including weekends/nights',
        'Dealing with difficult clients',
        'Seasonal income fluctuations',
      ],
      typicalDay: 'Meet clients, plan event details, coordinate vendors, visit venues, manage budgets, solve problems, oversee event execution, handle crises.',
    },
  },

  {
    id: 'fashion_designer',
    name: 'Fashion Designer / Textile Entrepreneur',
    pathway: 'Arts & Sports',
    kenyaShortageScore: 35,
    matchRequirements: {
      primarySubjects: ['creative_arts_sports'],
      minimumLevels: { creative_arts_sports: 3 },
    },
    marketReality: {
      earningPotential: 'lucrative',
      jobSecurity: 'moderate',
      demandLevel: 'moderate',
      kenyanContext: 'Kenyan fashion growing internationally. Local designers gaining recognition. Wedding, corporate, African print market growing. Export opportunities to diaspora. Social media enables direct sales.',
    },
    cbeReadiness: {
      coreCompetencies: ['Creativity', 'Entrepreneurship', 'Cultural Awareness', 'Attention to Detail'],
      recommendedSeniorPath: 'Arts & Sports - Visual Arts & Design',
      universities: ['Kenyatta University', 'USIU', 'Nairobi Fashion Institute'],
      tvetOptions: ['Kenya Textile Training Institute', 'Utalii College - Fashion', 'Various polytechnics'],
    },
    aiImpact: {
      disruptionRisk: 'low',
      disruptionPercentage: 18,
      growthOutlook: 'growing',
      growthPercentage: 75,
      timeline: {
        shortTerm: 'African fashion gaining international recognition and export markets.',
        midTerm: 'AI assists pattern design; human creativity drives collections.',
        longTerm: 'Unique cultural identity and craftsmanship irreplaceable.',
      },
      survivalStrategy: [
        'Build strong social media presence (Instagram, TikTok)',
        'Focus on uniquely Kenyan/African identity',
        'Master both design AND business/marketing',
        'Explore sustainable and ethical fashion',
      ],
    },
    realityCheck: {
      pros: ['Creative freedom', 'Can start small', 'Growing local appreciation', 'Export opportunities'],
      challenges: ['Irregular income especially starting', 'Sourcing quality materials challenging', 'Copying and counterfeit issues', 'Need business skills'],
      typicalDay: 'Design new collections, source fabrics, supervise tailors, meet clients for fittings, marketing on social media, manage orders, attend fashion events.',
    },
  },

  {
    id: 'sports_manager',
    name: 'Sports Manager / Athlete Agent',
    pathway: 'Arts & Sports',
    kenyaShortageScore: 35,
    matchRequirements: {
      primarySubjects: ['creative_arts_sports', 'social_studies'],
      minimumLevels: { creative_arts_sports: 3, social_studies: 3 },
    },
    marketReality: {
      earningPotential: 'very_lucrative',
      jobSecurity: 'moderate',
      demandLevel: 'moderate',
      kenyanContext: 'Kenyan athletes world class (Kipchoge, Chemutai). Football, rugby, athletics growing. Sports marketing, sponsorships, events all need managers. Can manage international athletes and earn in foreign currency.',
    },
    cbeReadiness: {
      coreCompetencies: ['Communication', 'Entrepreneurship', 'Leadership', 'Negotiation'],
      recommendedSeniorPath: 'Arts & Sports - Sports Science & Management',
      universities: ['Kenyatta University - Sports Management', 'Moi University', 'USIU'],
      tvetOptions: ['Kenya Academy of Sports'],
    },
    aiImpact: {
      disruptionRisk: 'very_low',
      disruptionPercentage: 8,
      growthOutlook: 'growing',
      growthPercentage: 90,
      timeline: {
        shortTerm: 'Global recognition of Kenyan athletes opens international management opportunities.',
        midTerm: 'Sports analytics tools assist; relationships and negotiation stay human.',
        longTerm: 'Athlete welfare and career planning require human judgment.',
      },
      survivalStrategy: [
        'Build network with athletes, clubs, sponsors early',
        'Get sports law and contract knowledge',
        'Specialize in one sport (athletics, football, rugby)',
        'Develop international connections for athlete placement',
      ],
    },
    realityCheck: {
      pros: ['Exciting sports environment', 'International travel', 'High earning if managing top athletes', 'Growing industry'],
      challenges: ['Irregular income especially starting', 'Athlete careers are short', 'Demanding clients', 'Competitive field'],
      typicalDay: 'Negotiate contracts and sponsorships, manage athlete schedules, coordinate with clubs, marketing and PR, attend competitions, financial planning for athletes.',
    },
  },

  {
    id: 'animator_game_developer',
    name: 'Animator / Game Developer',
    pathway: 'Arts & Sports',
    kenyaShortageScore: 45,
    matchRequirements: {
      primarySubjects: ['creative_arts_sports', 'mathematics'],
      minimumLevels: { creative_arts_sports: 3, mathematics: 2 },
    },
    marketReality: {
      earningPotential: 'lucrative',
      jobSecurity: 'moderate',
      demandLevel: 'high',
      kenyanContext: 'Global remote work enables Kenyan animators to work for international studios. African-themed games growing market. Advertising industry needs animation. YouTube content creation booming. Can earn in USD.',
    },
    cbeReadiness: {
      coreCompetencies: ['Creativity', 'Digital Literacy', 'Problem Solving', 'Storytelling'],
      recommendedSeniorPath: 'Arts & Sports - Digital Media & Animation',
      universities: ['Multimedia University', 'USIU', 'Kenyatta'],
      tvetOptions: ['Nairobi Institute of Technology', 'iHub programs', 'Online (Coursera, Unity)'],
    },
    aiImpact: {
      disruptionRisk: 'moderate',
      disruptionPercentage: 40,
      growthOutlook: 'booming',
      growthPercentage: 130,
      timeline: {
        shortTerm: 'African-themed games and content see international demand growth.',
        midTerm: 'AI speeds animation; concept art and direction stay creative.',
        longTerm: 'Cultural storytelling and game design require human creativity.',
      },
      survivalStrategy: [
        'Specialize in African/Kenyan cultural content',
        'Learn AI animation tools as competitive advantage',
        'Build portfolio on ArtStation and YouTube',
        'Target international remote studios',
      ],
    },
    realityCheck: {
      pros: ['Creative work', 'Remote work globally', 'Growing industry', 'Can freelance'],
      challenges: ['Portfolio takes years to build', 'Competitive global market', 'AI disrupting basic animation', 'Irregular freelance income'],
      typicalDay: 'Create character animations, design game levels, code game mechanics, render scenes, collaborate with writers and musicians, test gameplay, pitch to clients.',
    },
  },

  // ── Social Sciences (12 careers) ───────────────────────────

  {
    id: 'lawyer',
    name: 'Lawyer / Legal Advocate',
    pathway: 'Social Sciences',
    kenyaShortageScore: 60,
    matchRequirements: {
      primarySubjects: ['english', 'social_studies'],
      minimumLevels: { english: 4, social_studies: 3 },
    },
    marketReality: {
      earningPotential: 'very_lucrative',
      jobSecurity: 'high',
      demandLevel: 'high',
      kenyanContext: 'Always in demand. Can work in law firms, corporate, government, or private practice. Competitive but lucrative. Long education but respected profession.',
    },
    cbeReadiness: {
      coreCompetencies: ['Critical Thinking', 'Communication', 'Ethical Decision Making', 'Research Skills'],
      recommendedSeniorPath: 'Social Sciences - Law & Governance',
      universities: ['UoN', 'Moi University', 'Kenyatta', 'USIU', 'Strathmore'],
      tvetOptions: [],
    },
    aiImpact: {
      disruptionRisk: 'moderate',
      disruptionPercentage: 40,
      growthOutlook: 'stable',
      growthPercentage: 35,
      timeline: {
        shortTerm: 'AI assists research and document drafting.',
        midTerm: 'Routine contracts automated, complex litigation stays human.',
        longTerm: 'Advocacy, negotiation, and client relationships irreplaceable.',
      },
      survivalStrategy: [
        'Specialize (corporate, human rights, IP, etc.)',
        'Embrace legal tech tools',
        'Develop strong courtroom and negotiation skills',
        'Build reputation and client base',
      ],
    },
    realityCheck: {
      pros: [
        'Intellectual and challenging work',
        'High earning potential',
        'Respected profession',
        'Can fight for justice',
      ],
      challenges: [
        'Very long education (6+ years)',
        'Highly competitive',
        'Long hours, high stress',
        'Dealing with difficult/emotional cases',
      ],
      typicalDay: 'Client consultations, legal research, draft documents, court appearances, negotiations, case strategy, manage paralegals, continuing legal education.',
    },
  },

  {
    id: 'accountant_cpa',
    name: 'Accountant (CPA) / Financial Analyst',
    pathway: 'Social Sciences',
    kenyaShortageScore: 65,
    matchRequirements: {
      primarySubjects: ['mathematics', 'social_studies'],
      minimumLevels: { mathematics: 3, social_studies: 3 },
    },
    marketReality: {
      earningPotential: 'lucrative',
      jobSecurity: 'high',
      demandLevel: 'very_high',
      kenyanContext: 'Every organization needs accountants. Big 4 firms, banks, corporates, government, SMEs. CPA qualification is gold standard. Stable career with clear progression.',
    },
    cbeReadiness: {
      coreCompetencies: ['Analytical Thinking', 'Attention to Detail', 'Ethical Decision Making', 'Problem Solving'],
      recommendedSeniorPath: 'Social Sciences - Commerce & Finance',
      universities: ['Strathmore', 'KCA University', 'USIU', 'UoN', 'Kenyatta'],
      tvetOptions: ['Kenya School of Accountancy', 'Nairobi Institute of Business Studies'],
    },
    aiImpact: {
      disruptionRisk: 'high',
      disruptionPercentage: 65,
      growthOutlook: 'stable',
      growthPercentage: 20,
      timeline: {
        shortTerm: 'Bookkeeping and basic tasks automated.',
        midTerm: 'Tax and compliance increasingly automated.',
        longTerm: 'Strategic advisory, forensics, and complex analysis stay human.',
      },
      survivalStrategy: [
        'Specialize in high-value areas (forensic, strategic CFO work)',
        'Master financial analysis, not just compliance',
        'Develop business advisory skills',
        'Learn data analytics and financial modeling',
      ],
    },
    realityCheck: {
      pros: [
        'Clear career path and qualifications',
        'Good job security',
        'Work across any industry',
        'Respected profession',
      ],
      challenges: [
        'Studying for CPA while working is tough',
        'Can be repetitive work',
        'Busy seasons (audit, tax deadlines)',
        'AI disrupting traditional roles',
      ],
      typicalDay: 'Prepare financial statements, analyze data, conduct audits, advise management, ensure compliance, manage budgets, prepare reports.',
    },
  },

  {
    id: 'teacher',
    name: 'Teacher / Education Specialist',
    pathway: 'Social Sciences',
    kenyaShortageScore: 70,
    matchRequirements: {
      primarySubjects: ['english', 'kiswahili'],
      minimumLevels: { english: 3, kiswahili: 3 },
    },
    marketReality: {
      earningPotential: 'lower_but_stable',
      jobSecurity: 'very_high',
      demandLevel: 'very_high',
      kenyanContext: 'CBC rollout creates demand. Government (TSC) guaranteed employment. Private schools pay better. Can become principal/education officer. Very secure but lower pay than other professions.',
    },
    cbeReadiness: {
      coreCompetencies: ['Communication', 'Empathy', 'Patience', 'Leadership'],
      recommendedSeniorPath: 'Social Sciences - Education',
      universities: ['Kenyatta University', 'Moi University', 'Egerton', 'Maseno', 'KU'],
      tvetOptions: ['Teacher Training Colleges (TTCs) nationwide'],
    },
    aiImpact: {
      disruptionRisk: 'very_low',
      disruptionPercentage: 5,
      growthOutlook: 'stable',
      growthPercentage: 40,
      timeline: {
        shortTerm: 'CBC creates need for more trained teachers.',
        midTerm: 'AI becomes teaching assistant, not replacement.',
        longTerm: 'Human mentorship, empathy, and discipline stay critical.',
      },
      survivalStrategy: [
        'Embrace educational technology',
        'Specialize (special needs, gifted students, CBC training)',
        'Develop curriculum design skills',
        'Pursue school leadership roles',
      ],
    },
    realityCheck: {
      pros: [
        'Very stable employment (TSC)',
        'Holidays aligned with school calendar',
        'Shape young minds',
        'Respected in community',
      ],
      challenges: [
        'Lower pay compared to other professions',
        'Large class sizes in public schools',
        'Dealing with difficult students/parents',
        'Heavy workload (marking, planning)',
      ],
      typicalDay: 'Prepare lessons, teach classes, mark assignments, manage classroom discipline, parent meetings, staff meetings, extracurricular activities.',
    },
  },

  {
    id: 'social_worker',
    name: 'Social Worker / Community Development Officer',
    pathway: 'Social Sciences',
    kenyaShortageScore: 55,
    matchRequirements: {
      primarySubjects: ['social_studies', 'english'],
      minimumLevels: { social_studies: 3, english: 3 },
    },
    marketReality: {
      earningPotential: 'moderate',
      jobSecurity: 'high',
      demandLevel: 'high',
      kenyanContext: "NGOs, government, hospitals, children's homes all need social workers. Meaningful work but moderate pay. Growing field as Kenya addresses social issues.",
    },
    cbeReadiness: {
      coreCompetencies: ['Empathy', 'Communication', 'Problem Solving', 'Cultural Awareness'],
      recommendedSeniorPath: 'Social Sciences - Social Work & Community Development',
      universities: ['UoN', 'Kenyatta', 'Moi University', 'Catholic University'],
      tvetOptions: ['Kenya Institute of Social Work'],
    },
    aiImpact: {
      disruptionRisk: 'very_low',
      disruptionPercentage: 5,
      growthOutlook: 'growing',
      growthPercentage: 70,
      timeline: {
        shortTerm: 'Social challenges create demand for social workers.',
        midTerm: 'AI helps data/case management, but fieldwork stays human.',
        longTerm: 'Empathy, counseling, and community work irreplaceable.',
      },
      survivalStrategy: [
        'Specialize (child protection, mental health, community development)',
        'Develop counseling and conflict resolution skills',
        'Learn program design and grant writing',
        'Build strong community relationships',
      ],
    },
    realityCheck: {
      pros: [
        'Meaningful work helping vulnerable',
        'Variety of settings (hospitals, NGOs, government)',
        'Strong job security',
        'Personal fulfillment',
      ],
      challenges: [
        'Emotionally draining work',
        'Moderate pay in NGO sector',
        'Dealing with difficult cases',
        'Bureaucracy in government roles',
      ],
      typicalDay: 'Meet clients, assess needs, connect to resources, write case reports, conduct home visits, coordinate with agencies, advocate for clients.',
    },
  },

  {
    id: 'human_resources',
    name: 'Human Resources Manager',
    pathway: 'Social Sciences',
    kenyaShortageScore: 50,
    matchRequirements: {
      primarySubjects: ['social_studies', 'english'],
      minimumLevels: { social_studies: 3, english: 3 },
    },
    marketReality: {
      earningPotential: 'lucrative',
      jobSecurity: 'high',
      demandLevel: 'high',
      kenyanContext: 'Every company needs HR. From recruitment to employee relations. Can work corporate, consulting, or government. Clear career progression to senior management.',
    },
    cbeReadiness: {
      coreCompetencies: ['Communication', 'Conflict Resolution', 'Empathy', 'Organization'],
      recommendedSeniorPath: 'Social Sciences - Business & Management',
      universities: ['Strathmore', 'USIU', 'KCA', 'Kenyatta', 'UoN'],
      tvetOptions: ['Kenya Institute of Management', 'Nairobi Institute of Business Studies'],
    },
    aiImpact: {
      disruptionRisk: 'moderate',
      disruptionPercentage: 45,
      growthOutlook: 'stable',
      growthPercentage: 40,
      timeline: {
        shortTerm: 'Recruitment tools automate screening.',
        midTerm: 'Payroll and admin increasingly automated.',
        longTerm: 'Employee relations, culture, and leadership development stay human.',
      },
      survivalStrategy: [
        'Focus on strategic HR, not admin tasks',
        'Develop talent development and coaching skills',
        'Learn HR analytics and people data',
        'Master change management and org development',
      ],
    },
    realityCheck: {
      pros: [
        'Work with people daily',
        'Strategic role in organization',
        'Good work-life balance',
        'Clear career progression',
      ],
      challenges: [
        'Caught between management and employees',
        'Dealing with conflicts and difficult people',
        'Sometimes blamed for unpopular decisions',
        'Administrative burden in small companies',
      ],
      typicalDay: 'Recruitment interviews, employee relations issues, policy development, training coordination, performance management, payroll oversight, strategic planning.',
    },
  },

  {
    id: 'psychologist',
    name: 'Psychologist / Counselor',
    pathway: 'Social Sciences',
    kenyaShortageScore: 58,
    matchRequirements: {
      primarySubjects: ['social_studies', 'english'],
      minimumLevels: { social_studies: 3, english: 3 },
    },
    marketReality: {
      earningPotential: 'lucrative',
      jobSecurity: 'high',
      demandLevel: 'high',
      kenyanContext: "Mental health awareness growing. Schools, hospitals, corporates, private practice all need psychologists. Still stigma but changing. Growing field with good prospects.",
    },
    cbeReadiness: {
      coreCompetencies: ['Empathy', 'Communication', 'Critical Thinking', 'Ethical Awareness'],
      recommendedSeniorPath: 'Social Sciences - Psychology & Counseling',
      universities: ['UoN', 'Kenyatta', 'USIU', 'Daystar', 'Catholic University'],
      tvetOptions: ['Counseling training institutes'],
    },
    aiImpact: {
      disruptionRisk: 'very_low',
      disruptionPercentage: 10,
      growthOutlook: 'booming',
      growthPercentage: 140,
      timeline: {
        shortTerm: 'Mental health crisis increases demand.',
        midTerm: 'AI chatbots for basic support, but therapy stays human.',
        longTerm: 'Human connection and empathy irreplaceable in healing.',
      },
      survivalStrategy: [
        'Get proper licensure and credentials',
        'Specialize (clinical, educational, organizational)',
        'Build strong therapeutic skills',
        'Combine traditional and modern approaches',
      ],
    },
    realityCheck: {
      pros: [
        'Help people through difficult times',
        'Intellectually stimulating',
        'Can have private practice',
        'Growing field in Kenya',
      ],
      challenges: [
        'Emotionally demanding work',
        'Dealing with severe mental health issues',
        "Carrying clients' burdens",
        'Need own therapy/supervision',
      ],
      typicalDay: 'Client sessions, assessment and diagnosis, develop treatment plans, take notes, coordinate with other professionals, continuing education.',
    },
  },

  {
    id: 'diplomat',
    name: 'Diplomat / Foreign Affairs Officer',
    pathway: 'Social Sciences',
    kenyaShortageScore: 45,
    matchRequirements: {
      primarySubjects: ['english', 'social_studies'],
      minimumLevels: { english: 4, social_studies: 3 },
    },
    marketReality: {
      earningPotential: 'very_lucrative',
      jobSecurity: 'very_high',
      demandLevel: 'moderate',
      kenyanContext: 'Kenya is EA diplomatic hub with most UN agencies in Africa. Ministry of Foreign Affairs, embassies, UN bodies all need officers. Prestigious career with international postings and benefits.',
    },
    cbeReadiness: {
      coreCompetencies: ['Communication', 'Cultural Awareness', 'Critical Thinking', 'Ethical Decision Making'],
      recommendedSeniorPath: 'Social Sciences - Law & Governance',
      universities: ['UoN', 'USIU', 'Kenyatta', 'Strathmore School of Law'],
      tvetOptions: [],
    },
    aiImpact: {
      disruptionRisk: 'very_low',
      disruptionPercentage: 5,
      growthOutlook: 'stable',
      growthPercentage: 30,
      timeline: {
        shortTerm: "Kenya's regional leadership role grows, more diplomatic posts needed.",
        midTerm: 'AI assists research and translation; negotiations stay human.',
        longTerm: 'Relationship-building and cultural intelligence irreplaceable.',
      },
      survivalStrategy: [
        'Learn multiple languages (French, Mandarin, Arabic)',
        'Build expertise in international law and trade',
        'Network through Model UN and international forums',
        'Specialize in trade, peace, or climate diplomacy',
      ],
    },
    realityCheck: {
      pros: ['International postings and travel', 'Prestigious career', 'Good benefits', 'Influence on national policy'],
      challenges: ['Very competitive entry', 'Postings away from family', 'Political changes affect careers', 'Slow bureaucratic progression'],
      typicalDay: 'Represent Kenya in negotiations, prepare diplomatic cables and reports, attend international meetings, support Kenyan citizens abroad, analyze foreign policy developments.',
    },
  },

  {
    id: 'tourism_safari_manager',
    name: 'Tourism & Safari Manager',
    pathway: 'Social Sciences',
    kenyaShortageScore: 50,
    matchRequirements: {
      primarySubjects: ['social_studies', 'english'],
      minimumLevels: { social_studies: 3, english: 3 },
    },
    marketReality: {
      earningPotential: 'lucrative',
      jobSecurity: 'moderate',
      demandLevel: 'high',
      kenyanContext: "Tourism is Kenya's top forex earner. Safari, eco-tourism, beach tourism all recovering post-COVID. Hotels, tour companies, KWS, conservancies all hiring. Can start own tour company. Seasonal but high-earning.",
    },
    cbeReadiness: {
      coreCompetencies: ['Communication', 'Cultural Awareness', 'Entrepreneurship', 'Environmental Stewardship'],
      recommendedSeniorPath: 'Social Sciences - Hospitality & Tourism',
      universities: ['Kenya Utalii College', 'KU', 'Moi University', 'Multimedia University'],
      tvetOptions: ['Kenya Utalii College (diploma)', 'Various hospitality colleges'],
    },
    aiImpact: {
      disruptionRisk: 'very_low',
      disruptionPercentage: 10,
      growthOutlook: 'booming',
      growthPercentage: 110,
      timeline: {
        shortTerm: 'Post-COVID tourism recovery brings record visitor numbers.',
        midTerm: 'Digital marketing skills become essential for tour operators.',
        longTerm: 'Authentic human experiences drive tourism growth.',
      },
      survivalStrategy: [
        'Learn digital marketing for tourism',
        'Build relationships with international operators',
        'Specialize (luxury, eco-tourism, cultural tourism)',
        'Get Kenya Professional Safari Guide certification',
      ],
    },
    realityCheck: {
      pros: ['Work in beautiful locations', 'Meet international visitors', 'Can own tour company', 'Good income in peak season'],
      challenges: ['Seasonal income fluctuations', 'Security issues affect bookings', 'Physically demanding guiding', 'Weather-dependent'],
      typicalDay: 'Plan itineraries, meet and guide tourists, coordinate with lodges and airlines, social media marketing, manage bookings, ensure safety, handle client complaints.',
    },
  },

  {
    id: 'supply_chain_manager',
    name: 'Supply Chain & Logistics Manager',
    pathway: 'Social Sciences',
    kenyaShortageScore: 72,
    matchRequirements: {
      primarySubjects: ['mathematics', 'social_studies'],
      minimumLevels: { mathematics: 3, social_studies: 3 },
    },
    marketReality: {
      earningPotential: 'lucrative',
      jobSecurity: 'high',
      demandLevel: 'very_high',
      kenyanContext: 'Mombasa Port is East Africa gateway. Nairobi is regional hub. SGR, LAPPSET corridor all need logistics experts. Manufacturing, retail, agriculture all need supply chain managers. Very high demand, low supply of qualified people.',
    },
    cbeReadiness: {
      coreCompetencies: ['Analytical Thinking', 'Problem Solving', 'Organization', 'Communication'],
      recommendedSeniorPath: 'Social Sciences - Business & Commerce',
      universities: ['JKUAT', 'Strathmore', 'KCA', 'Kenyatta', 'USIU'],
      tvetOptions: ['Kenya Institute of Management', 'Chartered Institute of Procurement & Supply (CIPS)'],
    },
    aiImpact: {
      disruptionRisk: 'moderate',
      disruptionPercentage: 35,
      growthOutlook: 'growing',
      growthPercentage: 95,
      timeline: {
        shortTerm: 'Regional trade growth creates urgent need for logistics experts.',
        midTerm: 'AI optimizes routes and inventory; human judgment manages exceptions.',
        longTerm: 'Crisis management and supplier relationships stay human.',
      },
      survivalStrategy: [
        'Get CIPS or APICS professional certification',
        'Learn supply chain software (SAP, Oracle)',
        'Specialize in cold chain or humanitarian logistics',
        'Develop supplier relationship management skills',
      ],
    },
    realityCheck: {
      pros: ['High demand', 'Good pay', 'Critical role in any industry', 'International opportunities'],
      challenges: ['High pressure when things go wrong', 'Complex coordination challenges', 'Corruption in procurement', 'Irregular hours during crises'],
      typicalDay: 'Manage supplier relationships, monitor inventory levels, coordinate transport, negotiate contracts, analyze costs, solve disruptions, prepare reports.',
    },
  },

  {
    id: 'insurance_specialist',
    name: 'Insurance Specialist / Underwriter',
    pathway: 'Social Sciences',
    kenyaShortageScore: 60,
    matchRequirements: {
      primarySubjects: ['mathematics', 'social_studies'],
      minimumLevels: { mathematics: 3, social_studies: 3 },
    },
    marketReality: {
      earningPotential: 'lucrative',
      jobSecurity: 'very_high',
      demandLevel: 'very_high',
      kenyanContext: 'Nairobi is East and Central Africa insurance capital. Every major African insurer has regional HQ here. IRA requires licensed professionals. Growing middle class buying more insurance. Stable, well-paying career.',
    },
    cbeReadiness: {
      coreCompetencies: ['Analytical Thinking', 'Attention to Detail', 'Ethical Decision Making', 'Communication'],
      recommendedSeniorPath: 'Social Sciences - Commerce & Finance',
      universities: ['College of Insurance', 'UoN', 'Strathmore', 'KCA University'],
      tvetOptions: ['College of Insurance (diploma)', 'Kenya School of Insurance'],
    },
    aiImpact: {
      disruptionRisk: 'high',
      disruptionPercentage: 55,
      growthOutlook: 'stable',
      growthPercentage: 35,
      timeline: {
        shortTerm: 'Steady demand as insurance penetration grows in Kenya.',
        midTerm: 'AI automates routine underwriting; complex risk assessment stays human.',
        longTerm: 'Emerging risks (cyber, climate) need human expertise.',
      },
      survivalStrategy: [
        'Get ACII (Associate Chartered Insurance Institute)',
        'Move to complex risk assessment AI cannot do',
        'Develop client relationship and advisory skills',
        'Specialize in emerging risks (cyber, climate)',
      ],
    },
    realityCheck: {
      pros: ['Stable well-paying career', 'Clear professional qualifications', 'Multiple sectors to work in', 'Good benefits packages'],
      challenges: ['AI disrupting routine underwriting', 'Dealing with fraud cases', 'Complex regulations', 'Claims disputes stressful'],
      typicalDay: 'Assess insurance applications, price risk, underwrite policies, review claims, advise brokers and clients, ensure regulatory compliance, analyze loss ratios.',
    },
  },

  {
    id: 'urban_planner',
    name: 'Urban Planner / City Development Officer',
    pathway: 'Social Sciences',
    kenyaShortageScore: 68,
    matchRequirements: {
      primarySubjects: ['social_studies', 'mathematics'],
      minimumLevels: { social_studies: 3, mathematics: 3 },
    },
    marketReality: {
      earningPotential: 'lucrative',
      jobSecurity: 'high',
      demandLevel: 'high',
      kenyanContext: 'Rapid urbanization (Nairobi, Mombasa, Kisumu, Eldoret all expanding fast). County governments, national government, World Bank projects all need planners. Affordable housing agenda creates demand. Growing field as cities need smart planning.',
    },
    cbeReadiness: {
      coreCompetencies: ['Spatial Intelligence', 'Critical Thinking', 'Communication', 'Environmental Stewardship'],
      recommendedSeniorPath: 'Social Sciences - Geography & Urban Studies',
      universities: ['UoN', 'JKUAT', 'TUK', 'Moi University'],
      tvetOptions: ['Kenya Institute of Planners'],
    },
    aiImpact: {
      disruptionRisk: 'low',
      disruptionPercentage: 20,
      growthOutlook: 'growing',
      growthPercentage: 85,
      timeline: {
        shortTerm: 'All 47 counties urgently need urban planners for land use.',
        midTerm: 'AI assists spatial analysis; community engagement stays human.',
        longTerm: 'Policy interpretation and political navigation require humans.',
      },
      survivalStrategy: [
        'Get registered with Physical Planners Registration Board',
        'Learn GIS and urban modeling software',
        'Specialize in smart cities or affordable housing',
        'Develop community engagement skills',
      ],
    },
    realityCheck: {
      pros: ['Shape how cities grow', 'Government and private opportunities', 'Meaningful impact on peoples lives', 'Stable career'],
      challenges: ['Bureaucratic processes slow', 'Political interference in planning', 'Informal settlements complex to manage', 'Public resistance to change'],
      typicalDay: 'Develop land use plans, conduct site visits, community consultations, prepare planning reports, review development applications, coordinate with engineers and architects.',
    },
  },

  {
    id: 'economist',
    name: 'Economist / Policy Analyst',
    pathway: 'Social Sciences',
    kenyaShortageScore: 55,
    matchRequirements: {
      primarySubjects: ['mathematics', 'social_studies'],
      minimumLevels: { mathematics: 4, social_studies: 3 },
    },
    marketReality: {
      earningPotential: 'very_lucrative',
      jobSecurity: 'high',
      demandLevel: 'moderate',
      kenyanContext: 'Government, Central Bank, research institutions, international organizations (World Bank, IMF). Highly intellectual work. Good pay and influence on policy.',
    },
    cbeReadiness: {
      coreCompetencies: ['Analytical Thinking', 'Critical Thinking', 'Research Skills', 'Communication'],
      recommendedSeniorPath: 'Social Sciences - Economics & Statistics',
      universities: ['UoN', 'Kenyatta', 'Strathmore', 'USIU', 'Egerton'],
      tvetOptions: [],
    },
    aiImpact: {
      disruptionRisk: 'moderate',
      disruptionPercentage: 35,
      growthOutlook: 'stable',
      growthPercentage: 45,
      timeline: {
        shortTerm: 'AI assists data analysis and forecasting.',
        midTerm: 'Routine modeling automated.',
        longTerm: 'Policy interpretation, context, and recommendations stay human.',
      },
      survivalStrategy: [
        'Master econometrics and data science',
        'Develop strong communication skills',
        'Specialize (development, monetary policy, trade)',
        'Combine quantitative skills with policy understanding',
      ],
    },
    realityCheck: {
      pros: [
        'Influence national policy',
        'Intellectually challenging',
        'Respected profession',
        'Good work environment',
      ],
      challenges: [
        'Requires advanced degrees (Masters/PhD)',
        'Can be abstract/theoretical',
        'Frustration when policy ignored',
        'Competitive for top positions',
      ],
      typicalDay: 'Economic research, data analysis, forecast modeling, write policy briefs, present findings, advise government/organizations, publish papers.',
    },
  },
]

// ============================================================
// SECTION 6 — KENYA DISRUPTION ASSESSMENTS (static lookup)
// ============================================================

const KENYA_DISRUPTION: Record<string, KenyaDisruptionAssessment> = {
  software_engineer: {
    level: 'evolving', timelineYears: 8,
    kenyaReason: 'AI tools like GitHub Copilot assist Kenyan developers but create MORE jobs — Nairobi tech sector growing 40% annually. Junior devs need to move up the stack faster.',
    humanAdvantages: ['System architecture judgment', 'Business context understanding', 'Client communication', 'Ethical AI decisions'],
    adaptationAdvice: 'Learn AI/ML tools now — be the engineer who builds with AI, not the one replaced by it.',
    globalVsKenya: 'Globally 45% automation risk, but Kenyan market context means demand for engineers keeps growing for 8+ years.',
  },
  medical_doctor: {
    level: 'protected', timelineYears: 25,
    kenyaReason: 'Kenya has 1 doctor per 10,000 people vs WHO recommended 1 per 1,000. AI diagnosis tools will assist but cannot replace the massive shortage of human doctors. Rural Kenya needs doctors urgently.',
    humanAdvantages: ['Physical examination', 'Patient empathy', 'Complex diagnosis', 'Surgical procedures', 'Community trust'],
    adaptationAdvice: 'Embrace AI diagnostic tools as assistants — they will make you a better, faster doctor.',
    globalVsKenya: 'Globally low AI risk; in Kenya the shortage is so severe this career is completely safe for 25+ years.',
  },
  data_scientist: {
    level: 'resilient', timelineYears: 12,
    kenyaReason: 'Severe shortage in Kenya — banks, telcos, and government all desperate for data talent. AI automates routine analysis but Kenyan business context and stakeholder communication require human expertise.',
    humanAdvantages: ['Business context translation', 'Stakeholder communication', 'Ethical AI oversight', 'Domain expertise'],
    adaptationAdvice: 'Master the business side of data science — technical skills are table stakes, interpretation is the edge.',
    globalVsKenya: 'Globally 20% AI risk; Kenya\'s severe shortage means this role is safe and growing for 12+ years locally.',
  },
  civil_engineer: {
    level: 'resilient', timelineYears: 15,
    kenyaReason: 'Kenya\'s infrastructure deficit is massive — roads, water, housing. The construction boom driven by Vision 2030 and Affordable Housing program means thousands of engineer positions will be unfilled for over a decade.',
    humanAdvantages: ['On-site judgment', 'Safety oversight', 'Community negotiation', 'Local terrain knowledge'],
    adaptationAdvice: 'Learn BIM and digital construction tools — engineers who master them will lead projects, not just execute.',
    globalVsKenya: 'Globally 25% risk; Kenya\'s infrastructure backlog protects this career locally for 15+ years.',
  },
  agricultural_scientist: {
    level: 'protected', timelineYears: 20,
    kenyaReason: 'Kenya is 70% agricultural. Climate change threatens food security, creating urgent demand for agricultural scientists who understand local soil, crops, and farming communities. This role cannot be automated.',
    humanAdvantages: ['Local crop knowledge', 'Farmer trust building', 'Field adaptation', 'Cultural food systems'],
    adaptationAdvice: 'Combine traditional farming knowledge with precision agriculture tech — the hybrid expert wins.',
    globalVsKenya: 'Globally 10% risk; Kenya\'s food security imperative makes this career protected for 20+ years.',
  },
  pharmacist: {
    level: 'resilient', timelineYears: 12,
    kenyaReason: 'Kenya has millions of SMEs and informal businesses that need pharmacists who understand local drug supply, KRA requirements, and can counsel in Swahili. Urban retail pharmacies are booming.',
    humanAdvantages: ['Patient counseling', 'Local drug knowledge', 'Prescription validation', 'Community health advice'],
    adaptationAdvice: 'Move toward clinical pharmacy and patient counseling — the parts AI cannot automate.',
    globalVsKenya: 'Globally 15% risk; Kenyan pharmacy sector growth and licensing requirements keep this safe for 12+ years.',
  },
  architect: {
    level: 'evolving', timelineYears: 8,
    kenyaReason: 'Kenyan architects competing locally face different pressures than global market. AI design tools are tools, not replacements — yet. Architects who master AI tools will command premium rates. Nairobi\'s real estate boom is real.',
    humanAdvantages: ['Client relationship management', 'Cultural design sensitivity', 'Site feasibility judgment', 'Kenya building code expertise'],
    adaptationAdvice: 'Master AI design tools (Midjourney, parametric design) now — they will be your competitive edge.',
    globalVsKenya: 'Globally 40% risk; Kenya\'s construction boom means local demand keeps architects busy for 8+ years.',
  },
  environmental_scientist: {
    level: 'protected', timelineYears: 20,
    kenyaReason: 'Climate change is Kenya\'s biggest threat — drought, flooding, desertification. NEMA, KWS, NGOs and corporate ESG all need environmental scientists who understand Kenya\'s unique ecosystems. This demand will only grow.',
    humanAdvantages: ['Community engagement', 'Field data collection', 'Local ecosystem knowledge', 'Policy advocacy'],
    adaptationAdvice: 'Learn GIS and environmental modeling tools — combine field expertise with digital tools for maximum impact.',
    globalVsKenya: 'Globally 10% risk; Kenya\'s climate challenges create urgent and growing local demand for 20+ years.',
  },
  electrical_engineer: {
    level: 'protected', timelineYears: 18,
    kenyaReason: 'Only 75% of Kenya is electrified. The Last Mile Connectivity program and solar energy boom require thousands of electrical engineers for installations, maintenance, and grid management. This backlog will take decades to clear.',
    humanAdvantages: ['Safety oversight', 'On-site troubleshooting', 'Rural deployment', 'Renewable integration'],
    adaptationAdvice: 'Specialize in renewable energy (solar, wind) — it\'s Kenya\'s fastest growing energy sector.',
    globalVsKenya: 'Globally 20% risk; Kenya\'s electrification gap makes this role protected locally for 18+ years.',
  },
  veterinarian: {
    level: 'protected', timelineYears: 20,
    kenyaReason: 'Livestock contributes 12% of Kenya\'s GDP. The shortage of veterinarians in rural areas is severe. Growing urban pet ownership creates additional demand. This role requires hands-on physical work.',
    humanAdvantages: ['Animal handling', 'Physical examination', 'Surgical procedures', 'Farmer trust'],
    adaptationAdvice: 'Build expertise in both livestock (rural demand) and pets (growing urban market).',
    globalVsKenya: 'Globally 5% risk; Kenya\'s livestock economy makes vets essential for 20+ years.',
  },
  cybersecurity_analyst: {
    level: 'resilient', timelineYears: 15,
    kenyaReason: 'Kenyan banks, telcos, and government face escalating cyberattacks. M-PESA alone processes billions of shillings daily. There are fewer than 2,000 qualified cybersecurity professionals in Kenya for thousands of organizations.',
    humanAdvantages: ['Threat interpretation', 'Adversarial creative thinking', 'Incident response', 'Security policy'],
    adaptationAdvice: 'AI creates new attack vectors — be the human defender who understands AI-powered threats.',
    globalVsKenya: 'Globally 15% risk; Kenya\'s digital finance boom creates a severe local shortage for 15+ years.',
  },
  ux_ui_designer: {
    level: 'evolving', timelineYears: 7,
    kenyaReason: 'Kenya\'s fintech boom (M-PESA, banking apps, e-commerce) is driving massive UX demand. Designers who can do user research in Swahili and understand Kenyan mobile-first users are in high demand.',
    humanAdvantages: ['User research and empathy', 'Cultural context', 'Stakeholder communication', 'Kenyan mobile context'],
    adaptationAdvice: 'Focus on user research and Kenyan-specific mobile UX — AI can generate wireframes but not understand boda boda culture.',
    globalVsKenya: 'Globally 35% risk; Kenya\'s fintech boom creates local demand that will last 7+ years before significant AI impact.',
  },
  renewable_energy_engineer: {
    level: 'protected', timelineYears: 20,
    kenyaReason: 'Kenya is Africa\'s renewable energy leader (geothermal, solar, wind). The Rural Electrification Authority and private sector need thousands more engineers. Government has committed billions to expansion.',
    humanAdvantages: ['Site assessment', 'Community installation', 'Grid integration', 'Safety management'],
    adaptationAdvice: 'Get certified in solar installation and storage — Kenya\'s off-grid solar market is booming.',
    globalVsKenya: 'Globally 8% risk; Kenya\'s renewable energy leadership makes this role protected for 20+ years.',
  },
  drone_pilot_gis: {
    level: 'resilient', timelineYears: 12,
    kenyaReason: 'All 47 county governments need GIS mapping. Agriculture, conservation, and construction sectors are all adopting drones rapidly. Very few licensed professionals exist — massive first-mover advantage.',
    humanAdvantages: ['Regulatory compliance', 'Data interpretation', 'Ground truth validation', 'Client briefing'],
    adaptationAdvice: 'Get your KCAA Remote Pilot License now — first movers in this field will set the market rates.',
    globalVsKenya: 'Globally 20% risk; Kenya\'s rapid drone adoption across sectors creates local demand for 12+ years.',
  },
  actuary: {
    level: 'resilient', timelineYears: 12,
    kenyaReason: 'Nairobi is East Africa\'s insurance capital. There are fewer than 300 fully qualified actuaries in Kenya for an industry that legally requires them. The IRA mandates actuarial certification — this creates a structural shortage.',
    humanAdvantages: ['Regulatory interpretation', 'Business risk judgment', 'Board communication', 'Model validation'],
    adaptationAdvice: 'Complete professional exams (IFoA, SOA) — the credential is the barrier to entry that protects this career.',
    globalVsKenya: 'Globally 30% risk; Kenya\'s structural regulatory requirement for actuaries means the profession is safe for 12+ years.',
  },
  quantity_surveyor: {
    level: 'resilient', timelineYears: 15,
    kenyaReason: 'Kenya\'s construction boom — affordable housing, SGR stations, hospitals, schools — requires a QS on every major project. BORAQS registration creates a protected profession. Demand far exceeds supply.',
    humanAdvantages: ['Dispute resolution', 'On-site measurement', 'Contractor negotiation', 'Local material costing'],
    adaptationAdvice: 'Get BORAQS registration and learn BIM cost modeling — the combination is in severe shortage.',
    globalVsKenya: 'Globally 30% risk; Kenya\'s construction pipeline and regulatory requirements keep QS demand high for 15+ years.',
  },
  digital_health_specialist: {
    level: 'resilient', timelineYears: 15,
    kenyaReason: 'Post-COVID telemedicine adoption in Kenya accelerated dramatically. MOH, WHO, NGOs and health tech startups all need people who speak both healthcare and technology. The combination is extremely rare in Kenya.',
    humanAdvantages: ['Clinical workflow understanding', 'Healthcare worker training', 'Patient data ethics', 'Regulatory navigation'],
    adaptationAdvice: 'Get qualified in both health informatics AND a clinical area — the dual expertise commands premium rates.',
    globalVsKenya: 'Globally 20% risk; Kenya\'s healthcare digitization is early stage, creating a safe 15+ year window.',
  },
  creative_director: {
    level: 'evolving', timelineYears: 7,
    kenyaReason: 'Kenyan designers competing locally face different pressures than global market. AI image tools are tools, not replacements — yet. Designers who master AI tools will command premium rates. Nairobi creative scene is growing.',
    humanAdvantages: ['Brand strategy', 'Client relationships', 'Cultural storytelling', 'Campaign management'],
    adaptationAdvice: 'Master AI creative tools now — be the creative director who uses AI to do in 1 day what took a week.',
    globalVsKenya: 'Globally 35% risk; Nairobi\'s growing advertising market means local demand stays strong for 7+ years.',
  },
  journalist: {
    level: 'evolving', timelineYears: 5,
    kenyaReason: 'Kenyan journalism is relationship-driven and community-based. Investigative journalism, radio (still dominant in Kenya), and local language content cannot be automated. Digital content creation is booming.',
    humanAdvantages: ['Source relationships', 'Investigative work', 'Local language content', 'Community trust'],
    adaptationAdvice: 'Pivot to video, podcasting, and investigative journalism — AI cannot build sources or go into the field.',
    globalVsKenya: 'Globally 55% risk for routine journalism; Kenya\'s relationship-based media means human journalists are irreplaceable for 5+ years.',
  },
  musician: {
    level: 'evolving', timelineYears: 8,
    kenyaReason: 'Kenyan music (Gengetone, Afrobeats, gospel) has strong cultural identity that AI cannot replicate. AI production tools help musicians produce faster, not replace them. Live performance and authentic artistry remain human.',
    humanAdvantages: ['Live performance', 'Cultural authenticity', 'Audience connection', 'Genre innovation'],
    adaptationAdvice: 'Use AI production tools to release music faster — be the musician who leverages AI, not competes with it.',
    globalVsKenya: 'Globally 40% risk for production; live performance and Kenyan cultural music are protected for 8+ years.',
  },
  athlete: {
    level: 'protected', timelineYears: 25,
    kenyaReason: 'Kenya\'s world-class athletes (Eliud Kipchoge, Faith Kipyegon, etc.) represent irreplaceable human performance. Athletic excellence cannot be automated. Coaching and sports science roles are also fully human.',
    humanAdvantages: ['Physical performance', 'Competitive spirit', 'Team leadership', 'Inspirational role'],
    adaptationAdvice: 'Train with data analytics and AI coaching tools — they improve performance, they don\'t replace athletes.',
    globalVsKenya: 'AI cannot compete athletically. Kenya\'s sports excellence makes this role protected indefinitely.',
  },
  interior_designer: {
    level: 'evolving', timelineYears: 8,
    kenyaReason: 'Kenya\'s real estate boom drives interior design demand. AI visualization tools help designers show clients faster previews. The Kenyan middle class wants personalized spaces that reflect their identity — a human job.',
    humanAdvantages: ['Client taste understanding', 'Sourcing local materials', 'Site measurement', 'Cultural aesthetic'],
    adaptationAdvice: 'Use AI visualization tools to show clients their space before ordering — it wins more projects.',
    globalVsKenya: 'Globally 35% risk; Kenya\'s real estate boom and personalization demand protect local interior designers for 8+ years.',
  },
  film_director: {
    level: 'evolving', timelineYears: 8,
    kenyaReason: 'Netflix and Showmax are actively commissioning Kenyan content. The demand for authentic African stories is growing globally. AI can edit but cannot direct, write, or perform Kenyan cultural narratives.',
    humanAdvantages: ['Storytelling craft', 'Director\'s vision', 'Talent management', 'Cultural authenticity'],
    adaptationAdvice: 'Use AI editing and effects tools to reduce production costs — then pitch to Netflix with savings.',
    globalVsKenya: 'Globally 30% risk; Kenya\'s growing film industry and global appetite for African content keep directors in demand for 8+ years.',
  },
  graphic_designer: {
    level: 'evolving', timelineYears: 5,
    kenyaReason: 'Kenyan designers competing locally face different pressures than global market. AI image tools are tools, not replacements — yet. Designers who master AI tools will command premium rates. Nairobi creative scene is growing.',
    humanAdvantages: ['Brand strategy', 'Client relationships', 'Print production knowledge', 'Kenyan cultural aesthetics'],
    adaptationAdvice: 'Master AI tools (Midjourney, Adobe Firefly) now — be the designer who uses AI, not the one replaced by it.',
    globalVsKenya: 'Globally 60% automation risk, but Kenyan market context means this role is safe for 5+ years locally if you adapt.',
  },
  event_planner: {
    level: 'protected', timelineYears: 20,
    kenyaReason: 'Kenyans have a strong culture of celebration — weddings, ruracio, corporate events. The in-person, relationship-driven nature of event planning requires human coordination and crisis management that AI cannot replace.',
    humanAdvantages: ['Vendor relationships', 'On-the-ground crisis management', 'Client emotional intelligence', 'Cultural event knowledge'],
    adaptationAdvice: 'Use event management software and AI tools for logistics — focus your energy on client relationships.',
    globalVsKenya: 'Globally 20% risk; Kenya\'s event culture and personal-touch requirement protect event planners for 20+ years.',
  },
  fashion_designer: {
    level: 'evolving', timelineYears: 10,
    kenyaReason: 'Kenyan fashion with African prints and cultural identity is growing internationally. AI can generate patterns but cannot create culturally authentic designs that resonate with Kenyan buyers. Social media enables direct sales.',
    humanAdvantages: ['Cultural design identity', 'Craftsmanship', 'Client fittings', 'Fabric sourcing relationships'],
    adaptationAdvice: 'Use AI for pattern generation and social media content — focus on your unique Kenyan-African design identity.',
    globalVsKenya: 'Globally 18% risk; Kenyan fashion\'s cultural identity and growing export market keep designers relevant for 10+ years.',
  },
  sports_manager: {
    level: 'protected', timelineYears: 20,
    kenyaReason: 'Kenya\'s world-class athletes need human representation for contract negotiations, sponsorships, and career management. The relationship-driven nature of sports management cannot be automated. Growing with Kenya\'s sports success.',
    humanAdvantages: ['Athlete trust relationships', 'Contract negotiation', 'Media management', 'International connections'],
    adaptationAdvice: 'Build international connections early — Kenya\'s best athletes compete globally and need globally connected managers.',
    globalVsKenya: 'AI cannot build the personal trust relationships that sports management requires. Kenya\'s sports success makes this role grow for 20+ years.',
  },
  animator_game_developer: {
    level: 'evolving', timelineYears: 6,
    kenyaReason: 'Global remote work enables Kenyan animators to work for international studios. African-themed games and content are growing. AI speeds up animation but the creative direction, concept, and African cultural content remain human.',
    humanAdvantages: ['Creative direction', 'Cultural storytelling', 'Character concept art', 'African identity content'],
    adaptationAdvice: 'Specialize in African/Kenyan cultural content — it\'s a niche global studios cannot easily replicate.',
    globalVsKenya: 'Globally 40% risk for routine animation; Kenyan cultural content and remote access to global markets create a 6+ year safe window.',
  },
  lawyer: {
    level: 'resilient', timelineYears: 12,
    kenyaReason: 'Kenya has millions of SMEs that need human lawyers who understand local business law, land disputes, and family matters. Court appearances require physical presence. Complex litigation and advocacy stay fully human.',
    humanAdvantages: ['Courtroom advocacy', 'Client counseling', 'Negotiation', 'Local legal network'],
    adaptationAdvice: 'Use legal AI tools for research and drafting — spend your time on advocacy and client strategy.',
    globalVsKenya: 'Globally 40% risk for routine legal work; Kenya\'s court system and relational legal culture keep lawyers essential for 12+ years.',
  },
  accountant_cpa: {
    level: 'evolving', timelineYears: 7,
    kenyaReason: 'Kenya has millions of SMEs that need human accountants who understand local tax law, KRA requirements, and can advise in person. Large firm auditing will automate first but that is a small fraction of Kenyan accounting work.',
    humanAdvantages: ['KRA relationship management', 'SME business advisory', 'Fraud detection judgment', 'Strategic CFO work'],
    adaptationAdvice: 'Move from bookkeeping to business advisory as fast as possible — that\'s where AI cannot go.',
    globalVsKenya: 'Globally 65% automation risk; Kenya\'s SME-heavy economy needs accountants who advise, not just record — safe for 7+ years if you adapt.',
  },
  teacher: {
    level: 'protected', timelineYears: 25,
    kenyaReason: 'TSC employs over 300,000 teachers with a known shortage. CBC rollout requires more trained teachers not fewer. AI tutoring assists but Kenyan schools need human teachers for discipline, mentorship, and community trust.',
    humanAdvantages: ['Classroom management', 'Student mentorship', 'Parent relationships', 'CBC facilitation'],
    adaptationAdvice: 'Embrace EdTech tools like EduNexus — teachers who use AI tutoring will teach better, not be replaced.',
    globalVsKenya: 'Globally 5% risk; Kenya\'s teacher shortage makes this the most protected career in the country for 25+ years.',
  },
  social_worker: {
    level: 'protected', timelineYears: 25,
    kenyaReason: 'Kenya\'s social challenges — poverty, child welfare, mental health — require thousands more social workers. The empathy, fieldwork, and community trust required cannot be automated. NGOs and government are hiring.',
    humanAdvantages: ['Community trust', 'Fieldwork', 'Family counseling', 'Crisis intervention'],
    adaptationAdvice: 'Learn case management software and data systems — they make you more effective, not less needed.',
    globalVsKenya: 'AI cannot do home visits or build community trust. Kenya\'s social development needs make this role protected for 25+ years.',
  },
  human_resources: {
    level: 'evolving', timelineYears: 8,
    kenyaReason: 'Kenya\'s growing corporate sector needs more HR professionals. While AI will automate recruitment screening and payroll, the employee relations, culture building, and leadership development that Kenyan companies need remain human.',
    humanAdvantages: ['Employee relations', 'Cultural fit judgment', 'Leadership coaching', 'Conflict resolution'],
    adaptationAdvice: 'Specialize in organizational development and culture — the parts that AI will never automate.',
    globalVsKenya: 'Globally 45% risk for admin HR; Kenya\'s growing formal employment sector keeps strategic HR in demand for 8+ years.',
  },
  psychologist: {
    level: 'protected', timelineYears: 25,
    kenyaReason: 'Kenya has approximately 1 psychologist per 1 million people — one of the worst ratios globally. Mental health awareness is growing rapidly. Therapy requires human connection, empathy, and trust that AI cannot provide.',
    humanAdvantages: ['Therapeutic relationship', 'Trauma processing', 'Cultural sensitivity', 'Clinical judgment'],
    adaptationAdvice: 'Embrace telehealth platforms — they expand your reach without replacing your human connection.',
    globalVsKenya: 'Globally 10% risk; Kenya\'s extreme shortage and growing mental health awareness make this career protected for 25+ years.',
  },
  diplomat: {
    level: 'protected', timelineYears: 25,
    kenyaReason: 'Nairobi hosts more UN agencies than any other African city. Kenya\'s growing regional leadership role requires more diplomats. Negotiation, relationship building, and cultural intelligence at this level are irreplaceable human skills.',
    humanAdvantages: ['Negotiation credibility', 'Cultural intelligence', 'Political judgment', 'Relationship networks'],
    adaptationAdvice: 'Learn AI research tools to brief yourself faster — use the saved time to build deeper bilateral relationships.',
    globalVsKenya: 'Diplomacy is human by definition. Kenya\'s regional leadership role makes this career safe for 25+ years.',
  },
  tourism_safari_manager: {
    level: 'protected', timelineYears: 22,
    kenyaReason: 'Kenya\'s tourism sector is recovering strongly post-COVID with record wildlife visitor numbers. Safari experiences require knowledgeable human guides. International tourists pay premium prices for authentic human-led experiences.',
    humanAdvantages: ['Wildlife knowledge', 'Safari storytelling', 'Guest experience', 'Emergency response'],
    adaptationAdvice: 'Learn digital marketing and online booking tools — they expand your reach to international clients.',
    globalVsKenya: 'Tourism is a human experience by nature. Kenya\'s world-class wildlife and growing visitor numbers keep this career safe for 22+ years.',
  },
  supply_chain_manager: {
    level: 'evolving', timelineYears: 8,
    kenyaReason: 'Kenya is East Africa\'s logistics hub (Mombasa Port, SGR, LAPPSET). AI optimizes routes but cannot negotiate with corrupt port officials, manage political disruptions, or handle the complexity of Kenyan informal supply chains.',
    humanAdvantages: ['Vendor relationships', 'Crisis judgment', 'Political navigation', 'Informal market knowledge'],
    adaptationAdvice: 'Learn SAP and AI optimization tools — use them to become more strategic, not just operational.',
    globalVsKenya: 'Globally 35% risk; Kenya\'s logistics complexity and political context mean supply chain managers stay essential for 8+ years.',
  },
  insurance_specialist: {
    level: 'evolving', timelineYears: 7,
    kenyaReason: 'Kenya\'s insurance penetration is only 2.3% — one of the lowest globally. The massive growth opportunity requires human underwriters who can develop new products for Kenyan risks. AI will automate basic policies but complex risk stays human.',
    humanAdvantages: ['New product development', 'Complex risk assessment', 'Client advisory', 'Regulatory compliance'],
    adaptationAdvice: 'Move to complex and emerging risk areas (cyber, climate, agriculture) — AI cannot price what it cannot model.',
    globalVsKenya: 'Globally 55% risk for routine underwriting; Kenya\'s low insurance penetration creates growth demand that keeps specialists employed for 7+ years.',
  },
  urban_planner: {
    level: 'resilient', timelineYears: 15,
    kenyaReason: 'Kenya is urbanizing at 4% per year — one of the fastest rates globally. All 47 counties are legally required to have development plans. The shortage of registered planners is severe. PPRB registration creates a protected profession.',
    humanAdvantages: ['Community consultation', 'Political navigation', 'Informal settlement expertise', 'Local geography knowledge'],
    adaptationAdvice: 'Master GIS tools and smart city planning — the combination of regulation knowledge and digital skills is extremely rare.',
    globalVsKenya: 'Globally 20% risk; Kenya\'s urbanization rate and regulatory requirements make urban planners essential for 15+ years.',
  },
  economist: {
    level: 'resilient', timelineYears: 12,
    kenyaReason: 'Kenya\'s Central Bank, Treasury, and international organizations (World Bank, IMF, AfDB) all need economists who understand Kenya\'s unique economic context. The CBK alone has dozens of economists. Policy interpretation stays human.',
    humanAdvantages: ['Policy judgment', 'Political economy reading', 'Stakeholder communication', 'Local context expertise'],
    adaptationAdvice: 'Master data science alongside economics — the hybrid economist-data scientist is in extreme shortage.',
    globalVsKenya: 'Globally 35% risk for routine modeling; policy judgment and Kenya-specific expertise keep economists employed for 12+ years.',
  },
}

// ============================================================
// SECTION 7 — CAREER DATABASE HELPERS
// ============================================================

export function getMatchingCareers(pathway: string, scores: Record<string, number>): CareerData[] {
  if (!CAREER_DATABASE || CAREER_DATABASE.length === 0) return []
  return CAREER_DATABASE
    .filter(career => {
      if (career.pathway !== pathway) return false
      return Object.entries(career.matchRequirements.minimumLevels).every(
        ([subject, minLevel]) => (scores[subject] ?? 0) >= minLevel
      )
    })
    .sort((a, b) => {
      const getSurplus = (career: CareerData) =>
        Object.entries(career.matchRequirements.minimumLevels).reduce(
          (sum, [subject, minLevel]) => sum + ((scores[subject] ?? 0) - minLevel), 0
        )
      return getSurplus(b) - getSurplus(a)
    })
    .slice(0, 5)
}

export function findCareerByName(careerName: string): CareerData | null {
  const normalized = careerName.toLowerCase().trim()
  return (
    CAREER_DATABASE.find(c => c.name.toLowerCase() === normalized) ||
    CAREER_DATABASE.find(c => c.name.toLowerCase().includes(normalized) || normalized.includes(c.name.toLowerCase())) ||
    CAREER_DATABASE.find(c => c.id === normalized.replace(/\s+/g, '_')) ||
    null
  )
}

export function getAllCareerNames(): string[] {
  return CAREER_DATABASE.map(c => c.name)
}

export function getCareersByPathway(pathway: string): CareerData[] {
  return CAREER_DATABASE.filter(c => c.pathway === pathway)
}

export function searchCareers(keyword: string): CareerData[] {
  const n = keyword.toLowerCase().trim()
  return CAREER_DATABASE.filter(
    c => c.name.toLowerCase().includes(n) ||
         c.id.includes(n) ||
         c.marketReality.kenyanContext.toLowerCase().includes(n)
  )
}

// ============================================================
// SECTION 8 — CAREER ENGINE CLASS (new)
// ============================================================

// ─── Pathway name normalizer ─────────────────────────────────────────────────
// career.pathway uses 'Arts & Sports'
// student.current_pathway uses 'Arts & Sports Science'
// This map normalizes both to the same key

export const PATHWAY_NORMALIZE: Record<string, string> = {
  'STEM':                  'STEM',
  'Social Sciences':       'Social Sciences',
  'Arts & Sports':         'Arts & Sports Science',
  'Arts & Sports Science': 'Arts & Sports Science',
}

export function normalizePathway(raw: string): string {
  return PATHWAY_NORMALIZE[raw] ?? raw
}

export class CareerEngine {
  private _db: ReturnType<typeof createServiceClient> | null = null
  private get db() {
    if (!this._db) this._db = createServiceClient()
    return this._db
  }

  // ── SECTION A: CAREER MATCHING ──────────────────────────────

  matchCareers(
    cbcScores: Record<string, number>,
    performanceTier: 'high' | 'mid' | 'low',
    _curriculumType: 'cbc' | 'igcse' = 'cbc',
    currentPathway?: string
  ): CareerMatch[] {
    const studentPathway = currentPathway ? normalizePathway(currentPathway) : null

    const scored = CAREER_DATABASE
      .filter(career => {
        if (!studentPathway) return true
        return normalizePathway(career.pathway) === studentPathway
      })
      .map(career => ({
        career,
        matchScore: this.scoreCareer(career, cbcScores, performanceTier, studentPathway),
        matchReasons: this.buildMatchReasons(career, cbcScores),
        gapSubjects: this.buildGapSubjects(career, cbcScores),
      }))
    return scored.sort((a, b) => b.matchScore - a.matchScore)
  }

  private scoreCareer(
    career: CareerData,
    cbcScores: Record<string, number>,
    tier: 'high' | 'mid' | 'low',
    studentPathway: string | null
  ): number {
    const { primarySubjects, minimumLevels } = career.matchRequirements
    if (primarySubjects.length === 0) return 50

    // 1. Subject performance score
    let total = 0
    for (const subject of primarySubjects) {
      const student = cbcScores[subject] ?? 0
      total += (student / 4) * 100
    }
    const subjectScore = total / primarySubjects.length

    // 2. Kenya shortage bonus
    const shortageBonus = (career.kenyaShortageScore / 100) * 15

    // 3. Pathway alignment bonus (replaces tier bias)
    // Careers are already filtered to the student's pathway above, but we still
    // reward alignment and penalise mismatches when no pathway is known (junior school)
    const pathwayAligned = studentPathway
      ? normalizePathway(career.pathway) === studentPathway
      : true
    const pathwayBonus = pathwayAligned ? 20 : -30

    // 4. Tier bonus — within pathway, higher performers see more demanding careers first
    const tierBonus = tier === 'high' ? 8 : tier === 'mid' ? 3 : 0

    // 5. Minimum level penalty
    const meetsMinimum = Object.entries(minimumLevels).every(
      ([subj, min]) => (cbcScores[subj] ?? 0) >= min
    )
    const minPenalty = meetsMinimum ? 0 : -15

    return Math.max(0, Math.min(100,
      subjectScore + shortageBonus + pathwayBonus + tierBonus + minPenalty
    ))
  }

  private buildMatchReasons(career: CareerData, cbcScores: Record<string, number>): string[] {
    return career.matchRequirements.primarySubjects
      .filter(s => (cbcScores[s] ?? 0) >= (career.matchRequirements.minimumLevels[s] ?? 3))
      .map(s => `Level ${cbcScores[s] ?? 0} in ${formatSubjectName(s)} meets ${career.name} requirements`)
  }

  private buildGapSubjects(career: CareerData, cbcScores: Record<string, number>): string[] {
    return career.matchRequirements.primarySubjects
      .filter(s => (cbcScores[s] ?? 0) < (career.matchRequirements.minimumLevels[s] ?? 3))
  }

  // ── SECTION B: MARKET ENRICHMENT ────────────────────────────

  async enrichWithMarket(
    careers: CareerMatch[],
    useCache = true
  ): Promise<EnrichedCareerMatch[]> {
    return Promise.all(careers.map(async match => {
      let marketSignal: MarketSignal
      try {
        marketSignal = await this.getMarketSignal(match.career.id, useCache)
      } catch {
        marketSignal = { jobPostingsCount: null, salaryTrend: 'unknown', sectorNews: null, lastChecked: new Date().toISOString(), source: 'static' }
      }
      const disruption = this.assessKenyaAIDisruption(match.career)
      const urgency: EnrichedCareerMatch['urgency'] =
        match.career.kenyaShortageScore >= 70 && match.matchScore >= 60 ? 'start_now' :
        match.matchScore >= 50 ? 'build_toward' : 'long_term'
      return {
        ...match,
        marketSignal,
        disruption,
        shortDescription: match.career.realityCheck.typicalDay.substring(0, 120),
        urgency,
      }
    }))
  }

  private async getMarketSignal(careerId: string, useCache: boolean): Promise<MarketSignal> {
    if (useCache) {
      const { data: cached } = await this.db
        .from('career_market_cache')
        .select('data, cached_at')
        .eq('career_id', careerId)
        .single()
      const isStale = !cached || Date.now() - new Date((cached as { cached_at: string }).cached_at).getTime() > 24 * 60 * 60 * 1000
      if (!isStale && cached) return (cached as { data: MarketSignal }).data as MarketSignal
    }

    const fresh = await this.searchKenyaMarket(
      CAREER_DATABASE.find(c => c.id === careerId)?.name ?? careerId
    )
    await this.db.from('career_market_cache').upsert(
      { career_id: careerId, data: fresh, cached_at: new Date().toISOString() },
      { onConflict: 'career_id' }
    )
    return fresh
  }

  private async searchKenyaMarket(careerName: string): Promise<MarketSignal> {
    try {
      const searchQuery = encodeURIComponent(`${careerName} jobs Kenya 2026 salary`)
      const response = await fetch(
        `https://api.duckduckgo.com/?q=${searchQuery}&format=json&no_html=1`,
        { signal: AbortSignal.timeout(3000) }
      )
      if (!response.ok) throw new Error('Search failed')
      const data = await response.json() as { Abstract?: string; RelatedTopics?: Array<{ Text?: string }> }
      const abstract = data.Abstract ?? ''
      const salaryTrend: MarketSignal['salaryTrend'] =
        /increas|growing|rising/i.test(abstract) ? 'rising' :
        /declin|shrink/i.test(abstract) ? 'declining' : 'stable'
      const sectorNews = data.RelatedTopics?.[0]?.Text?.substring(0, 200) ?? null
      return { jobPostingsCount: null, salaryTrend, sectorNews, lastChecked: new Date().toISOString(), source: 'live' }
    } catch {
      return { jobPostingsCount: null, salaryTrend: 'unknown', sectorNews: null, lastChecked: new Date().toISOString(), source: 'static' }
    }
  }

  // ── SECTION C: HONEST AI DISRUPTION ─────────────────────────

  assessKenyaAIDisruption(career: CareerData): KenyaDisruptionAssessment {
    const found = KENYA_DISRUPTION[career.id]
    if (found) return found
    // Fallback: map old disruption risk to new system
    const levelMap: Record<AIDisruptionRisk, KenyaAIDisruption> = {
      very_low: 'protected', low: 'resilient', moderate: 'evolving',
      high: 'vulnerable', very_high: 'transforming',
    }
    return {
      level: levelMap[career.aiImpact.disruptionRisk],
      timelineYears: career.aiImpact.disruptionRisk === 'very_low' ? 20 :
                     career.aiImpact.disruptionRisk === 'low' ? 12 :
                     career.aiImpact.disruptionRisk === 'moderate' ? 8 : 5,
      kenyaReason: career.marketReality.kenyanContext,
      humanAdvantages: career.aiImpact.survivalStrategy.slice(0, 3),
      adaptationAdvice: career.aiImpact.survivalStrategy[0] ?? 'Adapt and upskill continuously.',
      globalVsKenya: `Globally ${career.aiImpact.disruptionPercentage}% automation risk; Kenyan market context applies.`,
    }
  }

  // ── SECTION D: COMPASS BRIDGE ───────────────────────────────

  buildCompassBridge(
    topCareer: EnrichedCareerMatch,
    cbcScores: Record<string, number>,
    studentName: string,
    _grade: number
  ): CompassBridge {
    const firstName = studentName.split(' ')[0]
    const career = topCareer.career
    const careerSubjects = career.matchRequirements.primarySubjects

    const subjectPriorities = careerSubjects
      .map(subject => {
        const currentLevel = cbcScores[subject] ?? 1
        const targetLevel = career.matchRequirements.minimumLevels[subject] ?? 3
        const analysis = analyzePerformance({ [subject]: currentLevel })
        const actionSteps = analysis.recommendations
          .find(r => r.subject === subject)
          ?.actionSteps.slice(0, 3) ?? []
        const careerReason = buildCareerSubjectReason(subject, career.name)
        const gap = targetLevel - currentLevel
        const urgency: 'critical' | 'important' | 'helpful' =
          gap >= 2 ? 'critical' : gap === 1 ? 'important' : 'helpful'
        return {
          subject,
          displayName: formatSubjectName(subject),
          currentLevel,
          targetLevel,
          careerReason,
          urgency,
          actionSteps,
        }
      })
      .sort((a, b) => {
        const order = { critical: 0, important: 1, helpful: 2 }
        return order[a.urgency] - order[b.urgency]
      })

    const topPriority = subjectPriorities[0]

    const openingMessage = topPriority
      ? `${firstName}, your strongest career match is ${career.name}. Today we start with ${topPriority.displayName} — ${topPriority.careerReason}. Let's see exactly where you are right now.`
      : `${firstName}, let's explore ${career.name} together. Your scores show real potential for this path.`

    const guidedTopics = subjectPriorities.slice(0, 3).map(sp => {
      if (sp.urgency === 'critical') return `Explain the most important ${sp.displayName} concepts I need to know for ${career.name}`
      if (sp.urgency === 'important') return `What ${sp.displayName} topics will help me most on my path to becoming a ${career.name}?`
      return `How does ${sp.displayName} connect to what ${career.name}s do every day in Kenya?`
    })

    const criticalGaps = subjectPriorities.filter(s => s.urgency === 'critical').map(s => s.displayName)
    const sessionGoal = criticalGaps.length > 0
      ? `Close the ${criticalGaps.join(' and ')} gap so ${career.name} stays within reach by Grade 10.`
      : `Deepen ${career.name} readiness by strengthening ${subjectPriorities[0]?.displayName ?? 'core subjects'}.`

    const weeklyMilestones = subjectPriorities.slice(0, 3).map((sp, i) => ({
      week: i + 1,
      focus: sp.displayName,
      careerRelevance: sp.careerReason,
      goal: sp.urgency === 'critical'
        ? `Move from Level ${sp.currentLevel} to Level ${sp.currentLevel + 1} in ${sp.displayName}`
        : `Consolidate Level ${sp.currentLevel} in ${sp.displayName} — push toward Level ${sp.targetLevel}`,
    }))

    const parentMessage =
      `${firstName}'s top career match: *${career.name}*\n\n` +
      `Priority this holiday: *${topPriority?.displayName ?? 'Core subjects'}*\n` +
      `Current level: ${topPriority?.currentLevel ?? 1}/4 → Target: ${topPriority?.targetLevel ?? 3}/4\n\n` +
      `15 min/day on Learning Compass = significant improvement.\n` +
      `edunexus.co.ke/compass`

    return { openingMessage, subjectPriorities, guidedTopics, sessionGoal, weeklyMilestones, parentMessage }
  }

  // ── SECTION E: UNKNOWN CAREER FALLBACK ──────────────────────

  async generateUnknownCareer(careerName: string): Promise<CareerData> {
    return generateDynamicCareer(careerName).then(d => ({
      id: careerName.toLowerCase().replace(/\s+/g, '_'),
      name: d.name,
      pathway: 'STEM',
      kenyaShortageScore: 50,
      matchRequirements: { primarySubjects: d.required_subjects, minimumLevels: {} },
      marketReality: { earningPotential: 'moderate', jobSecurity: 'moderate', demandLevel: 'moderate', kenyanContext: d.description },
      cbeReadiness: { coreCompetencies: [], recommendedSeniorPath: d.education_path, universities: d.universities_in_kenya ?? [], tvetOptions: d.tvet_options ?? [] },
      aiImpact: { disruptionRisk: d.ai_disruption_risk as AIDisruptionRisk, disruptionPercentage: 30, growthOutlook: d.outlook === 'excellent' ? 'booming' : d.outlook === 'good' ? 'growing' : 'stable', growthPercentage: 50, timeline: { shortTerm: '', midTerm: '', longTerm: '' }, survivalStrategy: d.career_path ?? [] },
      realityCheck: { pros: [], challenges: [], typicalDay: d.description },
    }))
  }

  // ── SECTION F: FULL PIPELINE ─────────────────────────────────

  async analyze(params: {
    studentId: string
    studentName: string
    grade: number
    cbcScores: Record<string, number>
    curriculumType: 'cbc' | 'igcse'
    performanceTier: 'high' | 'mid' | 'low'
    enrichWithRealTime?: boolean
    currentPathway?: string
  }): Promise<CareerAnalysisResult> {
    const { studentName, grade, cbcScores, curriculumType, performanceTier, enrichWithRealTime = true, currentPathway } = params

    const allMatches = this.matchCareers(cbcScores, performanceTier, curriculumType, currentPathway)
    const top5 = allMatches.slice(0, 5)
    const enriched = await this.enrichWithMarket(top5, enrichWithRealTime)

    // Hidden gems: high shortage + viable but not in top 5
    const top5Ids = new Set(top5.map(m => m.career.id))
    const gemCandidates = allMatches.filter(m => !top5Ids.has(m.career.id) && m.career.kenyaShortageScore >= 70 && m.matchScore >= 35).slice(0, 3)
    const hiddenGems = await this.enrichWithMarket(gemCandidates, enrichWithRealTime)

    const compassBridge = this.buildCompassBridge(enriched[0], cbcScores, studentName, grade)

    const criticalSubject = compassBridge.subjectPriorities.find(s => s.urgency === 'critical')?.subject ??
      compassBridge.subjectPriorities[0]?.subject ?? 'mathematics'

    const avgScore = enriched.reduce((s, m) => s + m.matchScore, 0) / (enriched.length || 1)
    const pathwayConfidence: CareerAnalysisResult['summary']['pathwayConfidence'] =
      avgScore >= 70 ? 'high' : avgScore >= 50 ? 'medium' : 'low'

    return {
      topCareers: enriched,
      hiddenGems,
      compassBridge,
      summary: {
        recommendedPathway: enriched[0]?.career.pathway ?? 'STEM',
        pathwayConfidence,
        criticalSubject,
        careerReadiness: avgScore >= 70 ? 'Strong — on track for top career choices' :
          avgScore >= 50 ? 'Developing — targeted effort needed in key subjects' :
          'Early stage — focus on foundational subjects first',
      },
    }
  }
}

// ============================================================
// DREAM CAREER ANALYSIS
// ============================================================

export interface DreamCareerAnalysis {
  dreamCareer:      string
  found:            boolean
  readinessScore:   number
  readinessLabel:   string
  gapSubjects: Array<{
    subject:        string
    displayName:    string
    currentLevel:   number
    requiredLevel:  number
    gapSize:        number
  }>
  allGapsClosed:    boolean
  estimatedTerms:   number
  alternativeCareers: Array<{
    name:           string
    matchScore:     number
    whyRelevant:    string
  }>
  encouragement:    string
}

export function analyzeDreamCareer(
  dreamCareerInput: string,
  cbcScores:        Record<string, number>,
  _currentPathway?: string
): DreamCareerAnalysis {
  const career = findCareerByName(dreamCareerInput)

  if (!career) {
    return {
      dreamCareer:        dreamCareerInput,
      found:              false,
      readinessScore:     0,
      readinessLabel:     'Career not yet in our database',
      gapSubjects:        [],
      allGapsClosed:      false,
      estimatedTerms:     0,
      alternativeCareers: [],
      encouragement:      `We don't have specific data for "${dreamCareerInput}" yet, but your Learning Compass can guide you toward it.`,
    }
  }

  const { primarySubjects, minimumLevels } = career.matchRequirements

  const gapSubjects = primarySubjects
    .map(subject => {
      const current  = cbcScores[subject] ?? 0
      const required = minimumLevels[subject] ?? 3
      return {
        subject,
        displayName:  formatSubjectName(subject),
        currentLevel: current,
        requiredLevel: required,
        gapSize:      Math.max(0, required - current),
      }
    })
    .filter(s => s.gapSize > 0)
    .sort((a, b) => b.gapSize - a.gapSize)

  const subjectReadiness = primarySubjects.map(subject => {
    const current  = cbcScores[subject] ?? 0
    const required = minimumLevels[subject] ?? 3
    return Math.min(current / required, 1) * 100
  })
  const readinessScore = subjectReadiness.length > 0
    ? Math.round(subjectReadiness.reduce((a, b) => a + b, 0) / subjectReadiness.length)
    : 50

  const readinessLabel =
    readinessScore >= 90 ? 'Ready — qualifications met!' :
    readinessScore >= 70 ? 'Very close — minor gaps to close' :
    readinessScore >= 50 ? 'On track — keep building' :
    readinessScore >= 30 ? 'Gap to close — focused effort needed' :
    'Early stage — strong foundation first'

  const maxGap = gapSubjects.length > 0
    ? Math.max(...gapSubjects.map(s => s.gapSize))
    : 0
  const estimatedTerms = maxGap * 2

  const pathwayKey = normalizePathway(career.pathway)
  const alternatives = CAREER_DATABASE
    .filter(c => normalizePathway(c.pathway) === pathwayKey && c.name !== career.name)
    .map(c => {
      const altScores = c.matchRequirements.primarySubjects
        .map(s => (cbcScores[s] ?? 0) / 4 * 100)
      const altScore = altScores.length > 0
        ? Math.round(altScores.reduce((a, b) => a + b, 0) / altScores.length)
        : 50
      return {
        name: c.name,
        matchScore: altScore,
        whyRelevant: `Also in ${pathwayKey} pathway — ${c.marketReality.kenyanContext.slice(0, 80)}...`,
      }
    })
    .sort((a, b) => b.matchScore - a.matchScore)
    .slice(0, 2)

  const allGapsClosed = gapSubjects.length === 0
  const encouragement = allGapsClosed
    ? `${career.name} is within reach! This career is in high demand in Kenya — keep this trajectory.`
    : gapSubjects.length === 1
    ? `Just ONE subject stands between this child and ${career.name}: ${gapSubjects[0].displayName}. With ${estimatedTerms} term(s) of focused Learning Compass sessions, this gap can close.`
    : `${career.name} requires improvement in ${gapSubjects.length} areas. With consistent EduNexus support, this goal is achievable. Start with ${gapSubjects[0].displayName} first.`

  return {
    dreamCareer: career.name,
    found:       true,
    readinessScore,
    readinessLabel,
    gapSubjects,
    allGapsClosed,
    estimatedTerms,
    alternativeCareers: alternatives,
    encouragement,
  }
}

// ── Career-subject reason helper ────────────────────────────────

function buildCareerSubjectReason(subject: string, career: string): string {
  const reasons: Record<string, Record<string, string>> = {
    mathematics: {
      'Software Engineer / Developer': 'coding logic and algorithms need strong algebra',
      'Data Scientist / AI Specialist': 'statistics and ML models require advanced maths',
      'Civil Engineer / Infrastructure Specialist': 'structural calculations depend on mathematics',
      'Actuary': 'actuarial science is applied mathematics',
      'Accountant (CPA) / Financial Analyst': 'financial modelling requires numerical precision',
      default: 'mathematical reasoning is core to this career',
    },
    integrated_science: {
      'Medical Doctor': 'biology and chemistry are the foundation of medicine',
      'Agricultural Scientist / Agri-Tech Specialist': 'soil science and biology underpin agronomy',
      'Environmental Scientist / Conservationist': 'ecological systems require deep science knowledge',
      default: 'scientific thinking is essential in this field',
    },
    english: {
      'Lawyer / Legal Advocate': 'legal arguments and documents require precise English',
      'Journalist / Content Creator': 'writing and communication are the core skill',
      'Teacher / Education Specialist': 'clear communication is the foundation of teaching',
      default: 'professional communication is critical in this career',
    },
    social_studies: {
      'Lawyer / Legal Advocate': 'civic and historical context strengthens legal reasoning',
      'Diplomat / Foreign Affairs Officer': 'social and political understanding is foundational',
      'Urban Planner / City Development Officer': 'community dynamics and governance knowledge is essential',
      default: 'social and civic understanding supports this career',
    },
    creative_arts_sports: {
      'Creative Director / Brand Strategist': 'creative expression is the core career skill',
      'Film Director / Video Producer': 'visual storytelling begins with creative arts',
      'Graphic Designer / Visual Communicator': 'design foundations come from creative arts',
      default: 'creative skills directly feed into this career',
    },
    agriculture_nutrition: {
      'Agricultural Scientist / Agri-Tech Specialist': 'practical agriculture knowledge is the foundation',
      'Veterinary Doctor': 'livestock and animal nutrition are core knowledge',
      default: 'agricultural context supports this career in Kenya',
    },
    pre_technical_studies: {
      'Civil Engineer / Infrastructure Specialist': 'technical drawing and construction concepts start here',
      'Electrical Engineer / Power Systems Specialist': 'electrical fundamentals begin in pre-tech',
      'Quantity Surveyor': 'construction knowledge is built on technical studies',
      default: 'technical and practical skills support this career',
    },
    kiswahili: {
      'Teacher / Education Specialist': 'Kiswahili is essential for CBC classroom instruction',
      'Journalist / Content Creator': 'Kiswahili content reaches millions of Kenyans',
      default: 'national language skills are valued in this career',
    },
  }
  return reasons[subject]?.[career] ?? reasons[subject]?.['default'] ?? `${subject} supports the skills needed for ${career}`
}

// ============================================================
// SECTION 9 — LEGACY CAREER INTELLIGENCE ENGINE
// ============================================================

const KENYAN_MARKET_REALITIES: Record<string, Partial<KenyanMarketData>> = {
  software_engineer:            { sectorGrowth: 'booming', saturationLevel: 'balanced', keyEmployers: ['Safaricom', 'Andela', 'Microsoft ADC', 'Cellulant', 'Twiga Foods'], salaryRangeKES: { entry: 80000, mid: 180000, senior: 400000 }, ruralVsUrban: 'hybrid' },
  doctor:                       { sectorGrowth: 'stable', entryBarriers: 'very_high', saturationLevel: 'underserved', keyEmployers: ['Kenyatta National Hospital', 'MP Shah', 'Aga Khan', 'County Hospitals'], salaryRangeKES: { entry: 120000, mid: 250000, senior: 600000 }, ruralVsUrban: 'rural_viable' },
  data_scientist:               { sectorGrowth: 'booming', entryBarriers: 'high', saturationLevel: 'underserved', keyEmployers: ['Safaricom', 'KCB', 'Equity Bank', 'IBM Research', 'iHub'], salaryRangeKES: { entry: 100000, mid: 220000, senior: 500000 }, ruralVsUrban: 'urban_only' },
  teacher:                      { sectorGrowth: 'stable', entryBarriers: 'medium', saturationLevel: 'saturated', keyEmployers: ['TSC', 'Private Schools', 'International Schools'], salaryRangeKES: { entry: 35000, mid: 60000, senior: 120000 }, ruralVsUrban: 'rural_viable' },
  renewable_energy_technician:  { sectorGrowth: 'booming', entryBarriers: 'medium', saturationLevel: 'underserved', keyEmployers: ['KenGen', 'Rural Electrification', 'Solar Companies', 'KPLC'], salaryRangeKES: { entry: 40000, mid: 90000, senior: 180000 }, ruralVsUrban: 'rural_viable' },
}

export class CareerIntelligenceEngine {
  private _supabase: ReturnType<typeof createServiceClient> | null = null
  private get supabase() {
    if (!this._supabase) this._supabase = createServiceClient()
    return this._supabase
  }

  async getCareerIntelligence(careerName: string): Promise<CareerIntelligence> {
    const normalizedName = this.normalizeCareerName(careerName)
    const verified = await this.getVerifiedCareer(normalizedName)
    if (verified) return verified
    const localData = KENYAN_MARKET_REALITIES[normalizedName]
    if (localData) return this.generateWithLocalContext(normalizedName, localData)
    return this.generateFromScratch(normalizedName)
  }

  async compareCareers(careerNames: string[]): Promise<{ comparison: Record<string, CareerIntelligence>; recommendation: string; riskAnalysis: string }> {
    const careers = await Promise.all(careerNames.map(name => this.getCareerIntelligence(name)))
    const comparison = Object.fromEntries(careers.map(c => [c.id, c]))
    const analysis = await this.generateComparisonAnalysis(careers)
    return { comparison, recommendation: analysis.recommendation, riskAnalysis: analysis.riskAnalysis }
  }

  private normalizeCareerName(name: string): string {
    return name.toLowerCase().replace(/[^a-z0-9\s]/g, '').replace(/\s+/g, '_').trim()
  }

  private async getVerifiedCareer(name: string): Promise<CareerIntelligence | null> {
    const { data } = await this.supabase
      .from('career_intelligence')
      .select('id, name, category, description, kenyan_market, cbc_mapping, ai_forecast, real_stories, verification_status, last_updated')
      .eq('id', name)
      .eq('verification_status', 'profession_validated')
      .single()
    return data as unknown as CareerIntelligence | null
  }

  private async generateWithLocalContext(name: string, localData: Partial<KenyanMarketData>): Promise<CareerIntelligence> {
    const prompt = this.buildAnchoredPrompt(name, localData)
    const aiData = await this.callDeepSeek(prompt)
    return this.mergeWithLocalData(aiData, localData)
  }

  private async generateFromScratch(name: string): Promise<CareerIntelligence> {
    let webContext = ''
    try {
      const searchQuery = encodeURIComponent(name + ' career Kenya salary requirements 2025')
      const ddgRes = await fetch('https://api.duckduckgo.com/?q=' + searchQuery + '&format=json&no_html=1', { signal: AbortSignal.timeout(3000) })
      const ddgData = await ddgRes.json() as { Abstract?: string; RelatedTopics?: Array<{ Text?: string }> }
      webContext = ddgData.Abstract ?? ddgData.RelatedTopics?.[0]?.Text ?? ''
    } catch { webContext = '' }
    const prompt = this.buildComprehensivePrompt(name) + (webContext ? '\n\nWEB CONTEXT: ' + webContext : '')
    const aiData = await this.callDeepSeek(prompt)
    await this.supabase.from('career_intelligence').upsert({ id: name, name: aiData.name, ...aiData, verification_status: 'ai_generated', last_updated: new Date().toISOString() }, { onConflict: 'id' })
    return { ...aiData, verificationStatus: 'ai_generated', lastUpdated: new Date() }
  }

  private buildAnchoredPrompt(name: string, localData: Partial<KenyanMarketData>): string {
    return `You are a Kenyan career intelligence expert. Research: "${name}"\nKNOWN DATA: Sector Growth: ${localData.sectorGrowth}, Key Employers: ${localData.keyEmployers?.join(', ')}\nReturn JSON with cbcMapping, aiForecast, realStories fields.`
  }

  private buildComprehensivePrompt(name: string): string {
    return `Research career: "${name}" for Kenyan CBC students. Return JSON with: id, name, category, description, kenyanMarket, cbcMapping, aiForecast, realStories. Use real Kenyan companies and universities.`
  }

  private async callDeepSeek(prompt: string): Promise<CareerIntelligence> {
    const response = await fetch(`${DEEPSEEK_CONFIG.baseURL}/chat/completions`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${DEEPSEEK_CONFIG.getKeyOrThrow()}` },
      body: JSON.stringify({
        model: DEEPSEEK_CONFIG.model,
        messages: [
          { role: 'system', content: 'You are a Kenyan career intelligence expert. Return ONLY valid JSON.' },
          { role: 'user', content: prompt },
        ],
        temperature: 0.5, max_tokens: 2500,
      }),
    })
    if (!response.ok) throw new Error(`DeepSeek API error: ${response.status}`)
    const data = await response.json() as { choices: Array<{ message: { content: string } }> }
    const content = data.choices[0].message.content
    const jsonMatch = content.match(/\{[\s\S]*\}/)
    if (!jsonMatch) throw new Error('No JSON found in response')
    return JSON.parse(jsonMatch[0]) as CareerIntelligence
  }

  private mergeWithLocalData(aiData: CareerIntelligence, localData: Partial<KenyanMarketData>): CareerIntelligence {
    return { ...aiData, kenyanMarket: { ...aiData.kenyanMarket, ...localData }, verificationStatus: 'expert_reviewed', lastUpdated: new Date() }
  }

  private async generateComparisonAnalysis(careers: CareerIntelligence[]): Promise<{ recommendation: string; riskAnalysis: string }> {
    const prompt = `Compare these careers for a Kenyan student: ${careers.map(c => `${c.name}: Growth ${c.kenyanMarket.sectorGrowth}`).join(', ')}. Return JSON: {"recommendation": "...", "riskAnalysis": "..."}`
    const result = await this.callDeepSeek(prompt)
    return { recommendation: (result as unknown as { recommendation: string }).recommendation ?? '', riskAnalysis: (result as unknown as { riskAnalysis: string }).riskAnalysis ?? '' }
  }
}

export const careerIntelligenceEngine = new CareerIntelligenceEngine()
// backward-compat alias
export const careerEngine = careerIntelligenceEngine

export const getCachedCareerAnalysis = (careerName: string) =>
  unstable_cache(
    () => careerIntelligenceEngine.getCareerIntelligence(careerName),
    [`career_intel_${careerName.toLowerCase().replace(/\s+/g, '_')}`],
    { revalidate: 21600, tags: ['career-intelligence'] }
  )()

// ============================================================
// SECTION 10 — analyzeCareerOptions + generateCareerIntegratedLearningPlan
// ============================================================

async function callDeepSeekText(prompt: string): Promise<string> {
  const response = await fetch(`${DEEPSEEK_CONFIG.baseURL}/chat/completions`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${DEEPSEEK_CONFIG.getKeyOrThrow()}` },
    body: JSON.stringify({
      model: DEEPSEEK_CONFIG.model,
      messages: [
        { role: 'system', content: 'You are a helpful assistant. Always respond with valid JSON only — no markdown, no explanation, just the raw JSON.' },
        { role: 'user', content: prompt },
      ],
      temperature: 0.7,
    }),
  })
  if (!response.ok) { const err = await response.text(); throw new Error(`DeepSeek API error ${response.status}: ${err}`) }
  const data = await response.json() as { choices: Array<{ message: { content: string } }> }
  return data.choices[0].message.content
}

export async function analyzeCareerOptions(profile: CareerProfile): Promise<CareerRecommendation[]> {
  const prompt = `You are an expert Kenyan education and career counselor specializing in the CBC system.

STUDENT PROFILE:
- Name: ${profile.studentName}
- Grade: ${profile.grade}
- Current Pathway Affinity: ${profile.pathway}
- Pathway Confidence: ${profile.pathwayConfidence}

PERFORMANCE DATA:
Strengths (Score >= 3): ${profile.strengths.join(', ')}
Weaknesses (Score <= 2): ${profile.weaknesses.join(', ')}

Subject Scores (1-4 CBC scale):
${Object.entries(profile.subjectScores).map(([subject, score]) => `- ${subject}: ${score}`).join('\n')}

TASK: Provide 5 career recommendations that match the student's strengths, are realistic for Kenya's job market, consider TVET options, and account for AI disruption.

For EACH career return: career, matchScore (0-100), reasoning, requiredSubjects, currentGaps, kenyanUniversities (top 3), tvetOptions, internationalOptions, industryDemand (very_high/high/moderate/low), earningPotential (exceptional/very_lucrative/lucrative/moderate/lower_but_stable), jobSecurity (very_high/high/moderate/low), kenyanMarketReality (2-3 sentences), aiDisruptionRisk (very_low/low/moderate/high/very_high), careerPath (3-5 steps)

CRITICAL: DO NOT include specific salary numbers. Return as a JSON array ONLY.`

  try {
    const text = await callDeepSeekText(prompt)
    const jsonMatch = text.match(/\[[\s\S]*\]/)
    if (!jsonMatch) throw new Error('Failed to parse AI response')
    const careers = JSON.parse(jsonMatch[0]) as CareerRecommendation[]
    return careers.slice(0, 5)
  } catch (error) {
    console.error('Career analysis error:', error)
    throw new Error('Failed to generate career recommendations')
  }
}

export async function generateCareerIntegratedLearningPlan(
  career: string, subject: string, currentLevel: number, targetLevel: number, studentName: string
): Promise<IntegratedLearningPlan> {
  const prompt = `You are a personalized learning coach for ${studentName}, a Kenyan CBC student.

CONTEXT:
- Career Goal: ${career}
- Subject: ${subject}
- Current CBC Level: ${currentLevel} (1=Below Expectations, 2=Approaching, 3=Meeting, 4=Exceeding)
- Target Level: ${targetLevel}

Create a personalized learning plan. Return as JSON ONLY:
{
  "whyItMatters": "...",
  "careerSpecificSteps": ["step1", "step2", "step3"],
  "careerSpecificResources": ["resource1", "resource2", "resource3"],
  "successStories": ["story1", "story2"],
  "milestones": [
    {"month": 1, "goal": "...", "careerRelevance": "..."},
    {"month": 2, "goal": "...", "careerRelevance": "..."},
    {"month": 3, "goal": "Reach level ${targetLevel}", "careerRelevance": "..."}
  ]
}

Make it INSPIRING and SPECIFIC to ${career}. Use Kenyan context. Prioritize FREE resources.`

  try {
    const text = await callDeepSeekText(prompt)
    const jsonMatch = text.match(/\{[\s\S]*\}/)
    if (!jsonMatch) throw new Error('Failed to parse AI response')
    const plan = JSON.parse(jsonMatch[0]) as Omit<IntegratedLearningPlan, 'career' | 'subject' | 'currentLevel' | 'targetLevel'>
    return { career, subject, currentLevel, targetLevel, ...plan }
  } catch (error) {
    console.error('Integrated learning plan error:', error)
    throw new Error('Failed to generate integrated learning plan')
  }
}

// ============================================================
// SECTION 11 — CAREER MATCHER CLASS (from careerMatcher.ts)
// ============================================================

interface StudentAssessmentInternal {
  academic: {
    grade: number
    subjectScores: Record<string, number>
    learningStyle: 'visual' | 'auditory' | 'kinesthetic' | 'reading'
    strongestSubjects: string[]
    strugglingSubjects: string[]
  }
  psychometric: { personalityType: string; interests: string[]; workValues: string[]; stressTolerance: 'low' | 'medium' | 'high' }
  practical: { preferredLocations: string[]; financialConstraints: 'low' | 'medium' | 'high'; familyExpectations: string[] }
  behavioral: { engagementPattern: 'consistent' | 'bursty' | 'struggling'; persistenceScore: number }
}

export interface MatchReport {
  topMatches: MatcherCareerMatch[]
  hiddenGems: MatcherCareerMatch[]
  avoidThese: MatcherCareerMatch[]
  developmentPlan: { immediate: string[]; shortTerm: string[]; longTerm: string[] }
  parentGuidance: { howToSupport: string[]; conversationsToHave: string[]; warningSigns: string[] }
  isLocked?: boolean
}

interface MatcherCareerMatch {
  career: CareerIntelligence
  matchScore: number
  matchDimensions: { academicFit: number; personalityFit: number; interestAlignment: number; practicalViability: number; futureProofing: number }
  pathway: { currentReadiness: 'ready' | 'developing' | 'early'; nextSteps: string[]; criticalGaps: string[]; estimatedTimeline: string }
  risks: { level: 'low' | 'medium' | 'high'; factors: string[]; mitigationStrategies: string[] }
  alternatives: { ifAcademicFails: string[]; ifMarketChanges: string[]; ifInterestShifts: string[] }
}

export class CareerMatcher {
  private _supabase: ReturnType<typeof createServiceClient> | null = null
  private get supabase() {
    if (!this._supabase) this._supabase = createServiceClient()
    return this._supabase
  }

  async generateMatches(studentId: string, isPremium = false): Promise<MatchReport> {
    try {
      const { data: studentMeta } = await this.supabase.from('students').select('id, name, grade, curriculum_type, year_level').eq('id', studentId).single()
      const curriculumType = (studentMeta as { curriculum_type?: string } | null)?.curriculum_type ?? 'cbc'
      const assessment = await this.compileStudentAssessment(studentId)
      const careers = await this.getRelevantCareers(assessment.academic.grade, curriculumType)
      const scoredMatches = await this.scoreAllCareers(careers, assessment)
      const topMatches = scoredMatches.slice(0, 5)
      if (!isPremium) {
        return {
          topMatches: [topMatches[0]],
          hiddenGems: [], avoidThese: [],
          developmentPlan: { immediate: ['Focus on ' + (topMatches[0].pathway.criticalGaps[0] ?? 'core subjects')], shortTerm: ['Upgrade to Premium to see full roadmap'], longTerm: [] },
          parentGuidance: { howToSupport: ['Upgrade for full parental guidance reports'], conversationsToHave: [], warningSigns: [] },
          isLocked: true,
        }
      }
      const hiddenGems = scoredMatches.filter(m => m.matchDimensions.futureProofing > 80 && m.matchScore < 75).slice(0, 3)
      const avoidThese = scoredMatches.filter(m => m.matchScore < 40).slice(0, 2)
      const developmentPlan = this.createDevelopmentPlan(topMatches[0], assessment)
      const parentGuidance = this.generateParentGuidance(assessment, topMatches[0])
      await this.saveMatchReport(studentId, topMatches)
      return { topMatches, hiddenGems, avoidThese, developmentPlan, parentGuidance, isLocked: false }
    } catch (error) {
      console.error('Match Engine Error:', error)
      throw new Error('Failed to align student with careers.')
    }
  }

  async assessSpecificCareer(studentId: string, careerName: string): Promise<{
    studentId: string; career: { id: string; name: string; description: string; pathway: string; category: string }
    assessment: { matchScore: number; compatibility: string; readiness: string }
    gaps: string[]; recommendedActions: string[]
    pathway: { currentPhase: string; nextMilestones: string[]; recommendedSubjects: string[]; extracurriculars: string[] }
    estimatedTimeToReady: string
  }> {
    const { data: student, error: studentError } = await this.supabase.from('students').select('id, name, grade, curriculum_type, year_level').eq('id', studentId).single()
    if (studentError || !student) throw new Error('Student not found')
    const { data: career, error: careerError } = await this.supabase.from('career_intelligence').select('id, name, description, category, salary_range_kes, required_subjects, cbc_mapping, ai_forecast, pathway').ilike('name', `%${careerName}%`).single()
    if (careerError || !career) throw new Error(`Career "${careerName}" not found`)
    const assessment = await this.compileStudentAssessment(studentId)
    const matchScore = this.calculateSingleMatchScore(student, career, assessment)
    const gaps = this.identifySkillGaps(student, career, assessment)
    const pathway = this.generatePathway(student, career)
    return {
      studentId,
      career: { id: (career as { id: string }).id, name: (career as { name: string }).name, description: (career as { description: string }).description, pathway: (career as { pathway: string }).pathway, category: (career as { category: string }).category },
      assessment: { matchScore, compatibility: this.getCompatibilityLabel(matchScore), readiness: this.calculateReadiness(student, career) },
      gaps, recommendedActions: this.generateActions(gaps, (student as { grade: number }).grade), pathway,
      estimatedTimeToReady: this.estimatePreparationTime(gaps, (student as { grade: number }).grade),
    }
  }

  private async compileStudentAssessment(studentId: string): Promise<StudentAssessmentInternal> {
    const [academic, psych, behavior, profile] = await Promise.all([
      this.getAcademicStats(studentId), this.getPsychometricData(studentId),
      this.getBehavioralData(), this.getProfilePracticalData(studentId),
    ])
    return { academic, psychometric: psych, behavioral: behavior, practical: profile }
  }

  private async getAcademicStats(studentId: string): Promise<StudentAssessmentInternal['academic']> {
    const { data: assessments } = await this.supabase.from('assessments').select('subject_scores, grade').eq('student_id', studentId).order('created_at', { ascending: false })
    const latest = assessments?.[0] as { subject_scores?: Record<string, number>; grade?: number } | undefined
    const scores = latest?.subject_scores ?? {}
    return {
      grade: latest?.grade ?? 7, subjectScores: scores, learningStyle: 'visual',
      strongestSubjects: Object.entries(scores).sort(([, a], [, b]) => b - a).slice(0, 3).map(([s]) => s),
      strugglingSubjects: Object.entries(scores).filter(([, s]) => s < 2.5).map(([s]) => s),
    }
  }

  private async getPsychometricData(studentId: string): Promise<StudentAssessmentInternal['psychometric']> {
    const { data } = await this.supabase.from('psychometric_assessments').select('personality_type, holland_codes, work_values, stress_tolerance').eq('student_id', studentId).single()
    const d = data as { personality_type?: string; holland_codes?: string[]; work_values?: string[]; stress_tolerance?: string } | null
    return { personalityType: d?.personality_type ?? 'analytical', interests: d?.holland_codes ?? ['Social', 'Investigative'], workValues: d?.work_values ?? ['Stability'], stressTolerance: (d?.stress_tolerance as 'low' | 'medium' | 'high') ?? 'medium' }
  }

  private getBehavioralData(): StudentAssessmentInternal['behavioral'] {
    return { engagementPattern: 'consistent', persistenceScore: 85 }
  }

  private async getProfilePracticalData(studentId: string): Promise<StudentAssessmentInternal['practical']> {
    const { data } = await this.supabase.from('students').select('location_preference, financial_tier').eq('id', studentId).single()
    const d = data as { location_preference?: string[]; financial_tier?: string } | null
    return { preferredLocations: d?.location_preference ?? ['urban'], financialConstraints: (d?.financial_tier as 'low' | 'medium' | 'high') ?? 'medium', familyExpectations: [] }
  }

  private async scoreAllCareers(careers: CareerIntelligence[], assessment: StudentAssessmentInternal): Promise<MatcherCareerMatch[]> {
    return careers.map(career => {
      const academicFit = this.calculateAcademicFit(career, assessment)
      const marketViability = 100 - career.aiForecast.automationRisk
      const personalityFit = this.calculatePersonalityFit(assessment)
      const matchScore = Math.round((academicFit * 0.3) + (marketViability * 0.3) + (personalityFit * 0.4))
      return {
        career, matchScore,
        matchDimensions: { academicFit, personalityFit, interestAlignment: personalityFit, practicalViability: 80, futureProofing: marketViability },
        pathway: {
          currentReadiness: (academicFit > 80 ? 'ready' : 'developing') as 'ready' | 'developing' | 'early',
          nextSteps: [`Focus on ${career.cbcMapping.keyLearningAreas[0] ?? 'core subjects'}`, `Join ${career.cbcMapping.suggestedCCAs?.[0] ?? 'Science Club'}`],
          criticalGaps: academicFit < 60 ? [`Low performance in ${career.cbcMapping.keyLearningAreas[0] ?? 'core subjects'}`] : [],
          estimatedTimeline: '4-6 Years',
        },
        risks: { level: (career.aiForecast.automationRisk > 50 ? 'high' : 'low') as 'low' | 'medium' | 'high', factors: [`AI automation risk: ${career.aiForecast.automationRisk}%`], mitigationStrategies: ['Focus on uniquely human creativity'] },
        alternatives: { ifAcademicFails: career.aiForecast.pivotOpportunities, ifMarketChanges: ['Consultancy', 'Teaching'], ifInterestShifts: ['Data Analytics'] },
      }
    }).sort((a, b) => b.matchScore - a.matchScore)
  }

  private calculateAcademicFit(career: CareerIntelligence, assessment: StudentAssessmentInternal): number {
    const reqs = career.cbcMapping.keyLearningAreas
    const scores = assessment.academic.subjectScores
    if (reqs.length === 0) return 70
    const total = reqs.reduce((sum, subject) => sum + ((scores[subject] ?? 0) / 4), 0)
    return Math.round((total / reqs.length) * 100)
  }

  private calculatePersonalityFit(assessment: StudentAssessmentInternal): number {
    return assessment.psychometric.interests.length > 0 ? 85 : 60
  }

  private calculateSingleMatchScore(student: { grade?: number }, career: { ai_forecast?: { automationRisk?: number }; cbc_mapping?: { keyLearningAreas?: string[] } }, assessment: StudentAssessmentInternal): number {
    const academicFit = this.calculateAcademicFit({ cbcMapping: { keyLearningAreas: career.cbc_mapping?.keyLearningAreas ?? [], juniorSchoolFocus: [], seniorSchoolPathways: [], suggestedCCAs: [], portfolioProjects: [] }, aiForecast: { automationRisk: career.ai_forecast?.automationRisk ?? 30, pivotOpportunities: [], humanAdvantage: [], timeline: '5_years' }, kenyanMarket: { sectorGrowth: 'stable', keyEmployers: [], saturationLevel: 'balanced', entryBarriers: 'medium', ruralVsUrban: 'hybrid', salaryRangeKES: { entry: 0, mid: 0, senior: 0 } }, id: '', name: '', category: 'traditional', description: '', realStories: { successProfile: '', challengesFaced: [], adviceForStudents: '' }, verificationStatus: 'ai_generated', lastUpdated: new Date() }, assessment)
    const marketViability = 100 - (career.ai_forecast?.automationRisk ?? 30)
    return Math.round((academicFit * 0.3) + (marketViability * 0.3) + (this.calculatePersonalityFit(assessment) * 0.4))
  }

  private getCompatibilityLabel(score: number): string {
    if (score >= 90) return 'Excellent Fit'; if (score >= 80) return 'Strong Match'
    if (score >= 70) return 'Good Potential'; if (score >= 60) return 'Possible with Work'
    return 'Challenging Path'
  }

  private calculateReadiness(student: { grade?: number }, _career: unknown): string {
    const grade = (student as { grade?: number }).grade ?? 7
    if (grade >= 10) return 'Ready for specialization'; if (grade >= 7) return 'Good time to start preparation'
    return 'Early exploration phase'
  }

  private identifySkillGaps(_student: unknown, career: { cbc_mapping?: { keyLearningAreas?: string[] } }, assessment: StudentAssessmentInternal): string[] {
    const requiredSubjects = career.cbc_mapping?.keyLearningAreas ?? []
    const scores = assessment.academic.subjectScores
    const gaps = requiredSubjects.filter((subject: string) => !scores[subject] || scores[subject] < 3)
    return gaps.length > 0 ? gaps : ['No critical gaps identified']
  }

  private generatePathway(student: { grade?: number }, career: { cbc_mapping?: { seniorSchoolPathways?: string[]; suggestedCCAs?: string[] } }): { currentPhase: string; nextMilestones: string[]; recommendedSubjects: string[]; extracurriculars: string[] } {
    const currentGrade = (student as { grade?: number }).grade ?? 7
    return {
      currentPhase: currentGrade <= 3 ? 'Foundation' : currentGrade <= 6 ? 'Exploration' : currentGrade <= 9 ? 'Specialization' : 'Preparation',
      nextMilestones: Array.from({ length: Math.min(3, 12 - currentGrade) }, (_, i) => `Grade ${currentGrade + i + 1}: Master core competencies`),
      recommendedSubjects: career.cbc_mapping?.seniorSchoolPathways ?? [],
      extracurriculars: career.cbc_mapping?.suggestedCCAs ?? [],
    }
  }

  private generateActions(gaps: string[], grade: number): string[] {
    if (gaps.length === 0 || gaps[0] === 'No critical gaps identified') return ['Maintain current performance', 'Explore advanced topics']
    return gaps.map(gap => grade <= 6 ? `Build foundational ${gap} through daily practice` : `Advanced ${gap} preparation with mentor guidance`)
  }

  private estimatePreparationTime(gaps: string[], grade: number): string {
    if (gaps.length === 0 || gaps[0] === 'No critical gaps identified') return 'On track with standard progression'
    const years = Math.ceil(gaps.length / 2)
    return grade + years > 12 ? 'Extended preparation needed' : `${years} year${years > 1 ? 's' : ''} with consistent effort`
  }

  private createDevelopmentPlan(topMatch: MatcherCareerMatch, _assessment: StudentAssessmentInternal): MatchReport['developmentPlan'] {
    return {
      immediate: [`Master ${topMatch.career.cbcMapping.juniorSchoolFocus[0] ?? 'core subjects'} basics`],
      shortTerm: [`Select ${topMatch.career.cbcMapping.seniorSchoolPathways[0] ?? 'your pathway'} in Grade 10`],
      longTerm: [`Aim for ${topMatch.career.kenyanMarket.keyEmployers[0] ?? 'top employers'} internships`],
    }
  }

  private generateParentGuidance(_assessment: StudentAssessmentInternal, topMatch: MatcherCareerMatch): MatchReport['parentGuidance'] {
    return {
      howToSupport: [`Buy books about ${topMatch.career.name}`],
      conversationsToHave: [`Discuss the role of AI in ${topMatch.career.name}`],
      warningSigns: [`Lack of interest in ${topMatch.career.cbcMapping.keyLearningAreas[0] ?? 'core subjects'}`],
    }
  }

  private async getRelevantCareers(grade: number, curriculumType = 'cbc'): Promise<CareerIntelligence[]> {
    const dbFallback: CareerIntelligence[] = CAREER_DATABASE.map(c => ({
      id: c.id, name: c.name, category: 'traditional' as const, description: c.realityCheck.typicalDay,
      cbcMapping: { juniorSchoolFocus: c.matchRequirements.primarySubjects, seniorSchoolPathways: [c.pathway] as ('STEM' | 'Arts & Sports' | 'Social Sciences' | 'TVET')[], keyLearningAreas: c.matchRequirements.primarySubjects, suggestedCCAs: [], portfolioProjects: [] },
      aiForecast: { automationRisk: c.aiImpact.disruptionPercentage, pivotOpportunities: c.aiImpact.survivalStrategy, humanAdvantage: [], timeline: '5_years' as const },
      kenyanMarket: { sectorGrowth: c.aiImpact.growthOutlook === 'booming' ? 'booming' : (c.aiImpact.growthOutlook as KenyanMarketData['sectorGrowth']), keyEmployers: [], saturationLevel: 'balanced', entryBarriers: 'medium', ruralVsUrban: 'hybrid', salaryRangeKES: { entry: 50000, mid: 120000, senior: 250000 } },
      realStories: { successProfile: '', challengesFaced: c.realityCheck.challenges, adviceForStudents: '' },
      verificationStatus: 'ai_generated', lastUpdated: new Date(),
    }))

    let query = this.supabase.from('career_intelligence').select('id, name, description, category, salary_range_kes, required_subjects, cbc_mapping, ai_forecast, kenyan_market, pathway, university_path').limit(20)
    if (curriculumType === 'igcse') query = query.or('curriculum_type.eq.igcse,curriculum_type.eq.both')
    else query = query.or('curriculum_type.eq.cbc,curriculum_type.eq.both,curriculum_type.is.null')

    const { data } = await query
    if (!data || data.length === 0) return dbFallback
    return data as unknown as CareerIntelligence[]
  }

  private async saveMatchReport(studentId: string, matches: MatcherCareerMatch[]): Promise<void> {
    await this.supabase.from('career_match_reports').upsert({ student_id: studentId, top_career_id: matches[0].career.id, score: matches[0].matchScore, updated_at: new Date().toISOString() }, { onConflict: 'student_id' })
  }
}

export const careerMatcher = new CareerMatcher()

// ============================================================
// SECTION 12 — DYNAMIC CAREER GENERATOR (from dynamicCareerGenerator.ts)
// ============================================================

export function convertCareerDataToDynamic(career: CareerData): DynamicCareer {
  const outlookMap: Record<string, DynamicCareer['outlook']> = { booming: 'excellent', growing: 'good', stable: 'stable', declining: 'moderate' }
  return {
    name: career.name,
    description: career.realityCheck.typicalDay,
    salary_range: `See Kenyan market rates for ${career.name}`,
    education_path: career.cbeReadiness.recommendedSeniorPath,
    education_duration: '3-4 years',
    outlook: outlookMap[career.aiImpact.growthOutlook] ?? 'good',
    demand_in_kenya: career.marketReality.demandLevel as DynamicCareer['demand_in_kenya'],
    ai_disruption_risk: career.aiImpact.disruptionRisk as DynamicCareer['ai_disruption_risk'],
    required_subjects: career.matchRequirements.primarySubjects,
    required_subjects_display: career.matchRequirements.primarySubjects.map(s => s.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase())),
    universities_in_kenya: career.cbeReadiness.universities,
    tvet_options: career.cbeReadiness.tvetOptions,
    career_path: career.aiImpact.survivalStrategy,
    is_ai_generated: false,
  }
}

export async function generateDynamicCareer(careerName: string): Promise<DynamicCareer> {
  const staticCareer = findCareerByName(careerName)
  if (staticCareer) return convertCareerDataToDynamic(staticCareer)

  const prompt = `Research career: "${careerName}" for Kenyan CBC student.
Return JSON only:
{
  "name": "exact career name",
  "description": "day-to-day reality in Kenya",
  "salary_range": "KES X - Y/month",
  "education_path": "degree/diploma needed",
  "education_duration": "X years",
  "outlook": "excellent|good|moderate|emerging|stable",
  "demand_in_kenya": "very_high|high|moderate|low",
  "ai_disruption_risk": "very_low|low|moderate|high",
  "required_subjects": ["cbc_subject_key"],
  "required_subjects_display": ["Subject Name"],
  "universities_in_kenya": ["Real Kenyan University"],
  "tvet_options": ["TVET option or empty array"],
  "career_path": ["Step 1", "Step 2", "Step 3", "Step 4"]
}`

  try {
    const response = await fetch(`${DEEPSEEK_CONFIG.baseURL}/chat/completions`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${DEEPSEEK_CONFIG.getKeyOrThrow()}` },
      body: JSON.stringify({ model: DEEPSEEK_CONFIG.model, messages: [{ role: 'system', content: 'You are a Kenyan career intelligence expert. Return ONLY valid JSON with no extra text.' }, { role: 'user', content: prompt }], temperature: 0.4, max_tokens: 1500 }),
    })
    if (!response.ok) throw new Error(`DeepSeek API error: ${response.status}`)
    const data = await response.json() as { choices: Array<{ message: { content: string } }> }
    const content = data.choices[0].message.content
    const jsonMatch = content.match(/\{[\s\S]*\}/)
    if (!jsonMatch) throw new Error('No JSON in DeepSeek response')
    const aiData = JSON.parse(jsonMatch[0]) as DynamicCareer
    return {
      name: aiData.name || careerName,
      description: aiData.description || `A career in ${careerName} in Kenya.`,
      salary_range: aiData.salary_range || 'KES 50,000 - 250,000/month',
      education_path: aiData.education_path || "Bachelor's degree in relevant field",
      education_duration: aiData.education_duration || '3-4 years',
      outlook: aiData.outlook || 'good',
      demand_in_kenya: aiData.demand_in_kenya || 'moderate',
      ai_disruption_risk: aiData.ai_disruption_risk || 'moderate',
      required_subjects: Array.isArray(aiData.required_subjects) ? aiData.required_subjects : ['mathematics', 'english'],
      required_subjects_display: Array.isArray(aiData.required_subjects_display) ? aiData.required_subjects_display : ['Mathematics', 'English'],
      universities_in_kenya: Array.isArray(aiData.universities_in_kenya) ? aiData.universities_in_kenya : ['University of Nairobi', 'Kenyatta University'],
      tvet_options: Array.isArray(aiData.tvet_options) ? aiData.tvet_options : [],
      career_path: Array.isArray(aiData.career_path) ? aiData.career_path : ['Entry Level', 'Mid Level', 'Senior Level', 'Expert'],
      is_ai_generated: true,
    }
  } catch (err) {
    console.error('DeepSeek career generation failed:', err)
    return {
      name: careerName,
      description: `A career path in ${careerName} offering opportunities for growth and development in Kenya.`,
      salary_range: 'KES 50,000 - 250,000/month (varies by experience)',
      education_path: "Bachelor's degree or diploma in relevant field",
      education_duration: '3-4 years',
      outlook: 'good',
      demand_in_kenya: 'moderate',
      ai_disruption_risk: 'moderate',
      required_subjects: ['mathematics', 'english', 'kiswahili'],
      required_subjects_display: ['Mathematics', 'English', 'Kiswahili'],
      universities_in_kenya: ['University of Nairobi', 'Kenyatta University', 'Moi University'],
      tvet_options: [],
      career_path: ['Entry Level', 'Mid Level', 'Senior Level', 'Expert / Consultant'],
      is_ai_generated: true,
    }
  }
}

export async function enhanceCareerWithAI(baseCareer: DynamicCareer): Promise<DynamicCareer> {
  const prompt = `Add insights about "${baseCareer.name}" career in Kenya. Return JSON only: {"market_insight": "...", "salary_trend": "rising|stable|declining"}`
  try {
    const response = await fetch(`${DEEPSEEK_CONFIG.baseURL}/chat/completions`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${DEEPSEEK_CONFIG.getKeyOrThrow()}` },
      body: JSON.stringify({ model: DEEPSEEK_CONFIG.model, messages: [{ role: 'system', content: 'You are a Kenyan career intelligence expert. Return ONLY valid JSON.' }, { role: 'user', content: prompt }], temperature: 0.4, max_tokens: 500 }),
    })
    if (!response.ok) throw new Error(`DeepSeek API error: ${response.status}`)
    const data = await response.json() as { choices: Array<{ message: { content: string } }> }
    const content = data.choices[0].message.content
    const jsonMatch = content.match(/\{[\s\S]*\}/)
    if (!jsonMatch) throw new Error('No JSON in response')
    const insights = JSON.parse(jsonMatch[0]) as { market_insight?: string }
    return { ...baseCareer, description: insights.market_insight ? `${baseCareer.description} ${insights.market_insight}` : baseCareer.description }
  } catch (err) {
    console.error('Career enhancement failed:', err)
    return baseCareer
  }
}

// ============================================================
// SECTION 13 — SINGLETON EXPORT
// ============================================================

export const careerEngineInstance = new CareerEngine()
