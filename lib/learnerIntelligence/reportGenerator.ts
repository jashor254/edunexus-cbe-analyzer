// lib/learnerIntelligence/reportGenerator.ts
// Transforms assessment data into a Learner Intelligence Report.
// Answers one question: "Who is this learner becoming?"

import type { SubjectProgress, StudentProfile, AcademicClinicReport } from '@/lib/academicClinic/types'
import { getLevelLabel } from '@/lib/academicClinic/reportGenerator'
import type {
  LearnerIntelligenceReport,
  LearnerSnapshot,
  LearningIntelligence,
  FutureReadiness,
  GrowthStage,
  BehaviourLabel,
  StrengthCard,
  GrowthAreaCard,
  PathwayDirection,
  AcademicStrengthInsight,
  GrowthAreaInsight,
  LearningBehaviourProfile,
  BehaviourDimension,
  ParentAction,
  PathwayReadinessInsight,
  CareerDirection,
  OpportunityInsight,
  PathwayKey,
} from './types'

// ─── Growth Stage ─────────────────────────────────────────────────────────────

function getGrowthStage(avgLevel: number): GrowthStage {
  if (avgLevel >= 3.5) return 'Leading Edge'
  if (avgLevel >= 3.0) return 'Strong Momentum'
  if (avgLevel >= 2.5) return 'Active Growth'
  if (avgLevel >= 2.0) return 'Building Foundations'
  return 'Early Foundations'
}

// ─── Future Readiness Score ───────────────────────────────────────────────────
// Synthesises level average, trajectory, and strength/gap spread into a 0–100 score.

function computeFutureReadinessScore(
  subjects: SubjectProgress[],
  trajectory: string,
): number {
  const avg = subjects.reduce((s, x) => s + x.level, 0) / subjects.length
  let score = (avg / 4) * 100

  if (trajectory === 'IMPROVING') score += 5
  if (trajectory === 'CRITICAL')  score -= 10
  if (trajectory === 'NEEDS ATTENTION') score -= 4

  const hasExemplary = subjects.some(s => s.level === 4)
  const hasCritical  = subjects.some(s => s.level === 1)
  if (hasExemplary) score += 4
  if (hasCritical)  score -= 5

  const improving = subjects.filter(s => s.trend === 'improving').length
  score += (improving / subjects.length) * 6

  return Math.round(Math.max(5, Math.min(98, score)))
}

function getFRSLabel(score: number): LearnerSnapshot['futureReadinessLabel'] {
  if (score >= 82) return 'Leading'
  if (score >= 68) return 'Strong'
  if (score >= 52) return 'Growing'
  if (score >= 38) return 'Emerging'
  return 'Building'
}

// ─── Strength Cards ───────────────────────────────────────────────────────────

const STRENGTH_OBSERVATIONS: Record<string, Record<number, string>> = {
  mathematics: {
    3: 'Strong analytical reasoning — mathematical thinking is a genuine asset.',
    4: 'Exceptional mathematical aptitude — well ahead of the curve.',
  },
  core_mathematics: {
    3: 'Solid quantitative foundation — positions well for STEM progression.',
    4: 'Exceptional mathematical aptitude — a top-tier academic asset.',
  },
  english: {
    3: 'Confident communicator — reading and writing skills are well established.',
    4: 'Exceptional language command — a significant cross-subject advantage.',
  },
  kiswahili: {
    3: 'Strong national language competency — a broad communication asset.',
    4: 'Exemplary Kiswahili — opens doors across civic and creative pathways.',
  },
  kiswahili_ksl: {
    3: 'Strong national language competency — a broad communication asset.',
    4: 'Exemplary Kiswahili — opens doors across civic and creative pathways.',
  },
  integrated_science: {
    3: 'Strong scientific reasoning — ready for deeper specialisation.',
    4: 'Exceptional scientific aptitude — well positioned for STEM advancement.',
  },
  biology: {
    3: 'Strong biological understanding — health sciences pathway is open.',
    4: 'Exceptional biology performance — medicine and life sciences are within reach.',
  },
  chemistry: {
    3: 'Solid chemistry competency — STEM pathways are strongly supported.',
    4: 'Exceptional chemistry aptitude — medicine and engineering pathways align well.',
  },
  physics: {
    3: 'Strong physics reasoning — engineering and applied sciences are accessible.',
    4: 'Exceptional physics aptitude — top-tier STEM pathway candidate.',
  },
  social_studies: {
    3: 'Strong civic and social reasoning — law and humanities pathways are building.',
    4: 'Exceptional social understanding — a natural fit for leadership and civic roles.',
  },
  geography: {
    3: 'Solid geographical understanding — environmental pathways are open.',
    4: 'Exceptional geography aptitude — environmental management and planning align.',
  },
  history_citizenship: {
    3: 'Strong historical reasoning — law and public service are natural directions.',
    4: 'Exceptional historical understanding — governance and advocacy pathways are clear.',
  },
  history: {
    3: 'Strong historical reasoning — law and public service are natural directions.',
    4: 'Exceptional historical understanding — governance and advocacy pathways are clear.',
  },
  business_studies: {
    3: 'Strong business acumen — commerce and entrepreneurship pathways are open.',
    4: 'Exceptional business aptitude — entrepreneurship and finance are natural fits.',
  },
  computer_studies: {
    3: 'Strong computing skills — technology and digital careers are accessible.',
    4: 'Exceptional computing aptitude — software and data pathways are well supported.',
  },
  creative_arts_sports: {
    3: 'Strong creative and physical expression — arts and sports pathways are open.',
    4: 'Exceptional creative aptitude — design, media, and sports science pathways align.',
  },
}

const DEFAULT_STRENGTH_OBS: Record<number, string> = {
  3: 'Demonstrates consistent proficiency — a reliable academic strength.',
  4: 'Exceptional performance — a standout academic asset.',
}

function buildStrengthCards(subjects: SubjectProgress[]): StrengthCard[] {
  return [...subjects]
    .filter(s => s.level >= 3)
    .sort((a, b) => b.level - a.level || (b.velocity - a.velocity))
    .slice(0, 3)
    .map(s => ({
      subjectName:  s.displayName,
      level:        s.level as 1 | 2 | 3 | 4,
      levelLabel:   getLevelLabel(s.level),
      observation:  STRENGTH_OBSERVATIONS[s.subject]?.[s.level] ?? DEFAULT_STRENGTH_OBS[s.level] ?? DEFAULT_STRENGTH_OBS[3],
    }))
}

// ─── Growth Area Card ─────────────────────────────────────────────────────────

