// lib/academicClinic/reportGenerator.ts

import { CareerEngine, analyzeDreamCareer } from './careerEngine'
import { calculateJuniorPathwayAffinity, formatSubjectName as pathwayFormatSubjectName } from '@/lib/pathwayCalculator'
import {
  StudentProfile,
  SubjectProgress,
  Vitals,
  ActionPlan,
  JuniorGuidance,
  SeniorGuidance,
  CareerMatch,
  GraphData,
  AcademicClinicReport,
  ClinicalOverview,
  PathwayAnalysis,
  PathwayScore,
  HolidayActionPlan,
  WeekPlan,
  LearningCompassRec,
  PathwayGapRow,
  PathwayReadinessCard,
  PathwayRoadmap,
  TermPlanAction,
  TermActionPlan,
  JuniorFutureOpportunity,
  JuniorImprovementCascade,
  JuniorActionPriority,
  ParentAction,
  SeniorReadinessIndicators,
  CareerInsightCard,
  FutureScenario,
  SeniorActionPriority,
} from './types'

// ─── Subject Metadata ─────────────────────────────────────────────────────────

export const SUBJECT_EMOJIS: Record<string, string> = {
  english: '📖',
  mathematics: '🔢',
  core_mathematics: '🔢',
  essential_mathematics: '🔢',
  kiswahili_ksl: '🗣️',
  kiswahili: '🗣️',
  integrated_science: '🔬',
  biology: '🧬',
  chemistry: '⚗️',
  physics: '⚡',
  computer_studies: '💻',
  social_studies: '🌐',
  history_citizenship: '📜',
  history: '📜',
  geography: '🌍',
  business_studies: '💼',
  agriculture_nutrition: '🌱',
  agriculture: '🌱',
  creative_arts_sports: '🎨',
  physical_education: '⚽',
  sports_recreation: '🏃',
  music_dance: '🎵',
  theatre_film: '🎭',
  fine_arts: '🖌️',
  home_science: '🏠',
  pre_technical: '🔧',
  community_service: '🤝',
  religious_education: '✝️',
  cre: '✝️',
  ire: '☪️',
}

export function getSubjectEmoji(subject: string): string {
  return SUBJECT_EMOJIS[subject] || '📚'
}

// ─── Format Subject Name ──────────────────────────────────────────────────────

export function formatSubjectName(key: string): string {
  const specialCases: Record<string, string> = {
    core_mathematics: 'Core Mathematics',
    essential_mathematics: 'Essential Mathematics',
    integrated_science: 'Integrated Science',
    social_studies: 'Social Studies',
    creative_arts_sports: 'Creative Arts & Sports',
    pre_technical: 'Pre-Technical Studies',
    agriculture_nutrition: 'Agriculture & Nutrition',
    kiswahili_ksl: 'Kiswahili/KSL',
    community_service: 'Community Service Learning',
    computer_studies: 'Computer Studies',
    home_science: 'Home Science',
    business_studies: 'Business Studies',
    history_citizenship: 'History & Citizenship',
    physical_education: 'Physical Education',
    sports_recreation: 'Sports & Recreation',
    music_dance: 'Music & Dance',
    theatre_film: 'Theatre & Film',
    fine_arts: 'Fine Arts',
    religious_education: 'Religious Education',
    cre: 'Christian Religious Education',
    ire: 'Islamic Religious Education',
  }
  if (specialCases[key]) return specialCases[key]
  return key.split('_').map(w => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase()).join(' ')
}

// ─── Level Labels ─────────────────────────────────────────────────────────────

export function getLevelLabel(level: number): string {
  return ['', 'Emerging', 'Developing', 'Proficient', 'Exemplary'][level] || 'Unknown'
}

// ─── Clinical Observations (subject + level specific) ────────────────────────

const CLINICAL_OBS: Record<string, Record<number, string>> = {
  mathematics: {
    1: 'Critical gap in mathematical foundations. Clinical recommendation: daily 15-minute structured practice targeting number operations, fractions, and algebraic thinking.',
    2: 'Developing mathematical competency with identifiable procedural gaps. Structured support in problem-solving strategies and concept application is indicated.',
    3: 'Demonstrates proficient mathematical reasoning. Trajectory indicates readiness for advanced problem-solving and applied quantitative work.',
    4: 'Exceptional mathematical aptitude identified. Clinical recommendation: advanced enrichment through competition mathematics and applied STEM projects.',
  },
  core_mathematics: {
    1: 'Critical gap in core mathematical foundations. Priority intervention required in number sense, algebraic reasoning, and mathematical communication.',
    2: 'Developing mathematical competency with gaps in procedural fluency. Structured intervention in key concept areas will accelerate progress.',
    3: 'Demonstrates solid proficiency in core mathematics. Well-positioned for STEM pathway advancement and higher-level quantitative courses.',
    4: 'Exceptional aptitude in core mathematics. Strong candidate for advanced mathematics tracks and STEM-oriented university programmes.',
  },
  essential_mathematics: {
    1: 'Foundational numeracy gaps identified as a priority intervention area. Concrete, practical mathematics in real-world contexts is clinically recommended.',
    2: 'Developing numerical and functional competency. Structured practical application of mathematics concepts will build confidence and fluency.',
    3: 'Demonstrates functional mathematical competency. Positive trajectory for applied contexts in business, finance, and vocational pathways.',
    4: 'Exceptional practical mathematical aptitude. Outstanding foundation for business, finance, and technical career pathways.',
  },
  english: {
    1: 'Critical gaps in English language competency identified. Priority intervention in reading comprehension, vocabulary development, and written expression is indicated.',
    2: 'Developing English language proficiency with emerging communication ability. A structured reading programme with teacher-supported writing tasks will accelerate progress.',
    3: 'Demonstrates proficient English competency. Strong academic communication foundation well-suited for humanities and professional pathways.',
    4: 'Exceptional English language aptitude. Clinical recommendation: advanced reading programmes, essay competitions, and debate club engagement.',
  },
  kiswahili_ksl: {
    1: 'Emerging Kiswahili competency identified as a priority intervention area. Daily reading and structured oral practice is clinically recommended.',
    2: 'Developing Kiswahili language skills with gaps in written expression. Regular engagement with Kiswahili literature and grammar exercises is indicated.',
    3: 'Demonstrates proficient Kiswahili competency. Solid national language foundation for communication and civic engagement.',
    4: 'Exceptional Kiswahili language aptitude. Outstanding linguistic asset for law, diplomacy, and communication pathways.',
  },
  kiswahili: {
    1: 'Emerging Kiswahili competency identified as a priority intervention area. Daily reading and structured oral expression practice is recommended.',
    2: 'Developing Kiswahili skills. Regular reading of Kiswahili literature and structured grammar practice will strengthen competency.',
    3: 'Demonstrates proficient Kiswahili language competency. Positive trajectory for national language development.',
    4: 'Exceptional Kiswahili aptitude. A significant linguistic asset across multiple career and civic pathways.',
  },
  integrated_science: {
    1: 'Critical gap in scientific reasoning and process skills. Practical laboratory engagement and concept mapping are clinically recommended to build foundational understanding.',
    2: 'Emerging scientific competency. Structured inquiry-based learning and regular practical work will strengthen conceptual and procedural science skills.',
    3: 'Demonstrates proficient scientific thinking and investigative reasoning. Strong trajectory for specialisation in biology, chemistry, or physics.',
    4: 'Exceptional scientific aptitude identified. Strong STEM pathway candidate — science fair participation and advanced projects are recommended.',
  },
  biology: {
    1: 'Critical gap in biological sciences. Structured support using annotated diagrams, mnemonics, and concept maps is a priority clinical intervention.',
    2: 'Developing biology competency with gaps in cellular processes and ecological systems. Regular structured revision will build deeper conceptual understanding.',
    3: 'Demonstrates proficient understanding of biological systems. Excellent foundation for medicine, health sciences, and environmental pathways.',
    4: 'Exceptional biological aptitude identified. Medical, veterinary, nursing, and biomedical research pathways are strongly indicated.',
  },
  chemistry: {
    1: 'Critical gap in chemistry fundamentals. Intensive support in atomic structure, chemical bonding, and stoichiometry is a priority clinical intervention.',
    2: 'Developing chemistry competency with gaps in equation balancing and periodic trends. Structured practice will build procedural and conceptual fluency.',
    3: 'Demonstrates solid chemistry proficiency. Well-positioned for advanced sciences, engineering, and health-related university programmes.',
    4: 'Exceptional chemistry aptitude. Medicine, chemical engineering, pharmacy, and materials science pathways are strongly indicated.',
  },
  physics: {
    1: 'Critical gap in physics reasoning. Practical experiments and real-world problem applications are clinically recommended to build conceptual foundations.',
    2: 'Emerging physics competency with gaps in applied problem-solving. Structured support in mechanics, waves, and electricity is indicated.',
    3: 'Demonstrates proficient physics understanding. Strong trajectory for engineering, architecture, and applied technology pathways.',
    4: 'Exceptional physics aptitude. Engineering, aerospace, computer science, and applied sciences are strongly indicated career pathways.',
  },
  computer_studies: {
    1: 'Critical gap in digital literacy and computational thinking. Structured hands-on lab practice is a priority intervention area.',
    2: 'Developing computing competency. Regular practical engagement with software applications and logical problem-solving will build technical confidence.',
    3: 'Demonstrates proficient computing skills. Trajectory indicates readiness for advanced ICT, programming, and digital systems work.',
    4: 'Exceptional computing aptitude identified. Software engineering, data science, and cybersecurity pathways are strongly indicated.',
  },
  social_studies: {
    1: 'Emerging social studies competency. Structured engagement with civic, cultural, and historical concepts is clinically recommended.',
    2: 'Developing social understanding with gaps in civic reasoning and historical context. Regular reading of structured summaries will build competency.',
    3: 'Demonstrates proficient social and civic knowledge. Strong foundation for humanities, law, and public service pathways.',
    4: 'Exceptional social studies aptitude. Law, governance, education, diplomacy, and development studies are strongly indicated.',
  },
  history_citizenship: {
    1: 'Priority intervention in historical reasoning and civic understanding. Narrative-based, story-driven learning is clinically recommended.',
    2: 'Developing historical competency. Structured review of key events, timelines, and civic frameworks will build deeper understanding.',
    3: 'Demonstrates proficient understanding of history and citizenship. Excellent foundation for social sciences and civic leadership.',
    4: 'Exceptional historical and civic aptitude. Law, political science, diplomacy, and public administration are strongly indicated.',
  },
  geography: {
    1: 'Critical gap in geographical concepts. Map work, fieldwork case studies, and structured notes on physical geography are priority interventions.',
    2: 'Emerging geographical competency. Regular engagement with maps, climate systems, and human geography topics will build foundational skills.',
    3: 'Demonstrates solid geographical understanding. Good trajectory for environmental science, land planning, and resource management pathways.',
    4: 'Exceptional geography aptitude. Environmental management, urban planning, cartography, and geospatial science pathways are indicated.',
  },
  business_studies: {
    1: 'Critical gap in business and financial literacy. Structured support in entrepreneurship principles, accounting basics, and marketing is indicated.',
    2: 'Developing business competency. Practical entrepreneurship projects and accounting exercises will accelerate understanding and application.',
    3: 'Demonstrates proficient business acumen. Positive trajectory for commerce, management, and entrepreneurship pathways.',
    4: 'Exceptional business aptitude. Entrepreneurship, finance, strategic management, and economics are strongly indicated career pathways.',
  },
  creative_arts_sports: {
    1: 'Emerging aptitude in creative arts and sports. Structured extracurricular engagement with art or sports programmes is recommended to build foundational expression.',
    2: 'Developing creative and physical competency. Regular participation in structured arts or sports activities will unlock and develop latent talent.',
    3: 'Demonstrates proficient creative and athletic expression. Strong trajectory for arts, design, sports science, and physical education pathways.',
    4: 'Exceptional creative and athletic aptitude. Sports science, graphic design, performing arts, and coaching pathways are strongly indicated.',
  },
  agriculture_nutrition: {
    1: 'Priority intervention in agriculture and nutrition concepts. Practical farm-based and kitchen-based learning activities are clinically recommended.',
    2: 'Developing agricultural and nutritional competency. Hands-on field engagement and structured nutritional case studies will strengthen understanding.',
    3: 'Demonstrates proficient agricultural and nutritional knowledge. Good foundation for agribusiness, food science, and environmental sustainability.',
    4: 'Exceptional aptitude in agriculture and nutrition. Agribusiness, food technology, nutritional science, and environmental management are strongly indicated.',
  },
  pre_technical: {
    1: 'Critical gap in technical and practical skills. Structured workshop-based learning with basic tools and technical drawing is a priority intervention.',
    2: 'Developing technical competency. Regular hands-on practice with design and construction activities will build both skill and confidence.',
    3: 'Demonstrates proficient technical aptitude. Excellent foundation for engineering, architecture, and skilled vocational pathways.',
    4: 'Exceptional technical and design aptitude. Engineering, architecture, industrial design, and skilled trades are strongly indicated.',
  },
  home_science: {
    1: 'Emerging home science competency. Structured practical engagement in food preparation, textiles, and household management is recommended.',
    2: 'Developing home science skills. Regular practicals in nutrition, fabric work, and home management will strengthen procedural competency.',
    3: 'Demonstrates proficient home science knowledge. Good foundation for hospitality, nutrition, and health-related pathways.',
    4: 'Exceptional home science aptitude. Hospitality management, nutritional science, interior design, and childcare pathways are strongly indicated.',
  },
  music_dance: {
    1: 'Emerging musical and rhythmic aptitude. Regular structured practice with an instrument or movement discipline is recommended.',
    2: 'Developing musical and movement competency. Consistent practice and performance participation will accelerate artistic growth.',
    3: 'Demonstrates proficient musical and choreographic expression. Strong candidate for performing arts development and competition.',
    4: 'Exceptional musical and dance aptitude. Performing arts, music production, choreography, and arts education are strongly indicated.',
  },
  physical_education: {
    1: 'Emerging physical competency. Structured conditioning, technique coaching, and regular sports participation are recommended.',
    2: 'Developing physical fitness and motor coordination. Consistent training routines will build both competency and athletic confidence.',
    3: 'Demonstrates proficient physical education performance. Positive trajectory for sports science and coaching pathways.',
    4: 'Exceptional athletic aptitude. Sports science, physiotherapy, sports coaching, and physical education teaching are strongly indicated.',
  },
  community_service: {
    1: 'Limited engagement in community service identified. Structured project participation with clear civic goals is recommended.',
    2: 'Developing civic engagement. Regular participation in school and community service initiatives is indicated to build social responsibility.',
    3: 'Demonstrates consistent civic engagement and a developing service ethic. Positive social leadership trajectory.',
    4: 'Exceptional civic leadership and service aptitude. Social entrepreneurship, development work, and community leadership are strongly indicated.',
  },
}

