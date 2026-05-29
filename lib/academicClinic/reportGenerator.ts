// lib/academicClinic/reportGenerator.ts

import { CareerEngine } from './careerEngine'
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
  const byDesc = [...subjects].sort((a, b) => b.level - a.level)
  const byAsc  = [...subjects].sort((a, b) => a.level - b.level)
  const top2   = byDesc.slice(0, 2).map(s => s.displayName)
  const bot2   = byAsc.slice(0, 2).map(s => s.displayName)
  const topLvl = byDesc[0] ? getLevelLabel(byDesc[0].level) : ''

  if (avg >= 3.5) {
    return `${firstName} demonstrates exceptional overall academic competency, with outstanding performance across the majority of assessed subjects. ` +
      `Highest-performing areas include ${top2.join(' and ')}, where ${firstName} operates at ${topLvl} level — placing this student among the upper tier of the academic cohort. ` +
      (byAsc[0]?.level <= 2
        ? `${byAsc[0].displayName} represents an emerging challenge that warrants targeted attention to maintain the overall trajectory. `
        : '') +
      `Clinical recommendation: sustain high performance through advanced enrichment and competition exposure while proactively closing any emerging gaps.`
  }
  if (avg >= 3.0) {
    return `${firstName} demonstrates strong and consistent academic competency, with a well-rounded performance profile across assessed subjects. ` +
      `Areas of particular strength include ${top2.join(' and ')}, which reflect ${firstName}'s core academic aptitudes and should be actively nurtured. ` +
      (byAsc[0]?.level <= 2
        ? `${firstName} demonstrates an emerging challenge in ${bot2.join(' and ')}, representing a priority intervention area to prevent further progression gaps. `
        : '') +
      `The overall trajectory indicates a highly capable learner well-positioned for continued academic advancement with targeted support in identified areas.`
  }
  if (avg >= 2.5) {
    return `${firstName} demonstrates developing competency with clear academic strengths emerging in ${top2.join(' and ')}. ` +
      `The assessment identifies ${bot2.join(' and ')} as priority intervention areas requiring structured and consistent support to close identified foundational gaps. ` +
      `${firstName}'s performance trajectory indicates a learner with real potential — with targeted intervention, meaningful improvement is achievable within one academic term. ` +
      `Clinical recommendation: implement the 3-week holiday action plan with particular focus on identified priority areas to build a stronger foundation for the coming term.`
  }
  if (avg >= 2.0) {
    return `${firstName}'s current assessment reveals developing competency across the curriculum, with relative strengths observed in ${top2.join(' and ')}. ` +
      `Priority intervention areas include ${bot2.join(' and ')}, where foundational gaps have been clearly identified and require immediate structured support. ` +
      `The trajectory indicates that consistent, structured support is essential at this stage to unlock ${firstName}'s academic potential. ` +
      `Clinical recommendation: an intensive holiday study programme combined with regular EduNexus Learning Compass sessions will be critical in reversing this trajectory.`
  }
  return `${firstName}'s current assessment reveals emerging competency across multiple curriculum areas, with ${bot2.join(' and ')} identified as critical priority intervention areas. ` +
    `Foundational gaps across several subjects indicate that intensive, structured support is urgently required. ` +
    `Early and consistent intervention at this developmental stage yields significantly positive outcomes — the holiday period represents a critical intervention window. ` +
    `Clinical recommendation: implement the daily holiday study plan immediately, engage the EduNexus Learning Compass three times per week, and share this report with ${firstName}'s class teacher.`
}