const GROWTH_WHY_MATTERS: Record<string, string> = {
  mathematics:          'Mathematics is the gateway to STEM — engineering, computing, and data science all require this foundation.',
  core_mathematics:     'Core Mathematics is the key that unlocks the widest range of university and career pathways.',
  english:              'English is the single subject required for every career and university pathway in Kenya.',
  kiswahili:            'Kiswahili meets the national language requirement that opens broader university options.',
  kiswahili_ksl:        'Kiswahili meets the national language requirement that opens broader university options.',
  integrated_science:   'Integrated Science lays the foundation for Biology, Chemistry, and Physics in Senior School.',
  biology:              'Biology is the entry point for medicine, health sciences, and life sciences careers.',
  chemistry:            'Chemistry supports medicine, pharmacy, and chemical engineering — high-demand careers.',
  physics:              'Physics unlocks engineering, architecture, and applied technology pathways.',
  social_studies:       'Social Studies underpins the Social Sciences pathway and all civic and public service careers.',
  history_citizenship:  'History & Citizenship is the core subject supporting law, governance, and public administration.',
  history:              'History supports law, political science, and all social sciences at university level.',
  geography:            'Geography opens environmental science, urban planning, and sustainability careers.',
  business_studies:     'Business Studies opens commerce, entrepreneurship, and finance — Kenya\'s fastest growing sectors.',
  computer_studies:     'Computing skills are foundational for the digital economy and technology-driven future.',
  creative_arts_sports: 'Creative Arts & Sports is the pathway into design, media, sports science, and the creative economy.',
}

const GROWTH_UNLOCK: Record<string, string> = {
  mathematics:          'Improving Mathematics by one level opens STEM, engineering, and computing career pathways.',
  core_mathematics:     'Improving Core Mathematics opens engineering, technology, and data science university programmes.',
  english:              'Improving English strengthens every pathway — it has the broadest impact of any single subject.',
  kiswahili:            'Improving Kiswahili meets the national language requirement for a wider range of university courses.',
  kiswahili_ksl:        'Improving Kiswahili meets the national language requirement for a wider range of university courses.',
  integrated_science:   'Improving Integrated Science confirms readiness for science specialisations in Senior School.',
  biology:              'Improving Biology opens medical, nursing, and life sciences university programmes.',
  chemistry:            'Improving Chemistry strengthens medicine, pharmacy, and engineering programme eligibility.',
  physics:              'Improving Physics unlocks engineering and applied sciences university access.',
  social_studies:       'Improving Social Studies confirms the Social Sciences pathway and civic career readiness.',
  history_citizenship:  'Improving History strengthens law and political science programme access.',
  history:              'Improving History strengthens law and political science programme access.',
  geography:            'Improving Geography opens environmental careers and strengthens social sciences university options.',
  business_studies:     'Improving Business Studies confirms commerce and entrepreneurship pathway access.',
  computer_studies:     'Improving Computing opens digital economy careers and technology degree programmes.',
  creative_arts_sports: 'Improving Creative Arts & Sports confirms Arts pathway access and creative industry opportunities.',
}

function buildGrowthAreaCard(subjects: SubjectProgress[]): GrowthAreaCard {
  const byLevel = [...subjects].sort((a, b) => a.level - b.level)
  const target  = byLevel[0]
  if (!target) {
    return {
      subjectName:     'All subjects',
      level:           3,
      whyItMatters:    'All subjects are performing at a strong level.',
      unlockStatement: 'Continue advancing across all subject areas.',
    }
  }
  return {
    subjectName:     target.displayName,
    level:           target.level as 1 | 2 | 3 | 4,
    whyItMatters:    GROWTH_WHY_MATTERS[target.subject] ?? `${target.displayName} is a key area where progress will unlock broader opportunities.`,
    unlockStatement: GROWTH_UNLOCK[target.subject]  ?? `Improving ${target.displayName} will open additional pathway and career options.`,
  }
}

// ─── Pathway Direction ────────────────────────────────────────────────────────

const PATHWAY_DIRECTION_STATEMENTS: Record<string, Record<string, string>> = {
  'STEM': {
    'Strongly Ready':                   'Current strengths in Mathematics and Sciences point clearly toward STEM — this pathway is well within reach.',
    'Within Reach':                      'STEM is the emerging direction. A targeted push in the priority subject will confirm this pathway.',
    'Requires Improvement':              'STEM potential is visible. Closing the identified gaps will open this high-demand pathway.',
    'Significant Preparation Needed':    'STEM is a possible future direction with focused effort and early preparation.',
  },
  'Social Sciences': {
    'Strongly Ready':                   'Strong language and reasoning skills point clearly toward Social Sciences — law, business, and education all align well.',
    'Within Reach':                      'Social Sciences is the emerging direction. Strengthening the priority subject will confirm this pathway.',
    'Requires Improvement':              'Social Sciences potential is visible. Consistent effort in English and Social Studies will open this pathway.',
    'Significant Preparation Needed':    'Social Sciences is a possible future direction with dedicated preparation.',
  },
  'Arts & Sports Science': {
    'Strongly Ready':                   'Creative and physical aptitude clearly aligns with Arts & Sports Science — this pathway is confirmed.',
    'Within Reach':                      'Arts & Sports Science is the emerging direction. Continued creative engagement will confirm this pathway.',
    'Requires Improvement':              'Arts & Sports Science potential is visible. Regular creative and physical practice will open this pathway.',
    'Significant Preparation Needed':    'Arts & Sports Science is a possible direction with dedicated creative or sporting engagement.',
  },
}

function getPathwayReadinessLabel(score: number): string {
  if (score >= 80) return 'Strongly Ready'
  if (score >= 60) return 'Within Reach'
  if (score >= 40) return 'Requires Improvement'
  return 'Significant Preparation Needed'
}

function buildPathwayDirection(report: AcademicClinicReport): PathwayDirection {
  const pa    = report.pathwayAnalysis
  const cards = report.pathwayReadinessCards ?? []

  if (!pa && cards.length === 0) {
    const pathway = report.studentProfile.pathway ?? 'STEM'
    return {
      pathway:            pathway as PathwayKey,
      readinessScore:     50,
      readinessLabel:     'Developing',
      directionStatement: `${report.studentProfile.name.split(' ')[0]} is working toward the ${pathway} pathway.`,
      isRecommended:      true,
    }
  }

  const recommended = (pa?.recommendedPathway ?? 'STEM') as PathwayKey
  const card        = cards.find(c => c.pathway === recommended)
  const score       = card?.score ?? (pa?.pathwayScores?.find(p => p.name === recommended)?.score ?? 50)
  const label       = card?.statusLabel ?? getPathwayReadinessLabel(score)
  const statement   = PATHWAY_DIRECTION_STATEMENTS[recommended]?.[label]
    ?? `${report.studentProfile.name.split(' ')[0]} is developing toward the ${recommended} pathway.`

  return {
    pathway:            recommended,
    readinessScore:     score,
    readinessLabel:     label,
    directionStatement: statement,
    isRecommended:      true,
  }
}

// ─── Emerging Opportunities ───────────────────────────────────────────────────