const DEFAULT_OBS: Record<number, string> = {
  1: 'Priority intervention area identified. Structured and targeted support is clinically recommended to address foundational gaps in this subject.',
  2: 'Emerging competency with identifiable gaps. Consistent structured practice will support progression toward proficiency.',
  3: 'Demonstrates proficient competency. Trajectory indicates steady and sustainable academic progress in this subject.',
  4: 'Exceptional aptitude demonstrated. Enrichment, advanced engagement, and leadership opportunities are clinically recommended.',
}

export function getClinicalObservation(subject: string, level: number): string {
  return CLINICAL_OBS[subject]?.[level] ?? DEFAULT_OBS[level] ?? DEFAULT_OBS[2]
}

// ─── Calculate Vitals ─────────────────────────────────────────────────────────

export function calculateVitals(subjects: SubjectProgress[]): Vitals {
  const total = subjects.reduce((sum, s) => sum + s.level, 0)
  return {
    overallAverage: parseFloat((total / subjects.length).toFixed(1)),
    strengths: subjects.filter(s => s.level >= 3).length,
    needsWork: subjects.filter(s => s.level === 2).length,
    urgent: subjects.filter(s => s.level === 1).length,
  }
}

// ─── Clinical Overview (Page 2) ───────────────────────────────────────────────

function buildClinicalParagraph(firstName: string, subjects: SubjectProgress[], avg: number): string {
  const byDesc    = [...subjects].sort((a, b) => b.level - a.level)
  const byAsc     = [...subjects].sort((a, b) => a.level - b.level)
  const top2      = byDesc.slice(0, 2).map(s => s.displayName)
  // FIX 4: only mention subjects as challenges if level <= 2
  const weak2     = byAsc.filter(s => s.level <= 2).slice(0, 2).map(s => s.displayName)
  const topLvl    = byDesc[0] ? getLevelLabel(byDesc[0].level) : ''

  if (avg >= 3.5) {
    return `${firstName} demonstrates exceptional overall academic competency, with outstanding performance across the majority of assessed subjects. ` +
      `Highest-performing areas include ${top2.join(' and ')}, where ${firstName} operates at ${topLvl} level — placing this student among the upper tier of the academic cohort. ` +
      (weak2.length > 0
        ? `${weak2[0]} represents an emerging challenge that warrants targeted attention to maintain the overall trajectory. `
        : '') +
      `Clinical recommendation: sustain high performance through advanced enrichment and competition exposure while proactively closing any emerging gaps.`
  }
  if (avg >= 3.0) {
    return `${firstName} demonstrates strong and consistent academic competency, with a well-rounded performance profile across assessed subjects. ` +
      `Areas of particular strength include ${top2.join(' and ')}, which reflect ${firstName}'s core academic aptitudes and should be actively nurtured. ` +
      (weak2.length > 0
        ? `${firstName} demonstrates an emerging challenge in ${weak2.join(' and ')}, representing a priority intervention area to prevent further progression gaps. `
        : '') +
      `The overall trajectory indicates a highly capable learner well-positioned for continued academic advancement with targeted support in identified areas.`
  }
  if (avg >= 2.5) {
    return `${firstName} demonstrates developing competency with clear academic strengths emerging in ${top2.join(' and ')}. ` +
      (weak2.length > 0
        ? `The assessment identifies ${weak2.join(' and ')} as priority intervention areas requiring structured and consistent support to close identified foundational gaps. `
        : '') +
      `${firstName}'s performance trajectory indicates a learner with real potential — with targeted intervention, meaningful improvement is achievable within one academic term. ` +
      `Clinical recommendation: implement the 3-week holiday action plan with particular focus on identified priority areas to build a stronger foundation for the coming term.`
  }
  if (avg >= 2.0) {
    return `${firstName}'s current assessment reveals developing competency across the curriculum, with relative strengths observed in ${top2.join(' and ')}. ` +
      (weak2.length > 0
        ? `Priority intervention areas include ${weak2.join(' and ')}, where foundational gaps have been clearly identified and require immediate structured support. `
        : '') +
      `The trajectory indicates that consistent, structured support is essential at this stage to unlock ${firstName}'s academic potential. ` +
      `Clinical recommendation: an intensive holiday study programme combined with regular EduNexus Learning Compass sessions will be critical in reversing this trajectory.`
  }
  return `${firstName}'s current assessment reveals emerging competency across multiple curriculum areas, with ${weak2.join(' and ')} identified as critical priority intervention areas. ` +
    `Foundational gaps across several subjects indicate that intensive, structured support is urgently required. ` +
    `Early and consistent intervention at this developmental stage yields significantly positive outcomes — the holiday period represents a critical intervention window. ` +
    `Clinical recommendation: implement the daily holiday study plan immediately, engage the EduNexus Learning Compass three times per week, and share this report with ${firstName}'s class teacher.`
}

export function generateClinicalOverview(
  firstName: string,
  subjects: SubjectProgress[],
  assessments: Array<Record<string, unknown>>
): ClinicalOverview {
  const avg        = subjects.reduce((s, x) => s + x.level, 0) / subjects.length
  const rounded    = Math.max(1, Math.min(4, Math.round(avg))) as 1 | 2 | 3 | 4
  const byDesc     = [...subjects].sort((a, b) => b.level - a.level)
  const byAsc      = [...subjects].sort((a, b) => a.level - b.level)

  const clinicalStrengths = byDesc.filter(s => s.level >= 3).slice(0, 3)
  const priorityAreas     = byAsc.filter(s => s.level <= 2).slice(0, 3)

  let trajectory: 'IMPROVING' | 'STABLE' | 'NEEDS ATTENTION' | 'CRITICAL' = 'STABLE'
  if (avg < 1.5) {
    trajectory = 'CRITICAL'
  } else if (assessments.length >= 2) {
    const prev     = (assessments[assessments.length - 2]?.subject_scores as Record<string, number>) || {}
    const prevVals = Object.values(prev)
    if (prevVals.length > 0) {
      const prevAvg = prevVals.reduce((s, v) => s + (v || 0), 0) / prevVals.length
      const diff    = avg - prevAvg
      if (diff > 0.15)       trajectory = 'IMPROVING'
      else if (diff < -0.15) trajectory = 'NEEDS ATTENTION'
      else                   trajectory = 'STABLE'
    }
  } else {
    if (avg < 2.0)      trajectory = 'NEEDS ATTENTION'
    else if (avg < 1.5) trajectory = 'CRITICAL'
  }

  return {
    overallCompetencyLevel: rounded,
    overallCompetencyLabel: getLevelLabel(rounded),
    clinicalParagraph:      buildClinicalParagraph(firstName, subjects, avg),
    clinicalStrengths,
    priorityAreas,
    trajectory,
  }
}

// ─── Pathway Analysis (Junior — Page 4A) ──────────────────────────────────────
// PATHWAY_MAP is used by generateReport to build pathway-specific reasons text.

const PATHWAY_MAP: Record<string, 'STEM' | 'Social Sciences' | 'Arts & Sports Science'> = {
  mathematics: 'STEM', core_mathematics: 'STEM', essential_mathematics: 'STEM',
  integrated_science: 'STEM', biology: 'STEM', chemistry: 'STEM', physics: 'STEM',
  computer_studies: 'STEM', pre_technical_studies: 'STEM', pre_technical: 'STEM',
  social_studies: 'Social Sciences', history_citizenship: 'Social Sciences',
  history: 'Social Sciences', geography: 'Social Sciences',
  business_studies: 'Social Sciences', agriculture_nutrition: 'Social Sciences',
  agriculture: 'Social Sciences', home_science: 'Social Sciences',
  community_service: 'Social Sciences', religious_education: 'Social Sciences',
  cre: 'Social Sciences', ire: 'Social Sciences',
  creative_arts_sports: 'Arts & Sports Science', physical_education: 'Arts & Sports Science',
  sports_recreation: 'Arts & Sports Science', music_dance: 'Arts & Sports Science',
  theatre_film: 'Arts & Sports Science', fine_arts: 'Arts & Sports Science',
}

// ─── Junior Guidance (web UI backward compat) ─────────────────────────────────