export function generateClinicalOverview(
  firstName: string,
  subjects: SubjectProgress[],
  assessments: any[]
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
    const prev     = assessments[assessments.length - 2]?.subject_scores || {}
    const prevVals = Object.values(prev) as number[]
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

const PATHWAY_MAP: Record<string, 'STEM' | 'Social Sciences' | 'Arts & Sports Science'> = {
  mathematics: 'STEM', core_mathematics: 'STEM', essential_mathematics: 'STEM',
  integrated_science: 'STEM', biology: 'STEM', chemistry: 'STEM', physics: 'STEM',
  computer_studies: 'STEM', pre_technical: 'STEM',
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

export function generatePathwayAnalysis(subjects: SubjectProgress[], firstName: string): PathwayAnalysis {
  const buckets: Record<'STEM' | 'Social Sciences' | 'Arts & Sports Science', number[]> = {
    'STEM': [], 'Social Sciences': [], 'Arts & Sports Science': [],
  }

  for (const s of subjects) {
    const p = PATHWAY_MAP[s.subject]
    if (p) buckets[p].push(s.level)
  }

  const overallAvg = subjects.reduce((s, x) => s + x.level, 0) / subjects.length
  const toScore = (levels: number[]) =>
    levels.length ? Math.round(((levels.reduce((a, b) => a + b, 0) / levels.length) - 1) / 3 * 100)
                  : Math.round(((overallAvg - 1) / 3) * 55)

  const pathwayScores: PathwayScore[] = ([
    { name: 'STEM'                  as const, score: toScore(buckets['STEM']),                  color: '#3b82f6' },
    { name: 'Social Sciences'       as const, score: toScore(buckets['Social Sciences']),       color: '#10b981' },
    { name: 'Arts & Sports Science' as const, score: toScore(buckets['Arts & Sports Science']), color: '#f59e0b' },
  ] as PathwayScore[]).sort((a, b) => b.score - a.score)

  const best      = pathwayScores[0]
  const recommended = best.name as 'STEM' | 'Social Sciences' | 'Arts & Sports Science'
  const confidence: 'HIGH' | 'MEDIUM' | 'DEVELOPING' = best.score >= 70 ? 'HIGH' : best.score >= 50 ? 'MEDIUM' : 'DEVELOPING'

  const pathSubjects = subjects.filter(s => PATHWAY_MAP[s.subject] === recommended).sort((a, b) => b.level - a.level)
  const strong = pathSubjects.filter(s => s.level >= 3).slice(0, 2)

  const reasons: string[] = []
  if (strong.length > 0) {
    reasons.push(
      `Demonstrates ${getLevelLabel(strong[0].level)} competency in ${strong.map(s => s.displayName).join(' and ')}, which are core subjects of the ${recommended} pathway.`
    )
  } else if (pathSubjects.length > 0) {
    reasons.push(`Shows developing aptitude aligned with ${recommended} subjects based on current assessment data.`)
  } else {
    reasons.push(`Overall performance profile suggests alignment with ${recommended} pathway characteristics.`)
  }

  if (recommended === 'STEM') {
    reasons.push('Analytical and quantitative reasoning skills observed in assessment data support STEM pathway engagement.')
    reasons.push('Strong STEM foundations at this stage are critical access points for engineering, medicine, and technology degree programmes.')
  } else if (recommended === 'Social Sciences') {
    reasons.push('Communication, civic reasoning, and analytical skills align well with Social Sciences pathway requirements and outcomes.')
    reasons.push('Social Sciences opens access to law, business, education, and public service — high-demand career pathways in Kenya.')
  } else {
    reasons.push('Creative expression and physical aptitude observed in assessment data align naturally with Arts & Sports Science pathway.')
    reasons.push('Arts & Sports Science leads to design, performance, sports science, media, and creative industries — a rapidly growing sector in Kenya.')
  }

  const toStrengthen = [...subjects]
    .filter(s => PATHWAY_MAP[s.subject] === recommended || !PATHWAY_MAP[s.subject])
    .sort((a, b) => a.level - b.level)
    .slice(0, 3)
    .map(s => s.displayName)

  const futureMessage =
    recommended === 'STEM'
      ? `A strong STEM pathway in Grade 10–12 opens doors to Medicine, Engineering, Technology, and Data Science — some of the highest-demand careers in Kenya and globally. With continued investment in ${firstName}'s foundational sciences now, these pathways become increasingly accessible.`
      : recommended === 'Social Sciences'
      ? `The Social Sciences pathway in Grade 10–12 leads to Law, Business, Education, Public Policy, and Finance — careers at the heart of Kenya's growth story. ${firstName}'s current trajectory suggests a strong fit for these intellectually stimulating and socially impactful pathways.`
      : `The Arts & Sports Science pathway in Grade 10–12 leads to careers in design, performing arts, sports science, media, and creative industries — a rapidly growing sector in Kenya. ${firstName}'s creative and physical aptitudes represent a genuine and valuable talent worth developing fully.`

  return { pathwayScores, recommendedPathway: recommended, confidenceLevel: confidence, reasons, subjectsToStrengthen: toStrengthen, futureMessage }
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

export function generateSeniorGuidance(subjects: SubjectProgress[], firstName = 'This student'): SeniorGuidance {
  const engine = new CareerEngine()
  const scores = Object.fromEntries(subjects.map(s => [s.subject, s.level]))
  const subjectAvg = subjects.reduce((s, x) => s + x.level, 0) / subjects.length
  const tier: 'high' | 'mid' | 'low' = subjectAvg >= 3.0 ? 'high' : subjectAvg >= 2.0 ? 'mid' : 'low'

  const engineResults = engine.matchCareers(scores, tier).slice(0, 3)

  const scored = engineResults.map(match => {
    const keyHits = subjects.filter(s => match.career.matchRequirements.primarySubjects.includes(s.subject))
    const gapSubjects = match.gapSubjects.map(s => formatSubjectName(s))
    const score = match.matchScore / 25
    const matchStrength: 'STRONG' | 'GOOD' | 'POSSIBLE' = match.matchScore >= 75 ? 'STRONG' : match.matchScore >= 55 ? 'GOOD' : 'POSSIBLE'
    return {
      career: {
        name: match.career.name,
        kenyanPathway: match.career.cbeReadiness.recommendedSeniorPath,
        requiredSubjects: match.career.matchRequirements.primarySubjects,
      },
      score, matchStrength, keyHits, gapSubjects,
    }
  })

  const topCareers: CareerMatch[] = scored.map(({ career, matchStrength, keyHits, gapSubjects }) => {
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
      matchPercentage: Math.round((scored[0].score / 4) * 100),
      matchStrength,
      whyItFits,
      keyGap,
      kenyanPathway: career.kenyanPathway,
      requiredSubjects: career.requiredSubjects,
    }
  })

  const honestAssessment = subjectAvg >= 3.0
    ? `Based on current performance data, ${topCareers[0]?.name} and ${topCareers[1]?.name} represent realistic and well-matched pathways. With sustained effort and targeted support in identified gap areas, these careers are genuinely achievable through the Kenyan university system.`
    : `Current performance indicates that focused preparation will be required before these career pathways become fully accessible. The holiday action plan and consistent Learning Compass sessions are critical tools for closing the identified gaps before KCSE.`

  return {
    topCareers,
    reasoning: `Career recommendations are based on ${firstName}'s subject performance and the entry requirements for each pathway in the Kenyan education system.`,
    nextSteps: [
      `Prioritise strengthening ${subjects.sort((a, b) => a.level - b.level)[0]?.displayName || 'priority subjects'} before the next term`,
      'Research KCSE minimum grade requirements for target university programmes',
      'Speak with your school career counsellor about pathway choices before Grade 10',
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

function getSubjectActivities(subject: string, level: number): string[] {
  const tier = level <= 1 ? 'low' : level === 2 ? 'mid' : level === 3 ? 'mid' : 'high'
  return SUBJECT_TOPICS[subject]?.[tier] || [
    level <= 2 ? `Complete 20 minutes of ${formatSubjectName(subject)} past paper practice daily` : `Explore advanced ${formatSubjectName(subject)} topics beyond the syllabus`,
    level <= 2 ? `Focus on the fundamental concepts identified as weak in your last assessment` : `Teach one core concept to someone at home to deepen mastery`,
    level <= 2 ? `Create a mind-map of the main topics in ${formatSubjectName(subject)} from this term` : `Research how ${formatSubjectName(subject)} connects to a career you find interesting`,
  ]
}

export function generateHolidayPlan(subjects: SubjectProgress[]): HolidayActionPlan {
  const byAsc   = [...subjects].sort((a, b) => a.level - b.level)
  const level12 = byAsc.filter(s => s.level <= 2).slice(0, 2)
  const level23 = byAsc.filter(s => s.level >= 2 && s.level <= 3).slice(0, 2)
  const level34 = byAsc.filter(s => s.level >= 3).slice(0, 2)

  // Fallbacks
  const w1focus = level12.length > 0 ? level12 : byAsc.slice(0, 2)
  const w2focus = level23.length > 0 ? level23 : byAsc.slice(1, 3)
  const w3focus = level34.length > 0 ? level34 : [...subjects].sort((a, b) => b.level - a.level).slice(0, 2)

  const week1: WeekPlan = {
    weekNumber: 1,
    title: 'FOUNDATION WEEK',
    theme: 'Close the Critical Gaps',
    focusSubjects: w1focus.map(s => s.displayName),
    dailyMinutes: 45,
    goal: 'Move from Emerging to Developing — build foundational competency in priority areas before the next term',
    activities: w1focus.flatMap(s => getSubjectActivities(s.subject, s.level)),
  }

  const week2: WeekPlan = {
    weekNumber: 2,
    title: 'BUILDING WEEK',
    theme: 'Consolidate and Close Gaps',
    focusSubjects: w2focus.map(s => s.displayName),
    dailyMinutes: 30,
    goal: 'Push Developing subjects toward Proficient — consolidate understanding and reduce revision gaps',
    activities: w2focus.flatMap(s => getSubjectActivities(s.subject, s.level)),
  }

  const week3: WeekPlan = {
    weekNumber: 3,
    title: 'EXCELLENCE WEEK',
    theme: 'Reach and Sustain Level 4',
    focusSubjects: w3focus.map(s => s.displayName),
    dailyMinutes: 20,
    goal: 'Advance strong subjects toward Exemplary level — explore extension opportunities and enrich learning',
    activities: w3focus.flatMap(s => getSubjectActivities(s.subject, s.level)),
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

// ─── Main Report Generator ────────────────────────────────────────────────────

export function generateReport(
  studentProfile: StudentProfile,
  subjects:        SubjectProgress[],
  vitals:          Vitals,
  actionPlan:      ActionPlan,
  assessments:     any[],
  juniorGuidance?: JuniorGuidance,
  seniorGuidance?: SeniorGuidance
): AcademicClinicReport {
  const firstName = studentProfile.name.split(' ')[0]
  const isJunior  = studentProfile.grade >= 7 && studentProfile.grade <= 9

  const reportId         = `EC-${studentProfile.year}-${Math.random().toString(36).substring(2, 8).toUpperCase()}`
  const graphData        = generateGraphData(subjects)
  const clinicalOverview = generateClinicalOverview(firstName, subjects, assessments)
  const pathwayAnalysis  = isJunior ? generatePathwayAnalysis(subjects, firstName) : undefined
  const holidayPlan      = generateHolidayPlan(subjects)
  const learningCompassRec = generateLearningCompassRec(subjects)

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
    graphData,
    reportId,
    generatedAt: new Date().toISOString(),
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