const PATHWAY_OPPORTUNITIES: Record<string, string[]> = {
  'STEM':                  ['Engineering & Technology', 'Health Sciences', 'Data & Computing', 'Applied Sciences', 'Environmental STEM'],
  'Social Sciences':       ['Law & Advocacy', 'Business & Finance', 'Education & Training', 'Public Service', 'Media & Communication'],
  'Arts & Sports Science': ['Sports Science & Coaching', 'Creative Design', 'Performing Arts', 'Media Production', 'Physical Education'],
}

// ─── Learner Story ────────────────────────────────────────────────────────────

function buildLearnerStory(
  firstName: string,
  subjects: SubjectProgress[],
  avgLevel: number,
  trajectory: string,
  growthStage: GrowthStage,
  strongestSubject: SubjectProgress | undefined,
  weakestSubject: SubjectProgress | undefined,
  recommendedPathway: string,
): string {
  const improving   = subjects.filter(s => s.trend === 'improving')
  const hasStrength = subjects.some(s => s.level >= 3)
  const hasGap      = subjects.some(s => s.level <= 2)

  // Opening: who is this learner?
  let opening: string
  if (growthStage === 'Leading Edge' || growthStage === 'Strong Momentum') {
    opening = `${firstName} is a ${growthStage.toLowerCase()} learner who demonstrates consistent academic competency across multiple subjects${strongestSubject ? `, with a particular aptitude in ${strongestSubject.displayName}` : ''}.`
  } else if (growthStage === 'Active Growth') {
    opening = `${firstName} is in a phase of active growth — emerging strengths are becoming visible${strongestSubject ? `, especially in ${strongestSubject.displayName}` : ''}, and the foundations for a strong academic profile are being laid.`
  } else {
    opening = `${firstName} is at the ${growthStage.toLowerCase()} stage — working to establish core academic foundations across subjects${strongestSubject ? `, with the most visible progress in ${strongestSubject.displayName}` : ''}.`
  }

  // Middle: what's slowing progress?
  let middle: string
  if (!hasGap) {
    middle = `Across all assessed subjects, ${firstName} is performing at or above the expected level${trajectory === 'IMPROVING' ? ', with a positive improving trend indicating continued momentum' : ''}.`
  } else if (weakestSubject) {
    middle = `${weakestSubject.displayName} currently represents the biggest opportunity — this is the single area where focused effort will have the greatest effect on ${firstName}'s overall trajectory${improving.length > 0 ? `, though it is encouraging that ${firstName} is already showing an improving trend in ${improving.length} subject${improving.length > 1 ? 's' : ''}` : ''}.`
  } else {
    middle = `There are clear opportunities to build further across the curriculum, and current evidence suggests ${firstName} has the capacity to improve with consistent effort.`
  }

  // Closing: future potential
  let closing: string
  if (avgLevel >= 3.0) {
    closing = `Current evidence positions ${firstName} well for the ${recommendedPathway} pathway — with continued investment, the academic profile needed to access a wide range of future opportunities is well within reach.`
  } else if (avgLevel >= 2.0) {
    closing = `Current evidence suggests that with targeted support in the priority areas, ${firstName}'s pathway toward ${recommendedPathway} is achievable — the potential is visible, and the next step is building momentum through consistent effort.`
  } else {
    closing = `At this stage, the most important thing is consistent daily engagement — even small improvements across subjects will compound quickly, and ${firstName}'s future is far from fixed by current performance.`
  }

  return `${opening} ${middle} ${closing}`
}

// ─── Academic Strength Insights ───────────────────────────────────────────────

const COMPETENCY_NOTES: Record<string, Record<number, string>> = {
  mathematics: {
    3: 'Demonstrates solid problem-solving and quantitative reasoning.',
    4: 'Exceptional mathematical aptitude — a clear academic differentiator.',
  },
  english: {
    3: 'Confident reading, writing, and communication skills evident.',
    4: 'Exemplary language command — a cross-subject advantage.',
  },
  integrated_science: {
    3: 'Scientific inquiry and reasoning skills are well established.',
    4: 'Exceptional scientific competency — strong STEM foundation.',
  },
  biology: {
    3: 'Strong biological understanding and life sciences competency.',
    4: 'Exceptional biology — health sciences pathways confirmed.',
  },
  chemistry: {
    3: 'Solid chemistry competency with applied scientific reasoning.',
    4: 'Exceptional chemistry — medicine and engineering pathways align.',
  },
  physics: {
    3: 'Strong physics reasoning — applied sciences are accessible.',
    4: 'Exceptional physics — engineering pathways are well supported.',
  },
  social_studies: {
    3: 'Strong civic and social reasoning skills are developing well.',
    4: 'Exceptional social understanding — a natural civic leader emerging.',
  },
  geography: {
    3: 'Solid geographical understanding — environmental awareness evident.',
    4: 'Exceptional geography — environmental careers are strongly indicated.',
  },
  business_studies: {
    3: 'Strong business acumen and entrepreneurial thinking evident.',
    4: 'Exceptional business aptitude — a natural commercial instinct.',
  },
  creative_arts_sports: {
    3: 'Strong creative and physical expression — an artistic/sporting identity is emerging.',
    4: 'Exceptional creative aptitude — a standout talent in this domain.',
  },
}

const DEFAULT_COMPETENCY: Record<number, string> = {
  3: 'Consistent proficiency — performing reliably above the expected level.',
  4: 'Exceptional aptitude — a standout academic strength in this area.',
}

function buildAcademicStrengths(subjects: SubjectProgress[]): AcademicStrengthInsight[] {
  return [...subjects]
    .filter(s => s.level >= 3)
    .sort((a, b) => b.level - a.level)
    .slice(0, 4)
    .map(s => {
      const trendNote = s.trend === 'improving'
        ? 'Performance is trending upward — this strength is still growing.'
        : s.trend === 'declining'
        ? 'Performance has dipped recently — worth monitoring to protect this strength.'
        : undefined
      return {
        subjectName:   s.displayName,
        level:         s.level as 1 | 2 | 3 | 4,
        competencyNote: COMPETENCY_NOTES[s.subject]?.[s.level] ?? DEFAULT_COMPETENCY[s.level] ?? DEFAULT_COMPETENCY[3],
        trendNote,
      }
    })
}

// ─── Growth Area Insights ─────────────────────────────────────────────────────