export function generateJuniorGuidance(subjects: SubjectProgress[]): JuniorGuidance {
  const vitals  = calculateVitals(subjects)
  const avg     = vitals.overallAverage
  const rec     = avg >= 3.0 ? 'STEM' : avg >= 2.0 ? 'Social Sciences' : 'Arts & Sports Science'
  return {
    recommendedPathway: rec as any,
    reasoning: `With an average of ${avg}/4.0, the ${rec} pathway is recommended based on current performance.`,
    strengths:       subjects.filter(s => s.level >= 3).map(s => s.displayName).slice(0, 3),
    areasToImprove:  subjects.filter(s => s.level <= 2).map(s => s.displayName).slice(0, 3),
  }
}

// ─── Career Intelligence (Senior — Page 4B) ───────────────────────────────────

export function generateSeniorGuidance(subjects: SubjectProgress[], firstName = 'This student', grade = 10, currentPathway?: string): SeniorGuidance {
  const engine = new CareerEngine()
  const scores = Object.fromEntries(subjects.map(s => [s.subject, s.level]))
  const subjectAvg = subjects.reduce((s, x) => s + x.level, 0) / subjects.length
  const tier: 'high' | 'mid' | 'low' = subjectAvg >= 3.0 ? 'high' : subjectAvg >= 2.0 ? 'mid' : 'low'

  // Careers below this score read as discouraging ("21% match") rather than useful —
  // hide them here at the report layer so the shared engine's hidden-gems threshold (35) stays intact.
  const MIN_DISPLAY_SCORE = 45
  const engineResults = engine.matchCareers(scores, tier, 'cbc', currentPathway)
    .filter(match => match.matchScore >= MIN_DISPLAY_SCORE)
    .slice(0, 3)

  const assessedSubjectKeys = subjects.map(s => s.subject)

  const scored = engineResults.map(match => {
    const keyHits = subjects.filter(s => match.career.matchRequirements.primarySubjects.includes(s.subject))
    const strongSubjectKeys = keyHits.filter(s => s.level >= 3).map(s => s.subject)
    // FIX 1: only gap subjects the student was actually assessed on
    // FIX 3: exclude subjects already listed in whyItFits (level >= 3) to avoid contradiction
    const gapSubjects = match.gapSubjects
      .filter(s => assessedSubjectKeys.includes(s) && !strongSubjectKeys.includes(s))
      .map(s => formatSubjectName(s))
    const score = match.matchScore / 25
    // FIX 2: thresholds aligned to score >= 3.5 / 2.5 (matchScore >= 87.5 / 62.5)
    const matchStrength: 'STRONG' | 'GOOD' | 'POSSIBLE' = score >= 3.5 ? 'STRONG' : score >= 2.5 ? 'GOOD' : 'POSSIBLE'
    return {
      career: {
        name: match.career.name,
        kenyanPathway: match.career.cbeReadiness.recommendedSeniorPath,
        requiredSubjects: match.career.matchRequirements.primarySubjects,
      },
      score, matchStrength, keyHits, gapSubjects,
    }
  })

  const topCareers: CareerMatch[] = scored.map(({ career, matchStrength, keyHits, gapSubjects, score }) => {
    const strong = keyHits.filter(s => s.level >= 3).map(s => s.displayName)
    const whyItFits = strong.length > 0
      ? `${firstName} demonstrates ${getLevelLabel(keyHits[0]?.level || 3)} competency in ${strong.slice(0, 2).join(' and ')}, core requirements for ${career.name}.`
      : `Developing aptitude across subjects aligned with ${career.name} entry requirements — structured support will strengthen this match.`
    const keyGap = gapSubjects.length > 0
      ? `${gapSubjects[0]} requires structured support to meet ${career.name} entry requirements.`
      : `Maintain current strong performance across all relevant subjects to remain competitive.`
    return {
      name: career.name,
      description: career.name,
      matchPercentage: Math.round((score / 4) * 100),
      matchStrength,
      whyItFits,
      keyGap,
      kenyanPathway: career.kenyanPathway,
      requiredSubjects: career.requiredSubjects,
    }
  })

  const honestAssessment = topCareers.length === 0
    ? `Current subject performance hasn't yet produced a confident career match. Complete more assessments and focus on the action plan below — clearer pathway recommendations will follow as performance data builds up.`
    : subjectAvg >= 3.0 && topCareers.length >= 2
    ? `Based on current performance data, ${topCareers[0].name} and ${topCareers[1].name} represent realistic and well-matched pathways. With sustained effort and targeted support in identified gap areas, these careers are genuinely achievable through the Kenyan university system.`
    : subjectAvg >= 3.0
    ? `Based on current performance data, ${topCareers[0].name} represents a realistic and well-matched pathway. With sustained effort and targeted support in identified gap areas, this career is genuinely achievable through the Kenyan university system.`
    : `Current performance indicates that focused preparation will be required before these career pathways become fully accessible. The holiday action plan and consistent Learning Compass sessions are critical tools for closing the identified gaps before KCSE.`

  return {
    topCareers,
    reasoning: `Career recommendations are based on ${firstName}'s subject performance and the entry requirements for each pathway in the Kenyan education system.`,
    nextSteps: [
      `Prioritise strengthening ${subjects.sort((a, b) => a.level - b.level)[0]?.displayName || 'priority subjects'} before the next term`,
      'Research KCSE minimum grade requirements for target university programmes',
      grade <= 10
        ? 'Speak with your career counsellor about pathway choices before Grade 10 selections'
        : 'Speak with your career counsellor about university pathway and subject choices',
    ],
    honestAssessment,
  }
}

// ─── Holiday Action Plan (Page 5) ────────────────────────────────────────────

const SUBJECT_TOPICS: Record<string, { low: string[]; mid: string[]; high: string[] }> = {
  mathematics: {
    low:  ['Fractions, decimals, and percentages — 20 practice problems per day', 'Basic algebra: simplify and solve linear equations', 'Work through 2 past paper questions from your weakest topic'],
    mid:  ['Word problems and applied mathematics in real-world contexts', 'Statistics: mean, mode, median, and data interpretation', 'Geometry: areas, volumes, and angle calculations'],
    high: ['Attempt one competition-level problem daily', 'Explore real-world applications: finance maths, data analysis', 'Teach a core concept to a sibling or peer to test mastery'],
  },
  core_mathematics: {
    low:  ['Number operations: fractions, indices, and surds', 'Linear equations and basic algebraic manipulation', 'Work through 3 past paper questions from your class notes'],
    mid:  ['Quadratic equations and factorisation techniques', 'Statistics and probability fundamentals', 'Coordinate geometry: distance, midpoint, and gradient'],
    high: ['Calculus introduction: differentiation and basic integration', 'Vectors and transformation geometry', 'Peer-teach 2 key concepts to reinforce mastery'],
  },
  english: {
    low:  ['Read one newspaper article daily and summarise it in 3 sentences', 'Practice letter writing: formal and informal formats', 'Vocabulary building: learn and use 5 new words per day'],
    mid:  ['Write one essay per week on a provided or chosen topic', 'Grammar: focus on tense consistency and punctuation', 'Read a short story and identify narrative techniques'],
    high: ['Write a persuasive speech on a current Kenyan issue', 'Analyse a poem or prose extract using literary devices', 'Start a reading journal: one novel over the holiday'],
  },
  kiswahili_ksl: {
    low:  ['Read one page of Kiswahili daily and circle unfamiliar words', 'Practice basic sentence construction: present and past tense', 'Memorise 10 new Kiswahili vocabulary words per day'],
    mid:  ['Write a short insha (composition) on a familiar topic', 'Grammar: noun classes, tense markers, and agreement', 'Read a simple Kiswahili storybook cover to cover'],
    high: ['Write a formal barua (letter) and a poem in Kiswahili', 'Analyse a selected Kiswahili set text for themes and style', 'Practise spoken Kiswahili with a family member for 10 mins daily'],
  },
  kiswahili: {
    low:  ['Read one page of Kiswahili daily and circle unfamiliar words', 'Practice basic sentence construction: present and past tense', 'Memorise 10 new Kiswahili vocabulary words per day'],
    mid:  ['Write one composition on a familiar topic', 'Grammar: tense markers and noun class agreement', 'Read a short Kiswahili story from start to finish'],
    high: ['Write a formal letter and a poem in Kiswahili', 'Analyse a set text for literary themes and author style', 'Practice conversational Kiswahili for 10 minutes daily'],
  },
  integrated_science: {
    low:  ['Draw and label 3 key diagrams from your class notes (cells, plants, atoms)', 'Create a concept map connecting the main topics from this term', 'Review the scientific method: hypothesis, experiment, conclusion'],
    mid:  ['Write summaries of each major topic from the term', 'Practice explaining a scientific process to someone at home', 'Complete 10 past paper questions per topic'],
    high: ['Design a simple home experiment and record your observations', 'Research a Kenyan environmental science issue and write a report', 'Read about a current scientific discovery and explain its relevance'],
  },
  biology: {
    low:  ['Draw and label the cell structure (plant and animal cells)', 'Create annotated diagrams for 3 key biological processes', 'Memorise the 7 characteristics of living things with examples'],
    mid:  ['Write out the process of photosynthesis and respiration step by step', 'Revise human body systems: digestive, circulatory, respiratory', 'Complete 10 structured past paper biology questions'],
    high: ['Research a medical condition and explain its biological basis', 'Create a teaching guide on one biology topic for a younger student', 'Explore career pathways in medicine and what KCSE grades they require'],
  },
  chemistry: {
    low:  ['Memorise the first 20 elements of the periodic table with symbols', 'Practice balancing 10 simple chemical equations per day', 'Draw atom diagrams for the first 10 elements'],
    mid:  ['Review acids, bases, and salts — write out reactions', 'Practice stoichiometry: mole calculations from past papers', 'Create flashcards for key chemistry definitions and reactions'],
    high: ['Attempt organic chemistry problems from past Form 3/4 papers', 'Research a real-world chemistry application (food science, medicine, engineering)', 'Write a summary of the key reactions tested in KCSE chemistry'],
  },
  physics: {
    low:  ['Review the 3 laws of motion with real-life examples from daily life', 'Practice unit conversions: speed, force, pressure, energy', 'Draw circuit diagrams for simple series and parallel circuits'],
    mid:  ['Solve 5 numerical problems per topic from your physics notes', 'Review waves: properties, sound, and light', 'Create a formula sheet for all topics covered this term'],
    high: ['Attempt KCSE-style physics paper questions under timed conditions', 'Research a physics application in engineering or technology', 'Explain a complex concept (e.g., electromagnetism) using real objects at home'],
  },
  computer_studies: {
    low:  ['Practice using Microsoft Word, Excel, and PowerPoint for 20 mins daily', 'Learn the parts of a computer and their functions', 'Practise typing accuracy: target 20 words per minute'],
    mid:  ['Write a short program in Python or Scratch to solve a simple problem', 'Learn basic spreadsheet formulas: SUM, AVERAGE, IF, VLOOKUP', 'Create a presentation on a topic of your choice using PowerPoint'],
    high: ['Build a small web page using HTML and basic CSS', 'Learn and apply one new programming concept per day (loops, functions, arrays)', 'Research how AI or data science is being used in Kenya'],
  },
  social_studies: {
    low:  ['Read and summarise one chapter from your social studies textbook daily', 'Draw a labelled map of Kenya showing provinces, cities, and landmarks', 'List 5 key facts about Kenya\'s history and government structure'],
    mid:  ['Write an essay on a civic topic: elections, rights, responsibilities', 'Research one African country\'s history and compare it to Kenya\'s', 'Practice past paper questions on geography and history topics'],
    high: ['Read a current news article daily and analyse its civic or historical significance', 'Write a debate speech on a Kenyan social or political issue', 'Research Kenya\'s Vision 2030 and its implications for young people'],
  },
  history_citizenship: {
    low:  ['Create a timeline of 10 key events in Kenyan history', 'Learn the structure of the Kenyan government (executive, legislature, judiciary)', 'Read one chapter from your history textbook and write 5 key points'],
    mid:  ['Write a structured essay on a Kenyan historical period or event', 'Research the role of a significant Kenyan leader and their impact', 'Complete 10 past paper history and government questions'],
    high: ['Analyse a primary source document from Kenyan history', 'Write a civic essay comparing Kenya\'s constitution with that of another African country', 'Research a current governance challenge in Kenya and propose solutions'],
  },
  business_studies: {
    low:  ['Read and summarise one chapter from your business studies textbook daily', 'Practice basic accounting: assets, liabilities, and simple T-accounts', 'Learn the 4 Ps of marketing with real Kenyan business examples'],
    mid:  ['Create a simple business plan for a small enterprise of your choice', 'Practice past paper accounting questions: trial balance, profit and loss', 'Research a successful Kenyan entrepreneur and identify their key success factors'],
    high: ['Analyse a Kenyan company\'s annual report for revenue trends and strategy', 'Write a detailed feasibility study for a youth-focused business idea', 'Study the Kenyan stock market (NSE) and research 3 listed companies'],
  },
  geography: {
    low:  ['Label a physical map of Africa and identify major landforms and rivers', 'Learn the difference between climate and weather with Kenyan examples', 'Draw diagrams of key landforms: escarpment, rift valley, delta'],
    mid:  ['Write structured notes on human geography: population, urbanisation, agriculture', 'Practice map reading and interpretation using school atlas exercises', 'Complete 10 geography past paper questions from the relevant term topics'],
    high: ['Research a current environmental challenge in East Africa and propose solutions', 'Analyse population data for Kenya and create a written interpretation', 'Write a fieldwork report on a local geographical feature or land use issue'],
  },
  creative_arts_sports: {
    low:  ['Spend 20 minutes daily on a creative activity: drawing, painting, or craft', 'Participate in any physical activity or sport for 30 minutes every day', 'Create a simple portfolio of 5 original drawings or designs'],
    mid:  ['Complete a creative project of your choice: artwork, photography, or crafts', 'Join or organise a physical activity or sports practice session this holiday', 'Research a Kenyan artist, musician, or athlete and write a profile'],
    high: ['Create a polished artwork or design portfolio (minimum 5 pieces)', 'Train for a specific sport or artistic performance you want to showcase next term', 'Submit a creative piece for a school or community competition'],
  },
}