const GAP_EXPLANATIONS: Record<string, Record<number, string>> = {
  mathematics: {
    1: 'Foundational number sense and algebraic reasoning need structured daily practice.',
    2: 'Problem-solving fluency is still developing — targeted practice will accelerate progress.',
  },
  english: {
    1: 'Core reading and writing skills need urgent focused attention — this affects all other subjects.',
    2: 'Vocabulary, grammar, and written expression are developing — consistent reading will help significantly.',
  },
  integrated_science: {
    1: 'Scientific reasoning and inquiry skills are at an early stage — practical, hands-on engagement is recommended.',
    2: 'Understanding of scientific processes is developing — structured revision of key concepts will help.',
  },
  biology: {
    1: 'Foundational biological concepts need revisiting through annotated diagrams and mnemonics.',
    2: 'Key biological systems are not yet fully consolidated — structured revision is the priority.',
  },
  social_studies: {
    1: 'Civic and geographic understanding needs foundational support through reading and discussion.',
    2: 'Social reasoning and historical awareness are developing — regular engagement with current events will help.',
  },
  history_citizenship: {
    1: 'Historical narrative and civic understanding are at a foundational stage.',
    2: 'Essay structure and historical argument development are the next focus areas.',
  },
  kiswahili: {
    1: 'Basic Kiswahili reading and writing need daily practice to build confidence and fluency.',
    2: 'Kiswahili grammar and written expression are developing — regular reading will accelerate growth.',
  },
  kiswahili_ksl: {
    1: 'Basic Kiswahili reading and writing need daily practice to build confidence and fluency.',
    2: 'Kiswahili grammar and written expression are developing — regular reading will accelerate growth.',
  },
}

const DEFAULT_GAP: Record<number, string> = {
  1: 'Foundational concepts need structured support — this is the priority gap to close.',
  2: 'Developing competency — targeted practice will help consolidate understanding.',
}

function buildGrowthAreaInsights(subjects: SubjectProgress[]): GrowthAreaInsight[] {
  return [...subjects]
    .filter(s => s.level <= 2)
    .sort((a, b) => a.level - b.level)
    .slice(0, 3)
    .map(s => ({
      subjectName:    s.displayName,
      level:          s.level as 1 | 2 | 3 | 4,
      gapExplanation: GAP_EXPLANATIONS[s.subject]?.[s.level] ?? DEFAULT_GAP[s.level] ?? DEFAULT_GAP[2],
      unlockMessage:  GROWTH_UNLOCK[s.subject] ?? `Improving ${s.displayName} opens broader academic and career opportunities.`,
    }))
}

// ─── Learning Behaviour Profile ───────────────────────────────────────────────

function stdDev(values: number[]): number {
  if (values.length === 0) return 0
  const mean = values.reduce((s, v) => s + v, 0) / values.length
  return Math.sqrt(values.reduce((s, v) => s + Math.pow(v - mean, 2), 0) / values.length)
}

function behaviourLabel(value: number, thresholds: [number, number, number]): BehaviourLabel {
  if (value >= thresholds[0]) return 'Strong'
  if (value >= thresholds[1]) return 'Developing'
  if (value >= thresholds[2]) return 'Emerging'
  return 'Needs Support'
}

function buildBehaviourProfile(subjects: SubjectProgress[], firstName: string): LearningBehaviourProfile {
  const levels    = subjects.map(s => s.level)
  const sd        = stdDev(levels)
  const avgLevel  = levels.reduce((s, v) => s + v, 0) / levels.length
  const improving = subjects.filter(s => s.trend === 'improving')
  const declining = subjects.filter(s => s.trend === 'declining')
  const highConf  = subjects.filter(s => s.level >= 3)
  const velAvg    = subjects.reduce((s, x) => s + x.velocity, 0) / subjects.length
  const persistors = subjects.filter(s => s.level <= 2 && s.trend === 'improving')

  // Consistency: lower SD = more consistent
  const consLabel = sd <= 0.5 ? 'Strong' : sd <= 0.9 ? 'Developing' : sd <= 1.3 ? 'Emerging' : 'Needs Support'
  const consDescriptions: Record<BehaviourLabel, string> = {
    'Strong':       `${firstName} performs at a consistent level across all subjects — no major gaps between best and weakest areas.`,
    'Developing':   `${firstName} shows some variation between subjects, with clear strengths and one or two developing areas.`,
    'Emerging':     `${firstName}'s performance varies noticeably across subjects — the gap between strengths and weaker areas is significant.`,
    'Needs Support':`${firstName}'s performance ranges widely across subjects — building a more even foundation is the priority.`,
  }
  const consistency: BehaviourDimension = {
    label:       consLabel,
    title:       'Consistency',
    description: consDescriptions[consLabel],
  }

  // Engagement: % of subjects showing improvement
  const engPct    = improving.length / subjects.length
  const engLabel: BehaviourLabel = engPct >= 0.4 ? 'Strong' : engPct >= 0.2 ? 'Developing' : engPct >= 0.1 ? 'Emerging' : 'Needs Support'
  const engDescriptions: Record<BehaviourLabel, string> = {
    'Strong':       `${firstName} shows an improving trend in ${improving.length} subjects — high engagement is evident.`,
    'Developing':   `${improving.length > 0 ? `${firstName} is improving in ${improving.length} subject${improving.length > 1 ? 's' : ''}` : `${firstName}'s engagement is developing`} — continued active participation will build momentum.`,
    'Emerging':     `Engagement signals are mixed — ${declining.length > 0 ? `${declining.length} subject${declining.length > 1 ? 's show' : ' shows'} a declining trend that needs attention` : 'consistent active engagement will make a significant difference'}.`,
    'Needs Support':`Engagement needs to increase — most subjects are stable or declining, suggesting effort and participation need to be reinvigorated.`,
  }
  const engagement: BehaviourDimension = {
    label:       engLabel,
    title:       'Engagement',
    description: engDescriptions[engLabel],
  }

  // Persistence: improving despite being at a low level
  const persLabel: BehaviourLabel = persistors.length >= 2 ? 'Strong'
    : persistors.length === 1 ? 'Developing'
    : subjects.filter(s => s.level <= 2).length === 0 ? 'Strong'
    : 'Emerging'
  const persDescriptions: Record<BehaviourLabel, string> = {
    'Strong': persistors.length > 0
      ? `${firstName} is showing improvement even in challenging subjects — this is a strong indicator of persistence and willingness to push through difficulty.`
      : `${firstName} maintains performance above the challenging range — no evidence of giving up when things get hard.`,
    'Developing': `${firstName} shows some persistence — there is evidence of effort even when subjects are difficult.`,
    'Emerging':   `Some difficult areas need a renewed push — persistence in the face of challenge is the key behaviour to develop.`,
    'Needs Support': `Building persistence is the priority — working through difficult subjects without giving up is a learnable habit.`,
  }
  const persistence: BehaviourDimension = {
    label:       persLabel,
    title:       'Persistence',
    description: persDescriptions[persLabel],
  }

  // Confidence: % of subjects at Level 3+
  const confPct   = highConf.length / subjects.length
  const confLabel: BehaviourLabel = confPct >= 0.6 ? 'Strong' : confPct >= 0.4 ? 'Developing' : confPct >= 0.2 ? 'Emerging' : 'Needs Support'
  const confDescriptions: Record<BehaviourLabel, string> = {
    'Strong':       `${firstName} has a strong academic confidence base — performing at proficient or exemplary level in ${highConf.length} out of ${subjects.length} subjects.`,
    'Developing':   `${firstName}'s confidence is building — ${highConf.length} subject${highConf.length !== 1 ? 's' : ''} at proficient level provides a foundation to grow from.`,
    'Emerging':     `Academic confidence is still developing — early successes in stronger subjects can anchor broader confidence growth.`,
    'Needs Support':`Building confidence across subjects is the most important goal — small, consistent wins in targeted areas will rebuild academic self-belief.`,
  }
  const confidence: BehaviourDimension = {
    label:       confLabel,
    title:       'Learning Confidence',
    description: confDescriptions[confLabel],
  }

  // Velocity: average rate of change
  const velLabel: BehaviourLabel = velAvg > 0.3 ? 'Strong'
    : velAvg > 0.05 ? 'Developing'
    : velAvg >= -0.05 ? 'Emerging'
    : 'Needs Support'
  const velDescriptions: Record<BehaviourLabel, string> = {
    'Strong':       `${firstName} is accelerating — performance is moving upward at a meaningful pace across subjects.`,
    'Developing':   `${firstName} is moving forward — modest but positive improvement velocity is visible across the subject profile.`,
    'Emerging':     `${firstName}'s learning pace is stable — while not declining, the rate of improvement could accelerate with more focused effort.`,
    'Needs Support':`Learning velocity is low or declining — a structured intervention plan will help reverse this trend.`,
  }
  const velocity: BehaviourDimension = {
    label:       velLabel,
    title:       'Learning Velocity',
    description: velDescriptions[velLabel],
  }

  // Behaviour summary
  const goodBehaviours = [consistency, engagement, persistence, confidence, velocity]
    .filter(b => b.label === 'Strong' || b.label === 'Developing')
    .map(b => b.title.toLowerCase())
  const needsBehaviours = [consistency, engagement, persistence, confidence, velocity]
    .filter(b => b.label === 'Emerging' || b.label === 'Needs Support')
    .map(b => b.title.toLowerCase())

  let behaviourSummary: string
  if (goodBehaviours.length >= 4) {
    behaviourSummary = `${firstName} demonstrates strong learning habits overall — ${goodBehaviours.slice(0, 2).join(' and ')} are particularly visible. ${needsBehaviours.length > 0 ? `The main area to develop is ${needsBehaviours[0]}.` : 'Maintaining these habits will support continued progress.'}`
  } else if (goodBehaviours.length >= 2) {
    behaviourSummary = `${firstName} shows promising learning behaviours, particularly in ${goodBehaviours.slice(0, 2).join(' and ')}. ${needsBehaviours.length > 0 ? `Developing stronger ${needsBehaviours[0]} will make the biggest difference to the overall learning trajectory.` : ''}`
  } else {
    behaviourSummary = `${firstName} is at an early stage of developing strong learning habits. Building ${needsBehaviours.slice(0, 2).join(' and ')} through consistent small actions each day will create the foundation for meaningful progress.`
  }

  return { consistency, engagement, persistence, confidence, velocity, behaviourSummary }
}