// Week-type activity pools — each week gets a DIFFERENT set regardless of subject
const FOUNDATION_ACTIVITIES = [
  'Identify and review key concepts from your teacher notes and textbook',
  'Complete 10 practice questions per session — focus on accuracy, not speed',
  'Create a summary mind-map of the core topics covered this term',
]

const BUILDING_ACTIVITIES = [
  'Apply concepts to past exam questions — aim for 15 questions per session',
  'Teach the concept back: explain it to a family member in simple terms',
  'Identify 3 mistakes from previous work, understand why, and correct them',
]

const EXCELLENCE_ACTIVITIES = [
  'Explore one advanced topic beyond the current syllabus',
  'Write a one-page essay or analysis on a key theme from this subject',
  'Research a real-world application of this subject in Kenya or globally',
]

// Forced-tier lookup: week type overrides the subject's actual level
// so the same subject in Week 1 and Week 2 always has DIFFERENT activities
function getActivitiesForWeek(
  subject: string,
  weekType: 'foundation' | 'building' | 'excellence',
): string[] {
  const tierMap = { foundation: 'low', building: 'mid', excellence: 'high' } as const
  const tier = tierMap[weekType]
  return SUBJECT_TOPICS[subject]?.[tier] ?? (
    weekType === 'foundation' ? FOUNDATION_ACTIVITIES
    : weekType === 'building'   ? BUILDING_ACTIVITIES
    :                             EXCELLENCE_ACTIVITIES
  )
}

export function generateHolidayPlan(subjects: SubjectProgress[]): HolidayActionPlan {
  const byAsc  = [...subjects].sort((a, b) => a.level - b.level)
  const byDesc = [...subjects].sort((a, b) => b.level - a.level)

  // Week 1: weakest subject(s) — FOUNDATION activities
  const w1focus = byAsc.slice(0, 2)

  // Week 2: second weakest (different from week 1 when possible) — BUILDING activities
  // If only one weak subject exists, use the same subject but a different tier guarantees different content
  const w2focus = byAsc.length > 1 ? byAsc.slice(1, 3) : byAsc.slice(0, 1)

  // Week 3: strongest subject(s) — EXCELLENCE activities (guaranteed different subject from week 1)
  const w3focus = byDesc.slice(0, 2)

  const week1: WeekPlan = {
    weekNumber:    1,
    title:         'FOUNDATION WEEK',
    theme:         'Close the Critical Gaps',
    focusSubjects: w1focus.map(s => s.displayName),
    dailyMinutes:  45,
    goal:          'Build solid foundational understanding in priority areas before the next term begins',
    activities:    w1focus.flatMap(s => getActivitiesForWeek(s.subject, 'foundation')).slice(0, 3),
  }

  const week2: WeekPlan = {
    weekNumber:    2,
    title:         'BUILDING WEEK',
    theme:         'Apply and Consolidate',
    focusSubjects: w2focus.map(s => s.displayName),
    dailyMinutes:  30,
    goal:          'Apply foundational knowledge to exam-style questions and consolidate understanding',
    activities:    w2focus.flatMap(s => getActivitiesForWeek(s.subject, 'building')).slice(0, 3),
  }

  const week3: WeekPlan = {
    weekNumber:    3,
    title:         'EXCELLENCE WEEK',
    theme:         'Reach for Level 4',
    focusSubjects: w3focus.map(s => s.displayName),
    dailyMinutes:  20,
    goal:          'Push strong subjects toward Exemplary level through extension and enrichment',
    activities:    w3focus.flatMap(s => getActivitiesForWeek(s.subject, 'excellence')).slice(0, 3),
  }

  return {
    weeks: [week1, week2, week3],
    morningRoutine:   `${w1focus[0]?.displayName || 'Priority subject'} — 45 minutes structured practice`,
    afternoonRoutine: `${w2focus[0]?.displayName || 'Building subject'} — 30 minutes review and application`,
    eveningRoutine:   'EduNexus Learning Compass session — 20 minutes',
  }
}

// ─── Learning Compass Recommendations (Page 6) ───────────────────────────────

export function generateLearningCompassRec(subjects: SubjectProgress[]): LearningCompassRec {
  const byAsc   = [...subjects].sort((a, b) => a.level - b.level)
  const weakest = byAsc.slice(0, 3)

  const topicsToAsk: string[] = []
  for (const s of weakest.slice(0, 2)) {
    if (s.level === 1) {
      topicsToAsk.push(`Explain the most important foundational concepts in ${s.displayName} that I need to master this holiday`)
      topicsToAsk.push(`Give me a step-by-step breakdown of the topic I find most difficult in ${s.displayName}`)
    } else if (s.level === 2) {
      topicsToAsk.push(`Walk me through the key exam concepts in ${s.displayName} and how to approach them`)
    } else {
      topicsToAsk.push(`What advanced ${s.displayName} topics can I explore to reach Level 4 this term?`)
    }
  }
  if (topicsToAsk.length < 3 && weakest[2]) {
    topicsToAsk.push(`Help me create a revision plan for ${weakest[2].displayName} for the next 3 weeks`)
  }
  if (topicsToAsk.length < 3) {
    topicsToAsk.push('Give me a comprehensive review of all subjects covered this term and identify my biggest gaps')
  }

  return {
    firstSessionSubject: byAsc[0]?.displayName || 'your weakest subject',
    sessionFrequency:    '3 sessions per week minimum',
    topicsToAsk:         topicsToAsk.slice(0, 3),
    sessionGoal:         `Close the identified gaps in ${weakest.slice(0, 2).map(s => s.displayName).join(' and ')} and achieve at least Developing level in all subjects before the next term begins.`,
  }
}

// ─── Action Plan ──────────────────────────────────────────────────────────────

export function generateActionPlan(subjects: SubjectProgress[]): ActionPlan {
  const struggling = subjects.filter(s => s.level <= 2)
  const improving  = subjects.filter(s => s.trend === 'improving')
  const excelling  = subjects.filter(s => s.level >= 3)
  return {
    immediate: struggling.map(s => `Focus on improving ${s.displayName} (currently Level ${s.level})`),
    shortTerm: improving.map(s => `Continue the improving trajectory in ${s.displayName}`),
    longTerm:  excelling.map(s => `Maintain excellence in ${s.displayName}`),
  }
}

// ─── Graph Data ───────────────────────────────────────────────────────────────

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
      data:    subject.previousScores.map((score, i) => ({ term: `T${i + 1}`, score })),
    })),
  }
}

// ─── Junior 3-Page Redesign Helpers ──────────────────────────────────────────

const ACADEMIC_STATUS_LABELS: Record<number, string> = {
  1: 'Foundation Support Required',
  2: 'Developing',
  3: 'Meeting Expectations',
  4: 'Exceeding Expectations',
}

type PathwayStatusLabel =
  | 'Strongly Ready'
  | 'Within Reach'
  | 'Requires Improvement'
  | 'Significant Preparation Needed'

function getPathwayStatus(score: number): { label: PathwayStatusLabel; color: string } {
  if (score >= 80) return { label: 'Strongly Ready',                   color: '#16a34a' }
  if (score >= 60) return { label: 'Within Reach',                     color: '#d97706' }
  if (score >= 40) return { label: 'Requires Improvement',             color: '#ea580c' }
  return             { label: 'Significant Preparation Needed',        color: '#dc2626' }
}

type PathwayReq = { subjects: string[]; displayName: string; required: number }

const PATHWAY_REQS: Record<string, PathwayReq[]> = {
  'STEM': [
    { subjects: ['mathematics', 'core_mathematics'], displayName: 'Mathematics',        required: 3 },
    { subjects: ['integrated_science'],              displayName: 'Integrated Science',  required: 3 },
    { subjects: ['english'],                          displayName: 'English',             required: 3 },
    { subjects: ['kiswahili', 'kiswahili_ksl'],      displayName: 'Kiswahili',           required: 2 },
  ],
  'Social Sciences': [
    { subjects: ['english'],                                           displayName: 'English',                  required: 3 },
    { subjects: ['kiswahili', 'kiswahili_ksl'],                       displayName: 'Kiswahili',                required: 3 },
    { subjects: ['social_studies', 'history_citizenship', 'history'], displayName: 'Social Studies / History', required: 3 },
    { subjects: ['geography'],                                          displayName: 'Geography',                required: 2 },
  ],
  'Arts & Sports Science': [
    { subjects: ['creative_arts_sports'],           displayName: 'Creative Arts & Sports', required: 2 },
    { subjects: ['english'],                         displayName: 'English',                required: 2 },
    { subjects: ['kiswahili', 'kiswahili_ksl'],     displayName: 'Kiswahili',              required: 2 },
    { subjects: ['mathematics', 'core_mathematics'], displayName: 'Mathematics',            required: 2 },
  ],
}