// ─── Parent Action Plan ───────────────────────────────────────────────────────

const WEEK_ACTIONS: Record<string, string> = {
  mathematics:          'Ask your child to solve 3 Mathematics problems in front of you and explain their thinking — not just the answer.',
  core_mathematics:     'Sit with your child for 15 minutes and ask them to explain one Mathematics topic from this week in their own words.',
  english:              'Have your child read one newspaper article or short story aloud with you and summarise it in 3 sentences.',
  kiswahili:            'Spend 10 minutes speaking simple Kiswahili with your child at dinner — even basic conversation builds confidence rapidly.',
  kiswahili_ksl:        'Spend 10 minutes speaking simple Kiswahili with your child at dinner — even basic conversation builds confidence rapidly.',
  integrated_science:   'Ask your child to explain one science concept from school using a household object as an example.',
  biology:              'Ask your child to teach you one Biology topic — teaching tests whether they truly understand.',
  social_studies:       'Read one news article together and ask your child what historical or civic connection they can see.',
  history:              'Ask your child to tell you a story about one historical event they studied recently.',
  history_citizenship:  'Read one news article together and discuss one civic issue it connects to.',
  geography:            'Look at a map together for 10 minutes — ask your child to point out and explain 3 geographical features.',
  business_studies:     'Ask your child to identify one business they passed this week and explain how it makes money.',
  computer_studies:     'Ask your child to show you something they built or learned on a computer this week.',
  creative_arts_sports: 'Watch your child perform or create for 10 minutes — ask them what they are proudest of.',
}

const MONTH_ACTIONS: Record<string, string> = {
  mathematics:          'Review one full set of Mathematics exercises with your child — celebrate correct answers and calmly work through mistakes together.',
  core_mathematics:     'Have your child complete one practice test and bring it to you to review. Focus on understanding the mistakes, not the score.',
  english:              'Ask your child to write a one-page letter to a family member about something they learned this term — and help them send it.',
  kiswahili:            'Watch one Kiswahili programme together or read a short Kiswahili story as a family.',
  integrated_science:   'Plan one "science day" at home — visit a natural environment or do a simple safe experiment together.',
  social_studies:       'Visit a community space or public institution together and discuss what you see through a civic or historical lens.',
  history_citizenship:  'Find a photograph or news article from a historical event and discuss what life was like at that time.',
  business_studies:     'Discuss one family financial decision together — explain why you made that choice and what alternatives existed.',
}

const TERM_ACTIONS: Record<string, string> = {
  mathematics:          'Ensure your child completes regular practice sessions every week this term — consistency matters more than duration.',
  english:              'Build a reading habit this term — even 15 minutes a day will have a measurable impact on writing and comprehension.',
  integrated_science:   'Encourage participation in any science club or activity at school this term.',
  business_studies:     'Support your child in identifying one small way to earn money or solve a problem in the community this term.',
}

function buildParentActionPlan(
  subjects: SubjectProgress[],
  firstName: string,
  grade: number,
  recommendedPathway: string,
): ParentAction[] {
  const byLevel   = [...subjects].sort((a, b) => a.level - b.level)
  const weakest   = byLevel[0]
  const secondWeak = byLevel[1]

  const weekAction: ParentAction = {
    timeframe: 'THIS WEEK',
    action: WEEK_ACTIONS[weakest?.subject ?? ''] ?? `Spend 15 minutes with your child reviewing what they studied in ${weakest?.displayName ?? 'their most challenging subject'} this week — ask them to explain it back to you.`,
    rationale: `${firstName}'s biggest growth opportunity right now is in ${weakest?.displayName ?? 'their priority subject'} — your curiosity and interest makes a measurable difference.`,
  }

  const monthAction: ParentAction = {
    timeframe: 'THIS MONTH',
    action: MONTH_ACTIONS[weakest?.subject ?? ''] ?? `Ask your child to show you their exercise books for ${weakest?.displayName ?? 'their priority subject'} this month — look at the corrections and celebrate what has improved.`,
    rationale: `Monthly check-ins create accountability and show your child that academic progress matters to the family — not just the school.`,
  }

  const termSubject = secondWeak ?? weakest
  const isJunior    = grade <= 9
  const termAction: ParentAction = {
    timeframe: 'THIS TERM',
    action: TERM_ACTIONS[termSubject?.subject ?? '']
      ?? (isJunior
          ? `This term, focus on building consistency in ${termSubject?.displayName ?? 'priority subjects'} — the goal is regular small improvements, not one big exam push.`
          : `This term, speak with your child's teacher about their progress in ${termSubject?.displayName ?? 'priority subjects'} — ask specifically what you can support at home.`),
    rationale: isJunior
      ? `Junior School performance sets the foundation for Grade 10 pathway choices — consistent effort now creates significant advantages later.`
      : `Senior School performance has a direct impact on university and career options — a supported learner at home performs noticeably better at school.`,
  }

  return [weekAction, monthAction, termAction]
}

// ─── Pathway Readiness Insights ───────────────────────────────────────────────

const PATHWAY_EXPLANATIONS: Record<string, Record<string, string>> = {
  'STEM': {
    'Strongly Ready':                 'Mathematics and Science performance is strong. The STEM pathway is well within reach — this learner is building the right foundations.',
    'Within Reach':                   'The STEM pathway is close. One or two subject improvements will confirm readiness. The potential is clearly there.',
    'Requires Improvement':           'STEM requires Mathematics and Science at Level 3. With focused effort this term, this pathway can still be secured.',
    'Significant Preparation Needed': 'STEM is an ambitious goal that will require consistent support over multiple terms. Early preparation gives the best chance of success.',
  },
  'Social Sciences': {
    'Strongly Ready':                 'Language and reasoning skills are strong. The Social Sciences pathway — leading to law, business, and education — is well supported.',
    'Within Reach':                   'Social Sciences is within reach. Strengthening English and one or two social subjects will confirm this pathway.',
    'Requires Improvement':           'Social Sciences requires strong English and social subject performance. Consistent effort this term will build toward this pathway.',
    'Significant Preparation Needed': 'Social Sciences requires language and reasoning strength — a focused improvement plan over the next few terms can open this pathway.',
  },
  'Arts & Sports Science': {
    'Strongly Ready':                 'Creative and physical aptitude is clear. The Arts & Sports Science pathway into design, media, and sports is well confirmed.',
    'Within Reach':                   'Arts & Sports Science is accessible with continued creative and physical engagement.',
    'Requires Improvement':           'Regular practice in creative and physical activities this term will strengthen readiness for this pathway.',
    'Significant Preparation Needed': 'Arts & Sports Science requires active creative or sporting engagement — starting structured participation now will open this pathway.',
  },
}

const PATHWAY_COLORS: Record<string, string> = {
  'STEM':                  '#3b82f6',
  'Social Sciences':       '#10b981',
  'Arts & Sports Science': '#f59e0b',
}

function buildPathwayReadiness(report: AcademicClinicReport): PathwayReadinessInsight[] {
  const cards = report.pathwayReadinessCards ?? []
  const pa    = report.pathwayAnalysis

  if (cards.length > 0) {
    return cards.map(c => {
      const explanation = PATHWAY_EXPLANATIONS[c.pathway]?.[c.statusLabel]
        ?? `${c.pathway} pathway readiness: ${c.statusLabel.toLowerCase()}.`
      return {
        pathway:        c.pathway,
        score:          c.score,
        readinessLabel: c.statusLabel,
        readinessColor: PATHWAY_COLORS[c.pathway] ?? '#64748b',
        explanation,
        isRecommended:  c.pathway === pa?.recommendedPathway,
      }
    })
  }

  // Senior school: derive from indicators
  if (pa?.pathwayScores) {
    return pa.pathwayScores.map(p => {
      const label = getPathwayReadinessLabel(p.score)
      return {
        pathway:        p.name,
        score:          p.score,
        readinessLabel: label,
        readinessColor: PATHWAY_COLORS[p.name] ?? '#64748b',
        explanation:    PATHWAY_EXPLANATIONS[p.name]?.[label] ?? `${p.name} pathway readiness is ${label.toLowerCase()}.`,
        isRecommended:  p.name === pa.recommendedPathway,
      }
    })
  }

  // Fallback: derive from senior readiness score
  const indicators = report.seniorReadinessIndicators
  const score      = indicators?.pathwayReadinessScore ?? 50
  const pathway    = (report.studentProfile.pathway ?? 'STEM') as PathwayKey
  const label      = getPathwayReadinessLabel(score)
  return [{
    pathway,
    score,
    readinessLabel: label,
    readinessColor: PATHWAY_COLORS[pathway] ?? '#64748b',
    explanation:    PATHWAY_EXPLANATIONS[pathway]?.[label] ?? `${pathway} pathway readiness is ${label.toLowerCase()}.`,
    isRecommended:  true,
  }]
}

// ─── Career Directions ────────────────────────────────────────────────────────

const PATHWAY_CAREERS: Record<string, Array<{ name: string; strengths: string[]; gapSubject?: string }>> = {
  'STEM': [
    { name: 'Engineering',            strengths: ['Mathematics', 'Physics', 'Integrated Science'],   gapSubject: 'Mathematics' },
    { name: 'Health Sciences',        strengths: ['Biology', 'Chemistry', 'English'],                gapSubject: 'Biology' },
    { name: 'Software Development',   strengths: ['Mathematics', 'Computer Studies', 'English'],     gapSubject: 'Mathematics' },
    { name: 'Applied Sciences',       strengths: ['Integrated Science', 'Chemistry', 'Physics'],     gapSubject: 'Chemistry' },
    { name: 'Data Science',           strengths: ['Mathematics', 'Computer Studies'],                gapSubject: 'Mathematics' },
  ],
  'Social Sciences': [
    { name: 'Law & Advocacy',         strengths: ['English', 'History & Citizenship', 'Social Studies'], gapSubject: 'English' },
    { name: 'Business & Commerce',    strengths: ['Business Studies', 'Mathematics', 'English'],         gapSubject: 'Mathematics' },
    { name: 'Education',              strengths: ['English', 'Kiswahili', 'Social Studies'],              gapSubject: 'English' },
    { name: 'Public Administration',  strengths: ['History & Citizenship', 'Social Studies', 'English'], gapSubject: 'Social Studies' },
    { name: 'Journalism & Media',     strengths: ['English', 'Kiswahili', 'Social Studies'],              gapSubject: 'English' },
  ],
  'Arts & Sports Science': [
    { name: 'Sports Science',         strengths: ['Creative Arts & Sports', 'Biology'],                   gapSubject: 'Biology' },
    { name: 'Creative Design',        strengths: ['Creative Arts & Sports', 'Mathematics'],               gapSubject: 'Creative Arts & Sports' },
    { name: 'Media & Communications', strengths: ['English', 'Creative Arts & Sports'],                   gapSubject: 'English' },
    { name: 'Physical Education',     strengths: ['Creative Arts & Sports', 'Biology'],                   gapSubject: 'Biology' },
    { name: 'Performing Arts',        strengths: ['Creative Arts & Sports', 'English'],                   gapSubject: 'Creative Arts & Sports' },
  ],
}