function buildPathwayReadinessCards(
  subjects: SubjectProgress[],
  pathwayReadiness: { stem: number; social_sciences: number; arts: number }
): PathwayReadinessCard[] {
  const subjectMap: Record<string, number> = {}
  const subjectKeyMap: Record<string, string> = {}
  for (const s of subjects) {
    subjectMap[s.subject] = s.level
    subjectKeyMap[s.subject] = s.subject
  }

  const PATHWAYS: Array<{ key: 'STEM' | 'Social Sciences' | 'Arts & Sports Science'; score: number }> = [
    { key: 'STEM',                  score: pathwayReadiness.stem },
    { key: 'Social Sciences',       score: pathwayReadiness.social_sciences },
    { key: 'Arts & Sports Science', score: pathwayReadiness.arts },
  ]

  return PATHWAYS.map(({ key, score }) => {
    const status = getPathwayStatus(score)
    const reqs   = PATHWAY_REQS[key] ?? []

    const gapRows: PathwayGapRow[] = []
    for (const req of reqs) {
      let bestLevel = 0
      let bestKey   = req.subjects[0]
      for (const subj of req.subjects) {
        const lvl = subjectMap[subj] ?? 0
        if (lvl > bestLevel) { bestLevel = lvl; bestKey = subj }
      }
      if (bestLevel === 0) continue

      const gap       = Math.max(0, req.required - bestLevel)
      const rowStatus: PathwayGapRow['status'] = gap === 0 ? 'met' : gap === 1 ? 'one_step' : 'two_steps'
      gapRows.push({
        subjectKey:   bestKey,
        displayName:  req.displayName,
        currentLevel: bestLevel,
        requiredLevel: req.required,
        gap,
        status: rowStatus,
      })
    }

    const metNames = gapRows.filter(r => r.status === 'met').map(r => r.displayName)
    const gapNames = gapRows.filter(r => r.status !== 'met').map(r => r.displayName)

    let diagnosis: string
    if (status.label === 'Strongly Ready') {
      diagnosis = `All key ${key} requirements are met. ${metNames.length > 0 ? `Strong performance in ${metNames.slice(0, 2).join(' and ')} confirms readiness.` : 'Maintain current performance to secure this pathway.'}`
    } else if (status.label === 'Within Reach') {
      diagnosis = `${key} is within reach. ${gapNames.length > 0 ? `Closing the gap in ${gapNames.slice(0, 2).join(' and ')} will confirm readiness.` : 'Continue current momentum.'}`
    } else if (status.label === 'Requires Improvement') {
      diagnosis = `${key} requires focused effort before Grade 10. ${gapNames.length > 0 ? `Priority: ${gapNames.slice(0, 2).join(' and ')}.` : ''} One to two terms of consistent work can bridge these gaps.`
    } else {
      diagnosis = `Significant preparation needed for ${key}. ${gapNames.length > 0 ? `Multiple gaps across ${gapNames.slice(0, 2).join(' and ')}.` : ''} Start intervention now to keep this option open.`
    }

    return { pathway: key, score, statusLabel: status.label, statusColor: status.color, diagnosis, gapRows }
  })
}

function buildPathwayRoadmap(
  recommendedPathway: string,
  cards: PathwayReadinessCard[]
): PathwayRoadmap | undefined {
  const card = cards.find(c => c.pathway === recommendedPathway)
  if (!card) return undefined

  const gapSteps = card.gapRows
    .filter(r => r.status !== 'met')
    .slice(0, 3)
    .map(r => ({ subject: r.displayName, fromLevel: r.currentLevel, toLevel: r.requiredLevel }))

  if (gapSteps.length === 0) {
    return {
      targetPathway: recommendedPathway,
      steps: [],
      timeline: 'Pathway secured — maintain current performance',
      currentScore: card.score,
      projectedScore: Math.min(100, card.score + 5),
    }
  }

  const maxGap = Math.max(...card.gapRows.filter(r => r.status !== 'met').map(r => r.gap))
  const timeline = maxGap >= 2
    ? 'Estimated 8–12 weeks of consistent effort'
    : 'Estimated 4–6 weeks of consistent effort'
  const projectedScore = Math.min(100, card.score + gapSteps.length * 10)

  return { targetPathway: recommendedPathway, steps: gapSteps, timeline, currentScore: card.score, projectedScore }
}

const WEEKLY_ACTIONS: Record<string, string> = {
  mathematics:           'Complete 3 problem-solving exercises daily. Show all working — method matters more than the answer.',
  core_mathematics:      'Attempt 3 past paper questions per session. Focus on understanding each step fully before moving on.',
  integrated_science:    'Draw and label 2 scientific diagrams from this term\'s topics from memory each day.',
  english:               'Read one short article and write a 5-sentence summary. Focus on clarity and correct grammar.',
  kiswahili:             'Read one page of Kiswahili text. Write 5 new vocabulary words and use each one in a sentence.',
  kiswahili_ksl:         'Read one page of Kiswahili text. Write 5 new vocabulary words and use each one in a sentence.',
  social_studies:        'Review one civic or geographical topic. Write 3 key facts and one real-world Kenya connection.',
  history_citizenship:   'Create a one-page timeline of one key historical period from this term\'s work.',
  history:               'Create a one-page timeline of one key historical period from this term\'s work.',
  geography:             'Study one map from the geography syllabus. Label all features from memory without looking.',
  creative_arts_sports:  'Practise your primary art form or sport for 3 sessions of 30 minutes each this week.',
  pre_technical:         'Complete one technical drawing exercise and check it for accuracy of measurement.',
  agriculture_nutrition: 'Review this week\'s topics and connect them to a real farming or nutrition example in your area.',
  home_science:          'Review nutrition content and practise one home science practical skill this week.',
  cre:                   'Read one set text passage and write 3 lessons it teaches for life today.',
  ire:                   'Read one set text passage and write 3 lessons it teaches for life today.',
  business_studies:      'Study one business concept and find a real Kenyan company that applies it. Write 5 facts.',
}

const MONTHLY_ACTIONS: Record<string, string> = {
  mathematics:           'Complete a full past paper under timed conditions. Review every incorrect answer with your teacher.',
  core_mathematics:      'Complete two past paper topic sections. Identify the 3 most common mistake types and fix each one.',
  integrated_science:    'Write a one-page summary of every major topic from this term. Include key diagrams and definitions.',
  english:               'Write one formal essay and one creative piece. Ask your teacher to mark and return with corrections.',
  kiswahili:             'Write one Kiswahili composition (insha). Practise the introduction-body-conclusion structure.',
  kiswahili_ksl:         'Write one Kiswahili composition (insha). Practise the introduction-body-conclusion structure.',
  social_studies:        'Complete a structured revision of all civic and geographical topics covered this term.',
  history_citizenship:   'Write a structured essay on one historical event or figure. Focus on argument, evidence, conclusion.',
  history:               'Write a structured essay on one historical event or figure. Focus on argument, evidence, conclusion.',
  geography:             'Complete a map-work exercise from a past paper. Study all physical geography topics systematically.',
  creative_arts_sports:  'Complete one creative project or sports performance that demonstrates clear growth from last term.',
  pre_technical:         'Complete a full design or practical project. Aim for accuracy and clear presentation of all steps.',
  agriculture_nutrition: 'Complete a full revision of all agriculture and nutrition topics for this term.',
  home_science:          'Complete a full practical assignment and revise all home science theory content for this term.',
  cre:                   'Write a structured essay response to a CRE past paper question. Use context-teaching-application format.',
  ire:                   'Write a structured essay response to an IRE past paper question. Use context-teaching-application format.',
  business_studies:      'Create a simple business plan for a small youth enterprise. Include a marketing and finance section.',
}

const BEFORE_GRADE10_ACTIONS: Record<string, string> = {
  mathematics:           'Achieve Level 3 in Mathematics — the most important single academic goal for STEM pathway access.',
  core_mathematics:      'Achieve Level 3 in Mathematics before Grade 10. This unlocks the widest range of Senior School pathways.',
  integrated_science:    'Achieve Level 3 in Integrated Science. This feeds directly into Biology, Chemistry, and Physics.',
  english:               'Achieve Level 3 in English — required for every Senior School pathway without exception.',
  kiswahili:             'Achieve Level 3 in Kiswahili. Strong national language performance opens more pathway options in Senior School.',
  kiswahili_ksl:         'Achieve Level 3 in Kiswahili. Strong national language performance opens more pathway options in Senior School.',
  social_studies:        'Build Level 3 performance in Social Studies — this underpins Social Sciences pathway readiness.',
  history_citizenship:   'Develop strong essay-writing skills in History. Structured argument is rewarded heavily in Senior School.',
  history:               'Develop strong essay-writing skills in History. Structured argument is rewarded heavily in Senior School.',
  geography:             'Strengthen Geography, especially map work. These are core Senior School Social Sciences topics.',
  creative_arts_sports:  'Build a portfolio or performance record in Creative Arts & Sports before Grade 10 selection.',
  business_studies:      'Reach Level 3 in Business Studies — this opens Business pathway and strengthens Social Sciences readiness.',
}

function buildTermActionPlan(
  subjects: SubjectProgress[],
  recommendedPathway: string,
  cards: PathwayReadinessCard[]
): TermActionPlan {
  const sortedByLevel = [...subjects].sort((a, b) => a.level - b.level)
  const weakest       = sortedByLevel.filter(s => s.level <= 2).slice(0, 2)
  const card          = cards.find(c => c.pathway === recommendedPathway)
  const gapRows       = card?.gapRows.filter(r => r.status !== 'met').slice(0, 2) ?? []

  const weeklySource = weakest.length > 0 ? weakest : sortedByLevel.slice(0, 2)
  const thisWeek: TermPlanAction[] = weeklySource.slice(0, 2).map(s => ({
    action: WEEKLY_ACTIONS[s.subject] ?? `Spend 20 focused minutes on ${s.displayName} three times this week — review your class notes carefully.`,
  }))

  const thisMonth: TermPlanAction[] = gapRows.slice(0, 2).map(r => ({
    action: MONTHLY_ACTIONS[r.subjectKey] ??
      `Complete one full structured revision session per week for ${r.displayName} this month.`,
  }))
  thisMonth.push({
    action: 'Use the EduNexus Learning Compass at least 3 times this week — always start with your weakest subject.',
  })

  const beforeGrade10: TermPlanAction[] = gapRows.slice(0, 2).map(r => ({
    action: BEFORE_GRADE10_ACTIONS[r.subjectKey] ??
      `Reach Level ${r.requiredLevel} in ${r.displayName} before Grade 10 pathway selection.`,
  }))
  beforeGrade10.push({
    action: `Confirm your ${recommendedPathway} pathway readiness by end of Grade 9 — share this report with your class teacher at least one term before Grade 10 selection.`,
  })

  return { thisWeek, thisMonth, beforeGrade10 }
}

const JUNIOR_FUTURE_OPPORTUNITIES: JuniorFutureOpportunity[] = [
  {
    pathway: 'STEM',
    examples: ['Medicine & Health', 'Engineering', 'Computing', 'Applied Sciences'],
    whyItFits: 'Strong Mathematics and Science performance builds the foundation for analytical, technical, and problem-solving careers in high demand in Kenya and globally.',
  },
  {
    pathway: 'Social Sciences',
    examples: ['Law', 'Business & Finance', 'Education', 'Public Administration'],
    whyItFits: 'Strong language and reasoning skills align with careers that require clear communication, critical thinking, and working effectively with communities and institutions.',
  },
  {
    pathway: 'Arts & Sports Science',
    examples: ['Creative Industries', 'Sports Science', 'Design', 'Media'],
    whyItFits: 'Strong creative and practical competencies open Kenya\'s growing creative economy, sports industry, and digital media sector.',
  },
]

// ─── Career Insight Meta ──────────────────────────────────────────────────────