const WHY_IT_MATCHES: Record<string, string> = {
  'Engineering':            'Engineering rewards mathematical and scientific reasoning — the analytical thinking visible in current performance aligns well.',
  'Health Sciences':        'Health Sciences requires biological and scientific understanding — the investigative mindset developing here is exactly the right foundation.',
  'Software Development':   'Software development builds on logical thinking and Mathematics — the problem-solving approach is clearly present.',
  'Applied Sciences':       'Applied Sciences values curiosity and practical investigation — the scientific engagement visible here is a strong indicator of fit.',
  'Data Science':           'Data Science combines mathematical reasoning with analytical thinking — skills that appear to be developing in the current profile.',
  'Law & Advocacy':         'Law rewards clear argument, language skill, and social awareness — all of which are emerging strengths in this learner\'s profile.',
  'Business & Commerce':    'Business rewards analytical thinking, communication, and practical understanding of the world — all visible in current performance.',
  'Education':              'Teaching requires strong communication and a deep understanding of content — the language and social skills here align naturally.',
  'Public Administration':  'Public service rewards civic understanding, leadership, and clear communication — strengths that appear to be developing here.',
  'Journalism & Media':     'Journalism rewards strong language, critical thinking, and civic awareness — this learner\'s communication profile is a natural match.',
  'Sports Science':         'Sports Science combines physical performance with biological understanding — both visible in this learner\'s emerging profile.',
  'Creative Design':        'Design rewards spatial thinking, creativity, and attention to detail — all qualities that appear to be developing here.',
  'Media & Communications': 'Media rewards strong language, creativity, and awareness of the world — the communication skills here are a natural foundation.',
  'Physical Education':     'Physical Education values both physical competency and the ability to teach and motivate others — a visible strength here.',
  'Performing Arts':        'Performing Arts rewards creativity, discipline, and emotional intelligence — qualities that appear to be emerging strongly.',
}

function buildCareerDirections(
  report: AcademicClinicReport,
  subjects: SubjectProgress[],
  recommendedPathway: string,
): CareerDirection[] {
  const matchedSubjects = subjects.filter(s => s.level >= 3).slice(0, 2).map(s => s.displayName)
  const weakest         = [...subjects].sort((a, b) => a.level - b.level)[0]

  const fromCards: CareerDirection[] = (report.careerInsightCards ?? []).slice(0, 3).map((c, i) => ({
    rank:               (i + 1) as 1 | 2 | 3,
    name:               c.name,
    alignmentPct:       c.alignment,
    whyItMatches:       WHY_IT_MATCHES[c.name] ?? `${c.name} aligns with the academic profile developing here — current strengths provide a strong foundation.`,
    supportingStrengths: matchedSubjects.length > 0 ? matchedSubjects : ['Overall academic performance'],
    gapToImprove:       weakest ? `${weakest.displayName} at Level ${weakest.level + 1} would further strengthen this direction.` : 'Continue building across all subjects.',
  }))

  if (fromCards.length >= 3) return fromCards

  // Top up from pathway careers to ensure always 3 directions
  const pathwayCareers = PATHWAY_CAREERS[recommendedPathway] ?? PATHWAY_CAREERS['STEM']
  const strongSubjects  = subjects.filter(s => s.level >= 3).map(s => s.displayName)
  const weakestSubject  = [...subjects].sort((a, b) => a.level - b.level)[0]
  const existingNames   = new Set(fromCards.map(c => c.name))

  const topUp = pathwayCareers
    .filter(c => !existingNames.has(c.name))
    .slice(0, 3 - fromCards.length)
    .map((career, j) => {
      const i = fromCards.length + j
      const avgLevel = subjects.reduce((s, x) => s + x.level, 0) / subjects.length
      const alignment = Math.round(Math.max(40, Math.min(88, (avgLevel / 4) * 100 - (i * 4))))
      const supporting = career.strengths.filter(s => strongSubjects.includes(s)).slice(0, 2)
      return {
        rank:               (i + 1) as 1 | 2 | 3,
        name:               career.name,
        alignmentPct:       alignment,
        whyItMatches:       WHY_IT_MATCHES[career.name] ?? `${career.name} aligns with the academic strengths developing here.`,
        supportingStrengths: supporting.length > 0 ? supporting : (strongSubjects.slice(0, 2).length > 0 ? strongSubjects.slice(0, 2) : ['Overall academic performance']),
        gapToImprove:       weakestSubject
          ? `${weakestSubject.displayName} at Level ${weakestSubject.level + 1} or higher would further strengthen this direction.`
          : 'Maintain strong performance across all subjects.',
      }
    })

  if (fromCards.length > 0) return [...fromCards, ...topUp]

  return pathwayCareers.slice(0, 3).map((career, i) => {
    const avgLevel = subjects.reduce((s, x) => s + x.level, 0) / subjects.length
    const alignment = Math.round(Math.max(40, Math.min(92, (avgLevel / 4) * 100 + (i === 0 ? 10 : i === 1 ? 4 : -4))))
    const supporting = career.strengths.filter(s => strongSubjects.includes(s)).slice(0, 2)

    return {
      rank:               (i + 1) as 1 | 2 | 3,
      name:               career.name,
      alignmentPct:       alignment,
      whyItMatches:       WHY_IT_MATCHES[career.name] ?? `${career.name} aligns with the academic strengths developing here.`,
      supportingStrengths: supporting.length > 0 ? supporting : (strongSubjects.slice(0, 2).length > 0 ? strongSubjects.slice(0, 2) : ['Overall academic performance']),
      gapToImprove:       weakestSubject
        ? `${weakestSubject.displayName} at Level ${weakestSubject.level + 1} or higher would further strengthen this direction.`
        : 'Maintain strong performance across all subjects to keep this pathway accessible.',
    }
  })
}

// ─── Opportunity Insight ──────────────────────────────────────────────────────