function getCareerMeta(name: string): {
  futureOutlook: string; aiImpact: string; selfEmployment: string; examples: string[]
} {
  const n = name.toLowerCase()
  if (n.includes('software') || n.includes('computing') || n.includes('cyber') || n.includes('data science') || n.includes('programming')) {
    return { futureOutlook: 'Growing', aiImpact: 'High', selfEmployment: 'High', examples: ['Freelancing', 'Software startup', 'Digital agency'] }
  }
  if (n.includes('medicine') || n.includes('doctor') || n.includes('physician') || n.includes('medical')) {
    return { futureOutlook: 'Growing', aiImpact: 'Medium', selfEmployment: 'High', examples: ['Private clinic', 'Telemedicine', 'Health consulting'] }
  }
  if (n.includes('nurs')) {
    return { futureOutlook: 'Growing', aiImpact: 'Low–Medium', selfEmployment: 'Medium', examples: ['Private nursing care', 'Home care', 'Health consultancy'] }
  }
  if (n.includes('engineer') || n.includes('architect')) {
    return { futureOutlook: 'Growing', aiImpact: 'Medium–High', selfEmployment: 'Medium', examples: ['Consulting firm', 'Project contracts', 'Technical services'] }
  }
  if (n.includes('teach') || n.includes('education') || n.includes('lectur')) {
    return { futureOutlook: 'Stable', aiImpact: 'Low–Medium', selfEmployment: 'High', examples: ['Online tutoring', 'Educational content', 'Curriculum design'] }
  }
  if (n.includes('law') || n.includes('legal') || n.includes('advocate')) {
    return { futureOutlook: 'Stable', aiImpact: 'Medium', selfEmployment: 'Medium', examples: ['Private practice', 'Legal consulting', 'Corporate law'] }
  }
  if (n.includes('account') || n.includes('audit') || n.includes('finance') || n.includes('bank')) {
    return { futureOutlook: 'Stable', aiImpact: 'Medium–High', selfEmployment: 'Medium', examples: ['Accounting firm', 'Financial advisory', 'Tax consulting'] }
  }
  if (n.includes('business') || n.includes('entrepreneur') || n.includes('manag')) {
    return { futureOutlook: 'Growing', aiImpact: 'Medium', selfEmployment: 'High', examples: ['Own business', 'Consulting', 'Trade & commerce'] }
  }
  if (n.includes('psychol') || n.includes('counsel')) {
    return { futureOutlook: 'Growing', aiImpact: 'Low–Medium', selfEmployment: 'High', examples: ['Private practice', 'Online counselling', 'HR consulting'] }
  }
  if (n.includes('agri') || n.includes('farm') || n.includes('food')) {
    return { futureOutlook: 'Growing', aiImpact: 'Low–Medium', selfEmployment: 'High', examples: ['Agribusiness', 'Farming enterprise', 'Food processing'] }
  }
  if (n.includes('journ') || n.includes('media') || n.includes('communicat')) {
    return { futureOutlook: 'Stable', aiImpact: 'Medium', selfEmployment: 'High', examples: ['Freelance journalism', 'Content creation', 'Media agency'] }
  }
  if (n.includes('design') || n.includes('art') || n.includes('creat')) {
    return { futureOutlook: 'Stable', aiImpact: 'Medium', selfEmployment: 'High', examples: ['Freelance design', 'Creative agency', 'Content creation'] }
  }
  if (n.includes('sport') || n.includes('physio') || n.includes('fitness')) {
    return { futureOutlook: 'Growing', aiImpact: 'Low', selfEmployment: 'High', examples: ['Personal training', 'Sports coaching', 'Physiotherapy clinic'] }
  }
  return { futureOutlook: 'Stable', aiImpact: 'Medium', selfEmployment: 'Medium', examples: ['Consulting', 'Private practice', 'Freelancing'] }
}

// ─── Subject Improvement Impacts ─────────────────────────────────────────────

const SUBJECT_IMPROVEMENT_IMPACTS: Record<string, string[]> = {
  mathematics:          ['Engineering and computing programmes open up', 'STEM cluster points improve significantly', 'Quantitative career paths fully accessible'],
  core_mathematics:     ['Engineering and computing programmes open up', 'STEM pathway options fully confirmed', 'Quantitative career paths fully accessible'],
  biology:              ['Medical and health sciences programmes accessible', 'Nursing, pharmacy, and biomedical pathways open', 'Biology-dependent careers confirm access'],
  chemistry:            ['Medicine, pharmacy, and chemical engineering programmes strengthen', 'Applied sciences career paths open', 'STEM pathway credibility improves'],
  physics:              ['Engineering, architecture, and technology programmes unlock', 'Applied sciences career paths strengthen', 'Physical sciences degree options widen'],
  english:              ['Wider university options across ALL programmes', 'Communication-heavy careers strengthen significantly', 'Scholarship eligibility improves'],
  kiswahili:            ['National language requirement met for more programmes', 'Humanities and social sciences pathways confirm access', 'Scholarship opportunities increase'],
  kiswahili_ksl:        ['National language requirement met for more programmes', 'Humanities and social sciences pathways confirm access', 'Scholarship opportunities increase'],
  integrated_science:   ['STEM pathway foundation strengthens significantly', 'Science specialisations open up in Senior School', 'Health sciences university eligibility improves'],
  social_studies:       ['Social sciences and humanities programmes strengthen', 'Public service and governance paths open', 'Community-facing career options widen'],
  history_citizenship:  ['Law, political science, and governance programmes open', 'Humanities career paths strengthen', 'University humanities options widen'],
  history:              ['Law, political science, and governance programmes open', 'Humanities career paths strengthen', 'University humanities options widen'],
  geography:            ['Environmental science and urban planning pathways open', 'Geography-related career paths strengthen', 'Social sciences university options widen'],
  business_studies:     ['Business and commerce university programmes open', 'Entrepreneurship and finance career paths confirm access', 'Business cluster points improve'],
  computer_studies:     ['Technology and digital careers strengthen', 'Computing and IT university options widen', 'Digital entrepreneurship pathway confirms'],
  creative_arts_sports: ['Arts & Sports Science pathway confirms access', 'Creative industry career paths open', 'Sports science and coaching programmes accessible'],
}

function getImprovementImpacts(subjectKey: string): string[] {
  return SUBJECT_IMPROVEMENT_IMPACTS[subjectKey] ?? [
    'Wider university options',
    'Better scholarship opportunities',
    'Improved competitiveness in chosen pathway',
  ]
}

function getCurrentTrajectoryText(subjectKey: string, level: number): string {
  const TEXT: Record<string, Record<number, string>> = {
    mathematics: {
      1: 'Engineering, computing, and most STEM degree programmes remain inaccessible without foundational support.',
      2: 'STEM and engineering pathways remain partially closed until Mathematics reaches Level 3.',
      3: 'Strong trajectory — maintain Level 3 to keep advanced STEM programmes accessible.',
    },
    biology: {
      1: 'Medical, health sciences, and life sciences degree programmes are currently out of reach.',
      2: 'Health sciences and medical pathways remain restricted. Level 3 is the minimum for most medical-adjacent programmes.',
      3: 'Health sciences pathway is secured — maintain to keep top medical programmes accessible.',
    },
    english: {
      1: 'Most university programmes require English above this level. This is the single most urgent gap to address.',
      2: 'Competitive university programmes require Level 3 English minimum. Closing this gap has the highest overall impact.',
      3: 'Good English foundation. Level 4 would further strengthen humanities and law career access.',
    },
    chemistry: {
      1: 'Medicine, pharmacy, and chemical engineering programmes are not accessible at current level.',
      2: 'Chemistry remains a restricting factor for medical and scientific career entry requirements.',
      3: 'Chemistry is secured at proficient level. Maintain to protect STEM options.',
    },
    physics: {
      1: 'Engineering and applied sciences programmes are not accessible at current level.',
      2: 'Engineering and architecture pathways are partially restricted until Physics reaches Level 3.',
      3: 'Physics secured. Maintain to protect engineering and applied sciences options.',
    },
  }
  return TEXT[subjectKey]?.[level]
    ?? `Performance in this subject at Level ${level} continues to limit pathway options. Improvement to Level ${level + 1} is the recommended next step.`
}

// ─── Junior Redesign v2 Generators ───────────────────────────────────────────

const PATHWAY_UNLOCK_EXAMPLES: Record<string, string[]> = {
  'STEM':                  ['STEM becomes available', 'Engineering pathway opens', 'Medical Sciences pathway opens', 'Technology pathway opens'],
  'Social Sciences':       ['Social Sciences becomes available', 'Law pathway opens', 'Business & Finance pathway opens', 'Education pathway opens'],
  'Arts & Sports Science': ['Arts & Sports Science becomes available', 'Design pathway opens', 'Sports Science pathway opens', 'Media pathway opens'],
}

export function buildJuniorImprovementCascade(
  subjects: SubjectProgress[],
  cards: PathwayReadinessCard[],
  recommendedPathway: string
): JuniorImprovementCascade | null {
  const alternativeCards = cards
    .filter(c => c.pathway !== recommendedPathway)
    .sort((a, b) => b.score - a.score)

  const target = alternativeCards[0]
  if (!target) return null

  const gapRows = target.gapRows.filter(r => r.status !== 'met')
  const keyGap  = gapRows.find(r => r.status === 'one_step') ?? gapRows[0]

  if (!keyGap) {
    return {
      targetPathway: target.pathway, subjectKey: '', displayName: '',
      currentLevel: 0, targetLevel: 0, gap: 0,
      estimatedTimeline: 'Pathway already within reach',
      probability: 'High',
      unlocks: PATHWAY_UNLOCK_EXAMPLES[target.pathway] ?? [],
    }
  }

  const gap              = keyGap.gap
  const estimatedTimeline = gap === 1 ? '1 Term' : '2 Terms'
  const probability       = gap === 1 ? 'High' as const : gap === 2 ? 'Medium' as const : 'Possible' as const

  return {
    targetPathway: target.pathway,
    subjectKey:    keyGap.subjectKey,
    displayName:   keyGap.displayName,
    currentLevel:  keyGap.currentLevel,
    targetLevel:   keyGap.requiredLevel,
    gap,
    estimatedTimeline,
    probability,
    unlocks: PATHWAY_UNLOCK_EXAMPLES[target.pathway] ?? [],
  }
}

const PRIORITY_WHY: Record<string, string> = {
  mathematics:          'Mathematics Level 3 unlocks STEM eligibility — the highest-demand pathway in Kenya.',
  core_mathematics:     'Core Mathematics Level 3 is the gateway to STEM and engineering degree programmes.',
  integrated_science:   'Integrated Science Level 3 builds the foundation for Biology, Chemistry, and Physics in Senior School.',
  english:              'English Level 3 is required for every Senior School pathway without exception.',
  kiswahili:            'Kiswahili Level 3 broadens pathway options and meets the national language requirement.',
  kiswahili_ksl:        'Kiswahili Level 3 broadens pathway options and meets the national language requirement.',
  social_studies:       'Social Studies Level 3 underpins Social Sciences pathway readiness.',
  history_citizenship:  'History competency directly supports Social Sciences and Law pathways.',
  history:              'History competency directly supports Social Sciences and Law pathways.',
  geography:            'Geography strengthens Social Sciences pathway and environmental career options.',
  business_studies:     'Business Studies Level 3 opens Business pathway and strengthens Social Sciences readiness.',
  computer_studies:     'Computing skills are foundational for the digital economy and STEM pathway support.',
  creative_arts_sports: 'Creative Arts & Sports Level 3 confirms Arts & Sports Science pathway readiness.',
  pre_technical:        'Pre-Technical Studies supports STEM readiness and builds practical skills for engineering pathways.',
}

const PRIORITY_COMPASS_REASON: Record<string, string> = {
  mathematics:          'This is currently the single subject preventing STEM eligibility.',
  core_mathematics:     'This is currently the single subject preventing STEM eligibility.',
  english:              'English is required for every pathway — closing this gap has the highest overall impact.',
  integrated_science:   'Integrated Science is the foundational gateway to STEM subjects in Senior School.',
  social_studies:       'Social Studies is the core subject confirming Social Sciences pathway readiness.',
  history_citizenship:  'History is the core subject confirming Social Sciences pathway readiness.',
  creative_arts_sports: 'Creative Arts & Sports is the core subject confirming Arts & Sports Science pathway readiness.',
}

function getCompassReason(subjectKey: string, rank: number): string {
  if (rank === 1) {
    return PRIORITY_COMPASS_REASON[subjectKey]
      ?? 'This is the highest-priority gap — addressing it first has the broadest impact on pathway readiness.'
  }
  return rank === 2
    ? 'This is the second priority gap — consistent support here strengthens overall pathway readiness.'
    : 'This is the third priority gap — closing this completes the foundation for Senior School success.'
}

export function buildJuniorActionPriorities(
  subjects: SubjectProgress[],
  cards: PathwayReadinessCard[],
  recommendedPathway: string
): JuniorActionPriority[] {
  const recCard     = cards.find(c => c.pathway === recommendedPathway)
  const gapSubjects = (recCard?.gapRows.filter(r => r.status !== 'met') ?? []).map(r => ({
    subjectKey: r.subjectKey, displayName: r.displayName,
    currentLevel: r.currentLevel, targetLevel: r.requiredLevel,
  }))

  const priorityKeys = new Set<string>()
  const list: Array<{ subjectKey: string; displayName: string; currentLevel: number; targetLevel: number }> = []

  for (const gap of gapSubjects.slice(0, 2)) {
    if (!priorityKeys.has(gap.subjectKey)) { priorityKeys.add(gap.subjectKey); list.push(gap) }
  }

  const weakest = [...subjects].sort((a, b) => a.level - b.level)
  for (const s of weakest) {
    if (!priorityKeys.has(s.subject)) {
      priorityKeys.add(s.subject)
      list.push({ subjectKey: s.subject, displayName: s.displayName, currentLevel: s.level, targetLevel: Math.min(4, s.level + 1) })
    }
    if (list.length >= 3) break
  }

  return list.slice(0, 3).map((item, i) => {
    const sessions = item.currentLevel === 1 ? 8 : item.currentLevel === 2 ? 6 : 4
    const timeline = item.currentLevel === 1 ? '6–10 weeks' : item.currentLevel === 2 ? '4–8 weeks' : '3–5 weeks'
    const rank     = (i + 1) as 1 | 2 | 3
    return {
      rank,
      subject:          item.displayName,
      currentLevel:     item.currentLevel,
      targetLevel:      item.targetLevel,
      whyItMatters:     PRIORITY_WHY[item.subjectKey] ?? `Level ${item.targetLevel} in ${item.displayName} opens key pathway options.`,
      compassReason:    getCompassReason(item.subjectKey, rank),
      intervention:     `${sessions} Learning Compass sessions`,
      estimatedSessions: sessions,
      timeline,
    }
  })
}

export function buildParentAction(subjects: SubjectProgress[], firstName: string): ParentAction {
  const weakest = [...subjects].sort((a, b) => a.level - b.level)[0]
  if (!weakest) return { action: `Review ${firstName}'s academic progress every Saturday and ask about one topic studied that week.` }

  const TEMPLATES: Record<string, string> = {
    mathematics:         `Spend 20 minutes every Saturday reviewing Mathematics with ${firstName} — ask to show you one problem solved step by step.`,
    core_mathematics:    `Spend 20 minutes every Saturday reviewing Mathematics with ${firstName} — ask to show you one problem solved step by step.`,
    english:             `Ask ${firstName} to read one article or short story aloud each Saturday and summarise it in 3 sentences.`,
    kiswahili:           `Practise simple Kiswahili conversation with ${firstName} for 10 minutes daily — even basic sentences build confidence rapidly.`,
    kiswahili_ksl:       `Practise simple Kiswahili conversation with ${firstName} for 10 minutes daily — even basic sentences build confidence rapidly.`,
    integrated_science:  `Ask ${firstName} to explain one science topic each week using household items as examples — this strengthens understanding significantly.`,
    biology:             `Ask ${firstName} to teach you one Biology concept each week. Teaching is the strongest test of true understanding.`,
    social_studies:      `Spend 15 minutes weekly reading one news article together and discussing its civic or historical significance.`,
    history_citizenship: `Read one news article together weekly and ask ${firstName} to connect it to a historical event from their studies.`,
    history:             `Read one news article together weekly and ask ${firstName} to connect it to a historical event from their studies.`,
    business_studies:    `Ask ${firstName} to identify one business they see each week and explain how it makes money.`,
    geography:           `Use a map together for 15 minutes weekly — ask ${firstName} to identify geographical features and explain their significance.`,
  }

  return {
    action: TEMPLATES[weakest.subject]
      ?? `Spend 20 minutes every Saturday reviewing ${weakest.displayName} progress with ${firstName}. Ask them to explain one topic they studied that week — teaching reinforces learning.`,
  }
}

// ─── Senior Redesign v2 Generators ───────────────────────────────────────────

export function buildSeniorReadinessIndicators(
  subjects: SubjectProgress[],
  pathway: string | null | undefined,
  trajectory: 'IMPROVING' | 'STABLE' | 'NEEDS ATTENTION' | 'CRITICAL',
  firstName: string
): SeniorReadinessIndicators {
  const avg = subjects.reduce((s, x) => s + x.level, 0) / subjects.length
  const pct = (avg / 4) * 100
  const pathwayReadinessScore = Math.round(pct)
  const pw  = pathway ?? 'chosen'

  type RL = 'Strong' | 'Developing' | 'Emerging' | 'Needs Work'

  const uniLabel: RL = pct >= 75 ? 'Strong' : pct >= 60 ? 'Developing' : pct >= 45 ? 'Emerging' : 'Needs Work'
  const uniDetail: Record<RL, string> = {
    'Strong':      `${firstName} is performing at a level that supports university access across multiple programmes in the ${pw} pathway.`,
    'Developing':  `Current performance supports university access. Targeted improvement in priority subjects will significantly strengthen options.`,
    'Emerging':    `Focused support this term can open university access. The subjects in the action plan are the critical gaps to close.`,
    'Needs Work':  `Significant preparation is needed to maintain university pathway access. Early and consistent support is critical — start with the action plan below.`,
  }

  const carLabel: RL = pct >= 70 ? 'Strong' : pct >= 55 ? 'Developing' : pct >= 40 ? 'Emerging' : 'Needs Work'
  const carDetail: Record<RL, string> = {
    'Strong':      `Subject performance aligns well with career entry requirements in the ${pw} sector.`,
    'Developing':  `Building strong foundations for ${pw} careers. One to two level improvements will confirm readiness.`,
    'Emerging':    `Career pathway is visible from current performance. Consistent support is needed to reach entry requirements.`,
    'Needs Work':  `${pw} career access requires significant academic improvement. Prioritise the three subjects in the clinical action plan.`,
  }

  const progLabel = trajectory === 'IMPROVING' ? 'On Track' as const
    : trajectory === 'CRITICAL'        ? 'Critical' as const
    : pct >= 60                        ? 'On Track' as const
    : 'Needs Attention' as const

  const progDetail: Record<typeof progLabel, string> = {
    'On Track':        `${firstName} is progressing within the ${pw} pathway with consistent performance.`,
    'Needs Attention': `Performance within the ${pw} pathway requires more consistent effort to stay on target for Grade 12.`,
    'Critical':        `Performance within the ${pw} pathway needs urgent intervention before KCSE.`,
  }

  return {
    pathwayReadinessScore,
    universityReadiness:       uniLabel,
    universityReadinessDetail: uniDetail[uniLabel],
    careerReadiness:           carLabel,
    careerReadinessDetail:     carDetail[carLabel],
    pathwayProgress:           progLabel,
    pathwayProgressDetail:     progDetail[progLabel],
  }
}

export function buildCareerInsightCards(seniorGuidance: SeniorGuidance): CareerInsightCard[] {
  return seniorGuidance.topCareers.slice(0, 3).map(c => {
    const meta = getCareerMeta(c.name)
    return {
      name:                   c.name,
      alignment:              c.matchPercentage,
      futureOutlook:          meta.futureOutlook,
      aiImpact:               meta.aiImpact,
      selfEmploymentPotential: meta.selfEmployment,
      selfEmploymentExamples: meta.examples,
    }
  })
}

export function buildFutureScenario(subjects: SubjectProgress[]): FutureScenario | null {
  const byAsc = [...subjects].sort((a, b) => a.level - b.level)
  const target = byAsc.find(s => s.level < 4)
  if (!target) return null

  return {
    subject:           target.displayName,
    currentLevel:      target.level,
    improvedLevel:     target.level + 1,
    currentTrajectory: getCurrentTrajectoryText(target.subject, target.level),
    improvedImpacts:   [
      'Wider university options',
      'Better scholarship opportunities',
      'Improved competitiveness',
      ...getImprovementImpacts(target.subject).slice(0, 1),
    ].slice(0, 4),
  }
}

const SENIOR_WHY: Record<string, string> = {
  mathematics:          'Mathematics at Level 3+ is required for engineering, computing, and most STEM degree entry requirements.',
  core_mathematics:     'Core Mathematics at Level 3 is the minimum for engineering and computing university programmes.',
  biology:              'Biology at Level 3 is required for medicine, nursing, pharmacy, and all health sciences pathways.',
  chemistry:            'Chemistry at Level 3 supports medicine, chemical engineering, and pharmaceutical career access.',
  physics:              'Physics at Level 3 confirms engineering and applied sciences university pathway access.',
  english:              'English at Level 3 is required for admission to virtually every university programme in Kenya.',
  kiswahili:            'Kiswahili at Level 3 meets the national language requirement for most university programmes.',
  kiswahili_ksl:        'Kiswahili at Level 3 meets the national language requirement for most university programmes.',
  history_citizenship:  'History at Level 3 strengthens law, political science, and public administration pathways.',
  history:              'History at Level 3 strengthens law, political science, and public administration pathways.',
  geography:            'Geography at Level 3 opens environmental science, urban planning, and social sciences pathways.',
  business_studies:     'Business Studies at Level 3 confirms commerce and entrepreneurship pathway access.',
  computer_studies:     'Computing at Level 3 opens digital careers and technology-focused university programmes.',
  social_studies:       'Social Studies at Level 3 strengthens the foundation for humanities and social sciences at university.',
}