const OPPORTUNITY_UNLOCKS: Record<string, string[]> = {
  mathematics:          ['Engineering & Technology careers', 'Data Science & Computing pathways', 'STEM university cluster points improvement', 'Architecture and applied sciences'],
  core_mathematics:     ['Engineering & Technology careers', 'Computing and data careers', 'STEM university programmes', 'Financial services pathways'],
  english:              ['Law and advocacy pathways', 'Journalism and media careers', 'All university programmes (minimum requirement)', 'Teaching and educational roles', 'Business and management'],
  kiswahili:            ['National language university requirement met', 'Broader Social Sciences pathway options', 'Civic and public service careers', 'Journalism in Kiswahili-language media'],
  kiswahili_ksl:        ['National language university requirement met', 'Broader Social Sciences pathway options', 'Civic and public service careers'],
  integrated_science:   ['Science specialisations in Senior School', 'Health sciences pathway confirmation', 'STEM pathway foundation strengthened', 'Environmental and agricultural sciences'],
  biology:              ['Medicine and health sciences', 'Nursing and pharmacy pathways', 'Veterinary science', 'Biomedical research careers'],
  chemistry:            ['Medicine and pharmacy pathways', 'Chemical engineering', 'Applied sciences careers', 'Food science and technology'],
  physics:              ['Engineering and architecture', 'Applied technology careers', 'Energy and sustainability fields', 'Computing and electronics'],
  social_studies:       ['Social Sciences pathway confirmation', 'Law and governance careers', 'Community development roles', 'Public administration pathways'],
  history_citizenship:  ['Law and political science', 'Governance and public policy', 'Journalism and research careers', 'Diplomatic and international roles'],
  history:              ['Law and political science', 'Governance and public policy', 'Journalism and research careers'],
  business_studies:     ['Business and commerce pathways', 'Entrepreneurship opportunities', 'Finance and banking careers', 'Marketing and management roles'],
  creative_arts_sports: ['Arts & Sports Science pathway confirmation', 'Creative industry careers', 'Sports science and coaching', 'Media production and design'],
  computer_studies:     ['Software development careers', 'Cybersecurity pathways', 'Digital entrepreneurship', 'Data science and analytics'],
}

const OPPORTUNITY_MESSAGES: Record<string, string> = {
  mathematics:          'If Mathematics improves by one level, the STEM pathway becomes significantly more accessible — unlocking some of Kenya\'s highest-demand careers.',
  core_mathematics:     'If Core Mathematics improves by one level, engineering, computing, and STEM university programmes all become more accessible.',
  english:              'If English improves by one level, virtually every university programme and career pathway becomes more accessible — English has the highest single-subject impact.',
  kiswahili:            'If Kiswahili improves by one level, the national language requirement is met for a wider range of university programmes.',
  integrated_science:   'If Integrated Science improves by one level, science specialisations in Senior School are confirmed — opening health sciences and STEM pathways.',
  biology:              'If Biology improves by one level, medicine, nursing, and health sciences programmes all become more accessible.',
  chemistry:            'If Chemistry improves by one level, medicine, pharmacy, and chemical engineering pathways open significantly.',
  physics:              'If Physics improves by one level, engineering, architecture, and applied sciences pathways all become more accessible.',
  social_studies:       'If Social Studies improves, Social Sciences pathway confirmation strengthens and civic career options widen.',
  business_studies:     'If Business Studies improves, commerce, entrepreneurship, and finance pathways all become more accessible.',
  computer_studies:     'If Computing improves, technology career pathways and digital economy options open up significantly.',
  creative_arts_sports: 'If Creative Arts & Sports improves, the Arts & Sports Science pathway is confirmed and creative industry careers become accessible.',
}

function buildOpportunityInsight(subjects: SubjectProgress[]): OpportunityInsight {
  const byLevel = [...subjects].sort((a, b) => a.level - b.level)
  const target  = byLevel.find(s => s.level < 4)
  if (!target) {
    return {
      subjectToImprove:       'all subjects',
      currentLevel:           4,
      ifImprovesMessage:      'This learner is already performing at an exceptional level across all subjects.',
      unlockedOpportunities:  ['Advanced university programme eligibility', 'Scholarship opportunities', 'International university options', 'Professional career pathways'],
    }
  }
  return {
    subjectToImprove:      target.displayName,
    currentLevel:          target.level,
    ifImprovesMessage:     OPPORTUNITY_MESSAGES[target.subject]
      ?? `If ${target.displayName} improves by one level, broader academic and career opportunities become accessible.`,
    unlockedOpportunities: OPPORTUNITY_UNLOCKS[target.subject]
      ?? ['Wider university options', 'Improved pathway readiness', 'Stronger career access', 'Better scholarship eligibility'],
  }
}

// ─── Main Report Builder ──────────────────────────────────────────────────────

export function buildLearnerIntelligenceReport(
  report: AcademicClinicReport
): LearnerIntelligenceReport {
  const { studentProfile: sp, subjectBreakdown: subjects, clinicalOverview: co } = report
  const firstName         = sp.name.split(' ')[0]
  const avgLevel          = subjects.reduce((s, x) => s + x.level, 0) / subjects.length
  const growthStage       = getGrowthStage(avgLevel)
  const frs               = computeFutureReadinessScore(subjects, co.trajectory)
  const frsLabel          = getFRSLabel(frs)
  const byLevel           = [...subjects].sort((a, b) => a.level - b.level)
  const byDesc            = [...subjects].sort((a, b) => b.level - a.level)
  const strongestSubject  = byDesc[0]
  const weakestSubject    = byLevel[0]
  const recommendedPathway = (report.pathwayAnalysis?.recommendedPathway ?? report.studentProfile.pathway ?? 'STEM') as string
  const pathwayDir        = buildPathwayDirection(report)

  // ── Snapshot ─────────────────────────────────────────────────────────────────
  const snapshot: LearnerSnapshot = {
    name:   sp.name,
    grade:  sp.grade,
    school: sp.school,
    term:   sp.term,
    year:   sp.year,
    level:  sp.level,
    growthStage,
    futureReadinessScore:  frs,
    futureReadinessLabel:  frsLabel,
    topStrengths:          buildStrengthCards(subjects),
    biggestGrowthArea:     buildGrowthAreaCard(subjects),
    pathwayDirection:      pathwayDir,
    emergingOpportunities: (PATHWAY_OPPORTUNITIES[recommendedPathway] ?? PATHWAY_OPPORTUNITIES['STEM']).slice(0, 4),
    learnerStory:          buildLearnerStory(
      firstName, subjects, avgLevel, co.trajectory,
      growthStage, strongestSubject, weakestSubject, recommendedPathway
    ),
  }

  // ── Learning Intelligence ─────────────────────────────────────────────────────
  const intelligence: LearningIntelligence = {
    academicStrengths:  buildAcademicStrengths(subjects),
    growthAreas:        buildGrowthAreaInsights(subjects),
    learningBehaviour:  buildBehaviourProfile(subjects, firstName),
    parentActionPlan:   buildParentActionPlan(subjects, firstName, sp.grade, recommendedPathway),
  }

  // ── Future Readiness ──────────────────────────────────────────────────────────
  const futureReadiness: FutureReadiness = {
    pathwayReadiness:   buildPathwayReadiness(report),
    careerDirections:   buildCareerDirections(report, subjects, recommendedPathway),
    opportunityInsight: buildOpportunityInsight(subjects),
  }

  return {
    reportId:     `LI-${sp.year}-${Math.random().toString(36).substring(2, 8).toUpperCase()}`,
    generatedAt:  new Date().toISOString(),
    snapshot,
    intelligence,
    futureReadiness,
  }
}