const SENIOR_BENEFIT: Record<string, string> = {
  mathematics:          'Engineering, computing, and STEM university cluster points improve. KCSE grade requirement met for more programmes.',
  core_mathematics:     'Engineering and computing university cluster points improve significantly.',
  biology:              'Medical, nursing, and health sciences programmes confirm eligibility. KCSE Biology requirement met.',
  chemistry:            'Medicine and pharmacy KCSE cluster points strengthen. Chemical sciences careers accessible.',
  physics:              'Engineering and architecture university eligibility confirms. Applied sciences pathways open.',
  english:              'Across-the-board university eligibility strengthens. Communication-heavy careers confirm access.',
  kiswahili:            'National language requirement satisfied. Additional humanities and social sciences options open.',
  kiswahili_ksl:        'National language requirement satisfied. Additional humanities and social sciences options open.',
  history_citizenship:  'Law and political science university cluster points strengthen. Governance careers confirm access.',
  history:              'Law and political science university cluster points strengthen. Governance careers confirm access.',
  geography:            'Environmental and social sciences university options widen. Geography-relevant careers open.',
  business_studies:     'Commerce degree eligibility confirms. Entrepreneurship and management career paths open.',
  computer_studies:     'Technology degree options widen. Digital economy career paths fully confirm access.',
  social_studies:       'Humanities and social sciences university options strengthen. Public service career paths open.',
}

export function buildSeniorActionPriorities(
  subjects: SubjectProgress[],
  pathway: string | null | undefined,
  firstName: string
): SeniorActionPriority[] {
  const pw    = pathway ?? 'chosen pathway'
  const byAsc = [...subjects].sort((a, b) => a.level - b.level)
  const top3  = byAsc.slice(0, 3)

  return top3.map((s, i) => {
    const sessions    = s.level === 1 ? 8 : s.level === 2 ? 6 : 4
    const timeline    = s.level === 1 ? '6–10 weeks' : s.level === 2 ? '4–8 weeks' : '3–5 weeks'
    const targetLevel = Math.min(4, s.level + 1)
    const rank        = (i + 1) as 1 | 2 | 3

    return {
      rank,
      subject:           s.displayName,
      currentLevel:      s.level,
      targetLevel,
      whyItMatters:      SENIOR_WHY[s.subject]    ?? `${s.displayName} at Level ${targetLevel} is key to ${pw} access and university eligibility.`,
      expectedBenefit:   SENIOR_BENEFIT[s.subject] ?? `Moving from Level ${s.level} to Level ${targetLevel} in ${s.displayName} will improve pathway and career access significantly.`,
      compassSubject:    s.displayName,
      compassReason:     rank === 1
        ? `This is the single highest-impact subject — closing this gap has the broadest benefit for ${pw} and university access.`
        : rank === 2
        ? `Second highest-priority gap — consistent support here significantly strengthens overall pathway readiness.`
        : `Third priority — closing this completes the foundation for KCSE performance in the ${pw} pathway.`,
      estimatedSessions: sessions,
      timeline,
    }
  })
}

// ─── Main Report Generator ────────────────────────────────────────────────────

export function generateReport(
  studentProfile:      StudentProfile,
  subjects:            SubjectProgress[],
  vitals:              Vitals,
  actionPlan:          ActionPlan,
  assessments:         Array<{ created_at?: string; dream_career?: string | null; [key: string]: unknown }>,
  juniorGuidance?:     JuniorGuidance,
  seniorGuidance?:     SeniorGuidance,
  knowledgeRootCauses?: import('@/lib/knowledgeGraph/types').RootCauseResult[]
): AcademicClinicReport {
  const firstName = studentProfile.name.split(' ')[0]
  const isJunior  = studentProfile.grade >= 7 && studentProfile.grade <= 9

  const reportId         = `EC-${studentProfile.year}-${Math.random().toString(36).substring(2, 8).toUpperCase()}`
  const graphData        = generateGraphData(subjects)
  const clinicalOverview = generateClinicalOverview(firstName, subjects, assessments)
  let pathwayAnalysis: PathwayAnalysis | undefined = undefined
  if (isJunior) {
    const scores = Object.fromEntries(subjects.map(s => [s.subject, s.level]))
    const pr     = calculateJuniorPathwayAffinity(scores)
    const recommended = pr.top_pathway as 'STEM' | 'Social Sciences' | 'Arts & Sports Science'
    const confMap = { high: 'HIGH', medium: 'MEDIUM', low: 'DEVELOPING' } as const

    const strongInPath = subjects
      .filter(s => PATHWAY_MAP[s.subject] === recommended && s.level >= 3)
      .sort((a, b) => b.level - a.level)
      .slice(0, 2)

    const reasons: string[] = [
      strongInPath.length > 0
        ? `Demonstrates ${getLevelLabel(strongInPath[0].level)} competency in ${strongInPath.map(s => s.displayName).join(' and ')}, which are core subjects of the ${recommended} pathway.`
        : `Assessment profile shows developing aptitude aligned with ${recommended} subjects.`,
      recommended === 'STEM'
        ? 'Analytical and quantitative reasoning skills support STEM pathway engagement.'
        : recommended === 'Social Sciences'
        ? 'Communication, civic reasoning, and analytical skills align well with Social Sciences requirements.'
        : 'Creative expression and practical aptitude align naturally with Arts & Sports Science.',
      recommended === 'STEM'
        ? 'Strong STEM foundations at this stage open access to engineering, medicine, and technology degree programmes.'
        : recommended === 'Social Sciences'
        ? 'Social Sciences opens access to law, business, education, and public service — high-demand careers in Kenya.'
        : 'Arts & Sports Science leads to design, sports science, media, and creative industries in Kenya.',
    ]

    const futureMessage =
      recommended === 'STEM'
        ? `A strong STEM pathway in Grade 10–12 opens doors to Medicine, Engineering, Technology, and Data Science — some of the highest-demand careers in Kenya and globally. With continued investment in ${firstName}'s foundational sciences now, these pathways become increasingly accessible.`
        : recommended === 'Social Sciences'
        ? `The Social Sciences pathway in Grade 10–12 leads to Law, Business, Education, Public Policy, and Finance — careers at the heart of Kenya's growth story. ${firstName}'s current trajectory suggests a strong fit for these intellectually stimulating and socially impactful pathways.`
        : `The Arts & Sports Science pathway in Grade 10–12 leads to careers in design, performing arts, sports science, media, and creative industries — a rapidly growing sector in Kenya. ${firstName}'s creative and physical aptitudes represent a genuine and valuable talent worth developing fully.`

    pathwayAnalysis = {
      pathwayScores: ([
        { name: 'STEM'                  as const, score: pr.stem_score,            color: '#3b82f6' },
        { name: 'Social Sciences'       as const, score: pr.social_sciences_score, color: '#10b981' },
        { name: 'Arts & Sports Science' as const, score: pr.arts_sports_score,     color: '#f59e0b' },
      ] as PathwayScore[]).sort((a, b) => b.score - a.score),
      recommendedPathway: recommended,
      confidenceLevel:    confMap[pr.confidence],
      reasons,
      subjectsToStrengthen: pr.development_areas.slice(0, 3).map(pathwayFormatSubjectName),
      futureMessage,
      stem_viable:             pr.stem_viable,
      stem_gap_subjects:       pr.stem_gap_subjects,
      pathway_readiness:       pr.pathway_readiness,
      to_unlock_stem:          pr.to_unlock_stem,
      to_unlock_social:        pr.to_unlock_social,
      to_maintain_recommended: pr.to_maintain_recommended,
      alternative_pathway:     pr.alternative_pathway,
    }
  }
  // ── Junior 3-page redesign v1 fields
  let academicStatusLabel:       string | undefined
  let pathwayReadinessCards:     PathwayReadinessCard[] | undefined
  let pathwayRoadmap:            PathwayRoadmap | undefined
  let termActionPlan:            TermActionPlan | undefined
  let juniorFutureOpportunities: JuniorFutureOpportunity[] | undefined

  if (isJunior && pathwayAnalysis) {
    academicStatusLabel = ACADEMIC_STATUS_LABELS[clinicalOverview.overallCompetencyLevel] ?? 'Developing'
    const pr = pathwayAnalysis.pathway_readiness
    if (pr) {
      pathwayReadinessCards     = buildPathwayReadinessCards(subjects, pr)
      pathwayRoadmap            = buildPathwayRoadmap(pathwayAnalysis.recommendedPathway, pathwayReadinessCards)
      termActionPlan            = buildTermActionPlan(subjects, pathwayAnalysis.recommendedPathway, pathwayReadinessCards)
      juniorFutureOpportunities = [...JUNIOR_FUTURE_OPPORTUNITIES].sort((a, b) =>
        a.pathway === pathwayAnalysis!.recommendedPathway ? -1
        : b.pathway === pathwayAnalysis!.recommendedPathway ? 1
        : 0
      )
    }
  }

  // ── Junior redesign v2 fields
  let juniorImprovementCascade: ReturnType<typeof buildJuniorImprovementCascade> = null
  let juniorActionPriorities:   ReturnType<typeof buildJuniorActionPriorities> | undefined
  let parentAction:             ReturnType<typeof buildParentAction> | undefined

  if (isJunior && pathwayAnalysis && pathwayReadinessCards) {
    juniorImprovementCascade = buildJuniorImprovementCascade(subjects, pathwayReadinessCards, pathwayAnalysis.recommendedPathway)
    juniorActionPriorities   = buildJuniorActionPriorities(subjects, pathwayReadinessCards, pathwayAnalysis.recommendedPathway)
    parentAction             = buildParentAction(subjects, firstName)
  }

  // ── Senior redesign v2 fields
  let seniorReadinessIndicators: ReturnType<typeof buildSeniorReadinessIndicators> | undefined
  let careerInsightCards:        ReturnType<typeof buildCareerInsightCards> | undefined
  let futureScenario:            ReturnType<typeof buildFutureScenario> = null
  let seniorActionPriorities:    ReturnType<typeof buildSeniorActionPriorities> | undefined

  if (!isJunior && seniorGuidance) {
    seniorReadinessIndicators = buildSeniorReadinessIndicators(subjects, studentProfile.pathway, clinicalOverview.trajectory, firstName)
    careerInsightCards        = buildCareerInsightCards(seniorGuidance)
    futureScenario            = buildFutureScenario(subjects)
    seniorActionPriorities    = buildSeniorActionPriorities(subjects, studentProfile.pathway, firstName)
  }

  const holidayPlan        = generateHolidayPlan(subjects)
  const learningCompassRec = generateLearningCompassRec(subjects)

  const dreamCareerInput = assessments
    .sort((a, b) =>
      new Date(b.created_at ?? 0).getTime() - new Date(a.created_at ?? 0).getTime()
    )[0]?.dream_career ?? null

  const cbcScores = Object.fromEntries(subjects.map(s => [s.subject, s.level]))
  const dreamCareerAnalysis = dreamCareerInput
    ? analyzeDreamCareer(dreamCareerInput, cbcScores, studentProfile.pathway ?? undefined)
    : null

  return {
    studentProfile,
    subjectBreakdown:  subjects,
    vitals,
    actionPlan,
    clinicalOverview,
    pathwayAnalysis,
    holidayPlan,
    learningCompassRec,
    juniorGuidance,
    seniorGuidance,
    dreamCareerAnalysis,
    graphData,
    reportId,
    generatedAt: new Date().toISOString(),
    // v1 junior fields
    academicStatusLabel,
    pathwayReadinessCards,
    pathwayRoadmap,
    termActionPlan,
    juniorFutureOpportunities,
    // v2 junior fields
    juniorImprovementCascade,
    juniorActionPriorities,
    parentAction,
    // v2 senior fields
    seniorReadinessIndicators,
    careerInsightCards,
    futureScenario,
    seniorActionPriorities,
    // knowledge graph root causes (populated when strand_assessments data is available)
    knowledgeRootCauses: knowledgeRootCauses ?? [],
  }
}

// ─── Re-exports for consumers ─────────────────────────────────────────────────

export type {
  AcademicClinicReport,
  StudentProfile,
  SubjectProgress,
  Vitals,
  ActionPlan,
  JuniorGuidance,
  SeniorGuidance,
  CareerMatch,
  GraphData,
}
