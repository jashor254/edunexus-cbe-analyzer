// lib/career/careerIntelligenceEngine.ts
// The 13-section Career Intelligence Engine.
// Combines deterministic data from the COS pipeline with one focused AI call
// to produce the complete Career Intelligence Report — including the
// "If Learning Continues Like This..." narrative.

import type { SupabaseClient } from '@supabase/supabase-js'
import { callDeepSeek } from '@/lib/ai/deepseek'
import { buildClinicReport } from './clinicReportBuilder'
import { getAllCareersWithCOS } from './careerEngine'
import { computeCapabilityMatches, confidenceFromAssessmentCount } from './capabilityMatchEngine'
import { CAPABILITY_LABELS, extractCapabilityProfile } from './capabilityExtractor'
import { STANDARD_DISCLAIMER } from './types'
import { familiesFromMatches } from '@/lib/learnerIntelligence/careerIntelligence'
import { recomputeLearnerProjection } from '@/lib/projection/recompute'
import { projectionToScoreHistory } from '@/lib/learnerIntelligence/projectionAdapters'
import type { ConfidenceLevel } from '@/lib/learnerIntelligence/insight'
import type {
  CareerIntelligenceReport,
  HiddenStrength,
  GrowthBarrier,
  OpportunityEntry,
  StretchOpportunityEntry,
  UnlikelyOpportunityEntry,
  CIEAIRealityCheck,
  CIEFourDoors,
  EducationChain,
  CIETeacherInsight,
  LearnerChallenge,
  CapabilityDimension,
  ClinicReport,
  CapabilityProfile,
  CapabilityMatchReport,
} from './types'

// ── Education → Opportunity chains ───────────────────────────────────────────

const EDUCATION_CHAINS: Record<string, string[]> = {
  mathematics: [
    'Strengthen Mathematics',
    '↓ builds logical and sequential thinking',
    '↓ enables programming, data analysis, and financial modelling',
    '↓ opens pathways in software engineering, AI, and actuarial science',
    '↓ creates opportunities across tech and finance in East Africa',
  ],
  core_mathematics: [
    'Strengthen Mathematics',
    '↓ builds logical and sequential thinking',
    '↓ enables programming, data analysis, and financial modelling',
    '↓ opens pathways in software engineering, AI, and actuarial science',
    '↓ creates opportunities across tech and finance in East Africa',
  ],
  essential_mathematics: [
    'Build Essential Mathematics skills',
    '↓ develops practical quantitative reasoning and financial literacy',
    '↓ enables business, accounting, and operations management',
    '↓ opens pathways in entrepreneurship, banking, and social enterprise',
    '↓ creates commercial opportunities in Kenya\'s growing business sector',
  ],
  english: [
    'Build English proficiency',
    '↓ develops clear thinking and professional communication',
    '↓ enables legal writing, journalism, and business communication',
    '↓ opens pathways in law, education, media, and public service',
    '↓ creates leadership and influence in any sector',
  ],
  kiswahili: [
    'Strengthen Kiswahili',
    '↓ builds confidence in Kenya\'s national language',
    '↓ enables community-facing roles and pan-African communication',
    '↓ opens pathways in government, journalism, and social work',
    '↓ creates competitive advantages in pan-African business contexts',
  ],
  biology: [
    'Build Biology foundations',
    '↓ develops scientific inquiry and observation skills',
    '↓ enables medical, nursing, and pharmaceutical study',
    '↓ opens pathways in healthcare, research, and public health',
    '↓ positions you to address Africa\'s most urgent healthcare gaps',
  ],
  chemistry: [
    'Master Chemistry concepts',
    '↓ builds understanding of materials, reactions, and processes',
    '↓ enables pharmaceutical, industrial, and research study',
    '↓ opens pathways in medicine, chemical engineering, and food science',
    '↓ creates opportunities in Kenya\'s growing manufacturing sector',
  ],
  physics: [
    'Build Physics fundamentals',
    '↓ develops engineering reasoning and physical intuition',
    '↓ enables electrical, mechanical, and civil engineering study',
    '↓ opens pathways in infrastructure, renewable energy, and manufacturing',
    '↓ positions you for Kenya\'s expanding energy and infrastructure development',
  ],
  computer_studies: [
    'Develop computing skills',
    '↓ builds digital literacy and systematic problem-solving',
    '↓ enables software development, cybersecurity, and data science',
    '↓ opens pathways in Nairobi\'s growing tech ecosystem (Silicon Savannah)',
    '↓ creates opportunities to build solutions for African-specific problems',
  ],
  geography: [
    'Strengthen Geography',
    '↓ builds spatial thinking and environmental awareness',
    '↓ enables urban planning, surveying, and environmental management',
    '↓ opens pathways in infrastructure, conservation, and GIS technology',
    '↓ positions you for Kenya\'s climate adaptation and infrastructure sectors',
  ],
  history: [
    'Deepen historical understanding',
    '↓ builds critical analysis and contextual reasoning',
    '↓ enables law, policy analysis, and diplomatic work',
    '↓ opens pathways in public service, journalism, and academia',
    '↓ creates opportunities in Kenya\'s expanding governance and policy sector',
  ],
  social_studies: [
    'Build Social Studies understanding',
    '↓ develops civic awareness and analytical thinking',
    '↓ enables community development, social work, and public administration',
    '↓ opens pathways in NGOs, government, and social enterprise',
    '↓ positions you to create impact in Kenya\'s communities',
  ],
  business_studies: [
    'Master Business Studies',
    '↓ builds commercial thinking and financial literacy',
    '↓ enables accounting, marketing, and entrepreneurship',
    '↓ opens pathways in Kenya\'s dynamic business and startup ecosystem',
    '↓ positions you to create ventures that employ others',
  ],
  agriculture_nutrition: [
    'Build Agriculture knowledge',
    '↓ develops understanding of food systems and agribusiness',
    '↓ enables agritech, food processing, and rural development work',
    '↓ opens pathways in food security and agricultural entrepreneurship',
    '↓ positions you in one of Kenya\'s most essential economic sectors',
  ],
  creative_arts_sports: [
    'Develop Creative Arts skills',
    '↓ builds visual communication and design thinking',
    '↓ enables graphic design, film, and media production',
    '↓ opens pathways in Kenya\'s growing creative economy',
    '↓ creates opportunities in Africa\'s expanding digital and entertainment industry',
  ],
  integrated_science: [
    'Build Integrated Science foundations',
    '↓ develops scientific curiosity and experimental thinking',
    '↓ feeds directly into Biology, Chemistry, and Physics in senior school',
    '↓ opens pathways in medicine, engineering, and environmental science',
    '↓ positions you for Kenya\'s STEM careers that need real scientific thinking',
  ],
  pre_technical_studies: [
    'Develop Pre-Technical skills',
    '↓ builds hands-on problem-solving and technical reasoning',
    '↓ enables engineering, construction, and manufacturing study',
    '↓ opens pathways in Kenya\'s infrastructure and trades sectors',
    '↓ creates opportunities in technical careers that AI cannot easily automate',
  ],
  cre: [
    'Strengthen CRE and ethical reasoning',
    '↓ builds moral reasoning and community awareness',
    '↓ enables social work, counselling, and community leadership',
    '↓ opens pathways in faith institutions, NGOs, and public service',
    '↓ builds the ethical foundation that underpins leadership in any career',
  ],
}

// ── Capability dimension context ──────────────────────────────────────────────

const DIM_HIDDEN_STRENGTH_DESC: Record<CapabilityDimension, string> = {
  analytical_reasoning: 'Quietly strong at breaking complex problems into smaller, manageable steps — a skill most people only develop much later',
  communication:        'Able to express ideas clearly and adjust language for different audiences — this matters as much as technical skill in most careers',
  creative_thinking:    'Naturally approaches problems from unexpected angles — a capability that AI cannot replicate and that employers increasingly value',
  technical_aptitude:   'Comfortable with how things work and why — this curiosity is the foundation of engineering and systems thinking',
  social_intelligence:  'Reads situations and people well — this emotional intelligence is a career multiplier that accelerates everything else',
  resilience:           'Shows consistent effort even when progress is slow — perseverance is more predictive of long-term success than raw ability',
}

const DIM_CAREER_CONTEXT: Record<CapabilityDimension, string> = {
  analytical_reasoning: 'STEM, finance, and data-driven careers',
  communication:        'law, education, media, and leadership roles',
  creative_thinking:    'design, entrepreneurship, and innovation sectors',
  technical_aptitude:   'engineering, technology, and manufacturing',
  social_intelligence:  'healthcare, education, management, and community leadership',
  resilience:           'any demanding career that rewards persistence over talent',
}

const DIM_BARRIER: Record<CapabilityDimension, { barrier: string; opportunity: string }> = {
  analytical_reasoning: {
    barrier:     'Logical and mathematical reasoning needs development — this currently limits options in STEM careers and reduces confidence in quantitative subjects',
    opportunity: 'Strengthening analytical reasoning opens the widest range of career doors — from engineering to business analysis to medical research',
  },
  communication: {
    barrier:     'Written and verbal communication skills need growth — this affects performance across all subjects and limits leadership opportunities',
    opportunity: 'Improving communication unlocks careers in law, education, media, and public service — and makes every other skill more visible',
  },
  creative_thinking: {
    barrier:     'Creative problem-solving and original thinking are underdeveloped — this limits performance in design-led and innovation-focused careers',
    opportunity: 'Building creative confidence opens pathways in design, entrepreneurship, and the growing Kenyan creative economy',
  },
  technical_aptitude: {
    barrier:     'Comfort with technical subjects (physics, pre-technical, computing) is limited — this currently restricts engineering and technology options',
    opportunity: 'Developing technical aptitude opens Kenya\'s fastest-growing career sectors — technology, manufacturing, and infrastructure',
  },
  social_intelligence: {
    barrier:     'Collaborative and interpersonal skills are at an early stage — this currently limits leadership roles and team-based careers',
    opportunity: 'Growing social intelligence accelerates advancement in any career — leadership, management, and community impact all depend on it',
  },
  resilience: {
    barrier:     'Consistency under pressure and persistence through difficulty are still developing — this affects performance when subjects become challenging',
    opportunity: 'Building resilience is the most valuable long-term investment — every other skill compounds when a learner can push through difficulty',
  },
}

// ── Section builders ──────────────────────────────────────────────────────────

function buildHiddenStrengths(
  profile: CapabilityProfile | null,
  clinicReport: ClinicReport
): HiddenStrength[] {
  const strengths: HiddenStrength[] = []
  const DIMS: CapabilityDimension[] = [
    'analytical_reasoning', 'communication', 'creative_thinking',
    'technical_aptitude', 'social_intelligence', 'resilience',
  ]

  if (profile) {
    const sorted = [...DIMS].sort((a, b) => profile[b].raw_score - profile[a].raw_score)
    for (const dim of sorted.slice(0, 3)) {
      if (profile[dim].raw_score < 0.35) break
      const evidence = profile[dim].evidence[0] ?? `${CAPABILITY_LABELS[dim] ?? dim} capability`
      const trend    = profile[dim].trend
      strengths.push({
        strength:         DIM_HIDDEN_STRENGTH_DESC[dim],
        evidence:         (trend === 'accelerating' || trend === 'growing')
          ? `${evidence} — and this is actively improving`
          : evidence,
        career_relevance: `Directly relevant for opportunities in ${DIM_CAREER_CONTEXT[dim]}`,
      })
    }
  }

  if (strengths.length < 2) {
    for (const s of clinicReport.top_subjects.slice(0, 3)) {
      if (strengths.length >= 3) break
      strengths.push({
        strength:         `Genuine strength in ${s.display_name} — performing above expectations`,
        evidence:         `CBC Level ${Math.round(s.score)} out of 4 — a consistent signal, not a one-off result`,
        career_relevance: `${s.display_name} proficiency opens direct pathways into related careers and strengthens university applications`,
      })
    }
  }

  return strengths.slice(0, 3)
}

function buildGrowthBarriers(
  profile: CapabilityProfile | null,
  clinicReport: ClinicReport
): GrowthBarrier[] {
  const barriers: GrowthBarrier[] = []
  const DIMS: CapabilityDimension[] = [
    'analytical_reasoning', 'communication', 'creative_thinking',
    'technical_aptitude', 'social_intelligence', 'resilience',
  ]

  if (profile) {
    const sorted = [...DIMS].sort((a, b) => profile[a].raw_score - profile[b].raw_score)
    for (const dim of sorted.slice(0, 2)) {
      if (profile[dim].raw_score > 0.60) break
      const ctx = DIM_BARRIER[dim]
      barriers.push({
        barrier:                 ctx.barrier,
        explanation:             `Currently at ${profile[dim].level} level — affects ${(CAPABILITY_LABELS[dim] ?? dim).toLowerCase()} across multiple subjects`,
        opportunity_if_improved: ctx.opportunity,
      })
    }
  }

  for (const s of clinicReport.weak_subjects.slice(0, 2)) {
    if (barriers.length >= 3) break
    barriers.push({
      barrier:                 `${s.display_name} is currently a limiting subject`,
      explanation:             `CBC Level ${Math.round(s.score)} — below the level most career pathways need for this subject`,
      opportunity_if_improved: `Reaching Level 3 in ${s.display_name} opens new pathways and strengthens the overall academic profile significantly`,
    })
  }

  return barriers.slice(0, 3)
}

function buildOpportunityLandscape(
  matchReport: CapabilityMatchReport | null,
  clinicReport: ClinicReport,
  mode: 'exploration' | 'planning',
): {
  strong_fit_now:        OpportunityEntry[]
  fit_after_improvement: StretchOpportunityEntry[]
  unlikely_today:        UnlikelyOpportunityEntry[]
} {
  const strong_fit_now:        OpportunityEntry[]         = []
  const fit_after_improvement: StretchOpportunityEntry[]  = []
  const unlikely_today:        UnlikelyOpportunityEntry[] = []

  // Career Principle: Junior (exploration mode) never sees a ranked
  // single-career prediction, a "stretch goal," or an "unlikely" verdict —
  // those are all judgments about who a 12-14 year old will become. Same
  // matcher, same data (computeCapabilityMatches, familiesFromMatches — no
  // parallel engine), just regrouped into broad categories with no ranking
  // implication and no downside-facing "unlikely" tier at all.
  if (matchReport && mode === 'exploration') {
    const families = familiesFromMatches([...matchReport.primary, ...matchReport.stretch])
    for (const f of families.slice(0, 3)) {
      strong_fit_now.push({
        career: f.categoryLabel,
        reason: `${f.insight.observation} Worth exploring through: ${f.exampleCareerTitles.join(', ')}.`,
      })
    }
    // fit_after_improvement / unlikely_today intentionally left empty —
    // both require judging a specific career as a stretch or out of reach,
    // which this stage of guidance must not do.
    return { strong_fit_now, fit_after_improvement, unlikely_today }
  }

  if (matchReport) {
    for (const m of matchReport.primary.slice(0, 3)) {
      strong_fit_now.push({ career: m.career_title, reason: m.narrative })
    }
    for (const m of matchReport.stretch.slice(0, 3)) {
      const topGap = m.gaps[0]
      fit_after_improvement.push({
        career:          m.career_title,
        what_to_improve: topGap
          ? `Improving ${topGap.dimension.replace(/_/g, ' ')} from ${topGap.student_level} toward capable level`
          : 'Building capability across the required dimensions with consistent effort',
      })
    }
    for (const m of matchReport.alternative.slice(0, 2)) {
      const topGap = m.gaps[0]
      unlikely_today.push({
        career:                    m.career_title,
        what_would_make_realistic: topGap
          ? `${topGap.dimension.replace(/_/g, ' ')} would need to move from ${topGap.student_level} to capable — achievable over 2–3 focused terms`
          : 'Sustained improvement across multiple capability dimensions over time',
      })
    }
  }

  if (strong_fit_now.length === 0 && clinicReport.top_career) {
    strong_fit_now.push({
      career: clinicReport.top_career.career.title,
      reason: clinicReport.top_career.match_reasoning,
    })
  }

  return { strong_fit_now, fit_after_improvement, unlikely_today }
}

function buildEducationChains(clinicReport: ClinicReport): EducationChain[] {
  const chains: EducationChain[] = []
  const seen = new Set<string>()
  const subjects = [
    ...clinicReport.top_subjects.slice(0, 2),
    ...clinicReport.weak_subjects.slice(0, 1),
  ]
  for (const s of subjects) {
    if (seen.has(s.subject)) continue
    seen.add(s.subject)
    const chain = EDUCATION_CHAINS[s.subject]
    if (chain) chains.push({ subject: s.display_name, chain })
  }
  return chains.slice(0, 4)
}

function buildAIRealityCheck(clinicReport: ClinicReport): CIEAIRealityCheck | null {
  if (!clinicReport.top_career_detail) return null
  const ai = clinicReport.top_career_detail.ai_impact
  return {
    career_title:                  clinicReport.top_career_detail.title,
    tasks_ai_will_automate:        ai.replacing,
    tasks_humans_still_do:         ai.human_advantage,
    skills_becoming_valuable:      (clinicReport.top_career_detail.future_skills ?? []).slice(0, 3),
    skills_becoming_less_valuable: ai.replacing.slice(0, 2),
    how_to_prepare:                ai.honest_summary,
  }
}

function buildFourDoors(clinicReport: ClinicReport): CIEFourDoors | null {
  if (!clinicReport.top_career_detail) return null
  const doors = clinicReport.top_career_detail.doors
  const emp  = doors.find(d => d.type === 'employment')
  const self = doors.find(d => d.type === 'self_employment')
  const biz  = doors.find(d => d.type === 'entrepreneurship')
  const ai   = doors.find(d => d.type === 'ai_era')
  return {
    employment:        emp?.description  ?? 'Work for an established organisation with a structured salary and career progression',
    self_employment:   self?.description ?? 'Offer services directly to clients — consulting, freelancing, or professional practice',
    business_creation: biz?.description  ?? 'Build a business that employs others and creates value in the Kenyan economy',
    ai_augmented:      ai?.description   ?? 'Use AI tools to multiply your output — doing the work of a larger team while staying small and agile',
  }
}

function buildParentGuidance(clinicReport: ClinicReport): {
  parent_this_week:       string[]
  parent_this_month:      string[]
  parent_long_term_habit: string
} {
  if (clinicReport.parentPlan) {
    const pp = clinicReport.parentPlan
    return {
      parent_this_week:       pp.thisWeek.slice(0, 3).map(a => a.action),
      parent_this_month:      pp.thisMonth.slice(0, 3).map(a => a.action),
      parent_long_term_habit: pp.thisTerm[pp.thisTerm.length - 1]?.action
        ?? 'Maintain open weekly conversations about learning — ask what was interesting, not just what the grade was',
    }
  }
  const actions = clinicReport.parent_actions
  return {
    parent_this_week:  actions.slice(0, 2).map(a => a.action),
    parent_this_month: [
      ...actions.slice(2, 3).map(a => a.action),
      'Use the EduNexus Learning Compass 3 times this week — the system already knows exactly where to start',
    ],
    parent_long_term_habit:
      'Build a weekly learning conversation habit — 15 minutes every Sunday asking "What surprised you this week at school?" That question creates a thinker, not just a student.',
  }
}

function buildLearningHabitsNote(
  profile: CapabilityProfile,
  clinicReport: ClinicReport
): string {
  const resilienceTrend = profile.resilience.trend
  const count = profile.assessment_count
  let note = `Based on ${count} assessment${count === 1 ? '' : 's'}.`
  if (resilienceTrend === 'accelerating') {
    note += ' Learning momentum is accelerating — this learner is pushing through challenges and improving consistently. That trajectory is the most valuable signal in this report.'
  } else if (resilienceTrend === 'growing') {
    note += ' Learning consistency is improving — effort is building into measurable momentum. The direction matters more than the current level.'
  } else if (resilienceTrend === 'declining') {
    note += ' Consistency has dipped recently — this could signal the material has become more challenging. Structured support now prevents the gap from widening.'
  } else {
    note += ' Learning consistency is stable. Engagement is present but there is room to build momentum — small increases in frequency compound quickly at this stage.'
  }
  return note
}

// ── Narrative section generation (single DeepSeek call) ──────────────────────

type NarrativeSections = {
  domain_expertise:      string
  career_flexibility:    string
  teacher_insight:       CIETeacherInsight
  learner_challenge:     LearnerChallenge
  intelligence_summary:  string
  if_learning_continues: string
}

async function generateNarrativeSections(
  studentName:    string,
  grade:          number,
  age:            number,
  pathway:        string | null,
  dominantCluster: string[],
  emergingCluster: string[],
  topSubjects:    string[],
  weakSubjects:   string[],
  readinessScore: number,
  readinessLabel: string,
  topMatchTitles: string[],
  dreamCareer:    string | null,
  assessmentCount: number,
  confidenceLevel: ConfidenceLevel,
  mode:           'exploration' | 'planning',
): Promise<NarrativeSections> {
  const firstName = studentName.split(' ')[0]
  const pathwayStr = pathway ?? 'General'
  const modeNote = mode === 'exploration'
    ? `${firstName} is in Junior School — this stage is about exploring broad fields, not predicting a career. topMatchTitles below are FIELD CATEGORIES, not specific job titles — never write as if a specific career has been identified or matched. Use language like "worth exploring," "an area to try," never "you should become" or "you are suited for."`
    : `${firstName} is in Senior School — specific career guidance proportional to the evidence is appropriate, but every claim must still be hedged by the evidence note below and framed as a direction, not a destiny.`
  const evidenceNote = confidenceLevel === 'Low'
    ? `Evidence is THIN — only ${assessmentCount} assessment${assessmentCount === 1 ? '' : 's'} so far. Hedge every claim accordingly ("early signal", "based on what we've seen so far") and do not state anything as a settled conclusion.`
    : confidenceLevel === 'Medium'
      ? `Evidence is MODERATE — ${assessmentCount} assessments so far. Offer tentative, not absolute, guidance.`
      : `Evidence is STRONG — ${assessmentCount} assessments so far. Stronger claims are warranted, but still ground every one in the data below.`

  const prompt = `You are the EduNexus Career Intelligence Engine — a Kenyan education AI that helps learners, parents, and teachers understand how today's education connects to tomorrow's opportunities.

You are NOT recommending jobs. You are helping people understand trajectories.

Your writing style: natural, evidence-based, honest. Not corporate language. Not exaggerated praise. Not fear. Use Kenyan examples where relevant.

GROUNDING RULES — every sentence you write must obey these:
- Only describe capabilities, strengths, or patterns that are directly supported by the STUDENT PROFILE data below. Do not invent traits, talents, or abilities the data does not show.
- Never claim to reveal something "hidden," "undiscovered," or a "natural genius" / "innate talent" — describe strengths as what the evidence shows, in evidence-aware language (e.g. "the data suggests," "based on current performance"), not as secret discoveries.
- ${evidenceNote}
- ${modeNote}
- If a section of the profile below says "not yet assessed", say so plainly rather than filling the gap with a confident-sounding guess.

STUDENT PROFILE:
- Name: ${studentName} (use first name "${firstName}" in writing)
- Grade: ${grade} | Age: ${age} years
- CBC Pathway: ${pathwayStr}
- Dominant capabilities: ${dominantCluster.length > 0 ? dominantCluster.join(', ') : 'not yet assessed'}
- Emerging capabilities: ${emergingCluster.length > 0 ? emergingCluster.join(', ') : 'still developing'}
- Strong subjects: ${topSubjects.join(', ') || 'not yet assessed'}
- Subjects needing work: ${weakSubjects.join(', ') || 'not yet assessed'}
- Overall career readiness: ${readinessScore}/100 (${readinessLabel})
- Top career matches: ${topMatchTitles.join(', ') || 'not yet matched'}
- Dream career: ${dreamCareer ?? 'not stated'}
- Evidence base: ${assessmentCount} assessment${assessmentCount === 1 ? '' : 's'} (confidence: ${confidenceLevel})

Generate a JSON object with EXACTLY these keys:

{
  "domain_expertise": "3–4 sentences. Explain WHY becoming deeply skilled matters more than knowing a little about many things — especially in the AI era. Make this specific to ${firstName}'s ${pathwayStr} pathway. Teach the idea naturally — not as a lecture. AI makes average work easier to produce; therefore humans who go deep create more value.",

  "career_flexibility": "3–4 sentences. Show how ${firstName}'s current strengths could grow in multiple directions over time. Give 2 concrete Kenyan examples: a learner interested in X might later build Y. Avoid fixed identities. Skills transfer. Help the reader see the trajectory, not a single destination.",

  "teacher_insight": {
    "subjects_requiring_intervention": ["2–3 specific subjects based on weak_subjects and capability gaps"],
    "hidden_strengths": ["2–3 strengths grounded strictly in the dominant/emerging capabilities and strong subjects listed above, phrased as evidence-based observations a teacher can verify against marks — not as claims about hidden or innate ability. If the profile above has fewer than 2 dominant/emerging capabilities to draw on, say fewer things rather than inventing more."],
    "suggested_classroom_opportunities": ["2–3 specific classroom activities, projects, or roles that would bring out ${firstName}'s strengths"],
    "suggested_responsibilities": ["2–3 leadership or responsibility roles that would build confidence and visible contribution"],
    "how_to_nurture_confidence": "One specific, actionable approach tailored to ${firstName}'s profile — not generic advice"
  },

  "learner_challenge": {
    "challenge": "One specific, achievable challenge that connects learning to real life — not a school task, but something experiential",
    "why": "2 sentences on why this challenge matters for ${firstName}'s future — honest, not motivational fluff",
    "how_to_do_it": "2–3 concrete steps they can take this week"
  },

  "intelligence_summary": "4–5 sentences. Not motivational. Evidence-based. What kind of person is ${firstName} becoming based on the data above? How does that connect to what's available in Kenya and beyond? What is the honest trajectory if current patterns continue?",

  "if_learning_continues": "2–3 paragraphs. Write as a possible story, not a prediction. Start with 'If ${firstName} continues...'. Describe what becomes available in the next 3–5 years if current learning habits continue AND if specific gaps are addressed. Be honest — acknowledge what would need to change. End with what kind of person ${firstName} could be becoming — not just what job they might get. This is the paragraph the learner will remember years later."
}

Return ONLY valid JSON. No markdown. No explanation. Just JSON.`

  const raw = await callDeepSeek(
    prompt,
    'You are a Kenyan education AI. Return ONLY valid JSON. No markdown, no explanation, no extra text.',
    { maxTokens: 2500, temperature: 0.75 }
  )

  try {
    const cleaned = raw.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim()
    return JSON.parse(cleaned) as NarrativeSections
  } catch {
    throw new Error('Career Intelligence Engine: AI returned invalid JSON. Please retry.')
  }
}

// ── Main export ───────────────────────────────────────────────────────────────

export async function buildCareerIntelligenceReport(
  studentId: string,
  db: SupabaseClient
): Promise<CareerIntelligenceReport> {

  // 1. Clinic report — the deterministic data backbone
  const clinicReport = await buildClinicReport(studentId, db)

  // Career Principle: Junior (Grade 7-9) is exploring, never predicted —
  // gates the opportunity landscape and the AI narrative context below.
  const mode: 'exploration' | 'planning' =
    clinicReport.grade >= 7 && clinicReport.grade <= 9 ? 'exploration' : 'planning'

  // 2. Capability profile — sourced live from Projection, the same
  // canonical path Blueprint/Career Intelligence/Parent Career
  // Intelligence/Career Explorer all use (lib/learnerIntelligence/
  // projectionAdapters.ts), instead of the separately-stored
  // `students.capability_profile` snapshot this report previously read —
  // so a Career Intelligence Report never disagrees with what every other
  // surface concludes from the same evidence. May be null for a student
  // with no evidence yet.
  const profile = await recomputeLearnerProjection(studentId)
    .then(projection => {
      const scoreHistory = projectionToScoreHistory(projection)
      return scoreHistory.length > 0 ? extractCapabilityProfile(scoreHistory) : null
    })
    .catch(() => null)

  // 3. Capability match report — requires COS Phase 1 career data
  let matchReport: CapabilityMatchReport | null = null
  if (profile) {
    const careers = await getAllCareersWithCOS()
    if (careers.length > 0) {
      matchReport = computeCapabilityMatches(studentId, profile, careers)
    }
  }

  // 4. Build all deterministic sections
  const hiddenStrengths = buildHiddenStrengths(profile, clinicReport)
  const growthBarriers  = buildGrowthBarriers(profile, clinicReport)
  const landscape       = buildOpportunityLandscape(matchReport, clinicReport, mode)
  const educationChains = buildEducationChains(clinicReport)
  const aiRealityCheck  = buildAIRealityCheck(clinicReport)
  const fourDoors       = buildFourDoors(clinicReport)
  const parentGuidance  = buildParentGuidance(clinicReport)

  const readinessScore = clinicReport.readinessScore
    ?? Math.round(((clinicReport.overall_level - 1) / 3) * 100)
  const readinessLabel = clinicReport.pathwayReadinessLabel
    ?? (readinessScore >= 67 ? 'Strong' : readinessScore >= 44 ? 'On Track' : 'Developing')

  const currentStrengths: string[] = [
    ...clinicReport.top_subjects.slice(0, 2).map(
      s => `${s.display_name} (CBC Level ${Math.round(s.score)})`
    ),
    ...(profile?.dominant_cluster ?? []).slice(0, 2).map(
      d => `${CAPABILITY_LABELS[d] ?? d} capability`
    ),
  ]

  const currentChallenges: string[] = [
    ...clinicReport.weak_subjects.slice(0, 2).map(
      s => `${s.display_name} needs focused attention`
    ),
    ...(profile ? profile.emerging_cluster.slice(0, 1).map(
      d => `${CAPABILITY_LABELS[d] ?? d} capability is still developing`
    ) : []),
  ]

  const learningHabitsNote = profile
    ? buildLearningHabitsNote(profile, clinicReport)
    : `Based on ${clinicReport.section === 'senior' ? 'senior pathway' : 'junior pathway'} assessment data. More assessments will reveal learning patterns and trends over time.`

  // 5. Context for AI call — Junior gets category-level labels (already
  // built into landscape.strong_fit_now for exploration mode), never
  // specific ranked career titles, matching the Career Principle.
  const topMatchTitles = mode === 'exploration'
    ? landscape.strong_fit_now.map(e => e.career).slice(0, 3)
    : [
        clinicReport.top_career?.career.title,
        ...(matchReport?.primary.slice(0, 2).map(m => m.career_title) ?? []),
      ].filter((t): t is string => typeof t === 'string').slice(0, 3)

  const assessmentCount = profile?.assessment_count ?? 0
  const confidenceLevel = confidenceFromAssessmentCount(assessmentCount)

  const narratives = await generateNarrativeSections(
    clinicReport.student_name,
    clinicReport.grade,
    clinicReport.age,
    clinicReport.recommended_pathway,
    profile?.dominant_cluster ?? [],
    profile?.emerging_cluster ?? [],
    clinicReport.top_subjects.map(s => s.display_name),
    clinicReport.weak_subjects.map(s => s.display_name),
    readinessScore,
    readinessLabel,
    topMatchTitles,
    clinicReport.dream_career,
    assessmentCount,
    confidenceLevel,
    mode,
  )

  return {
    student_id:   studentId,
    student_name: clinicReport.student_name,
    grade:        clinicReport.grade,
    age:          clinicReport.age,
    pathway:      clinicReport.recommended_pathway,
    dream_career: clinicReport.dream_career,
    mode,
    generated_at: new Date().toISOString(),

    readiness_score:      readinessScore,
    readiness_label:      readinessLabel,
    readiness_summary:    clinicReport.academicDiagnosis ?? clinicReport.summary_sentence,
    current_strengths:    currentStrengths,
    current_challenges:   currentChallenges,
    learning_habits_note: learningHabitsNote,

    hidden_strengths: hiddenStrengths,
    growth_barriers:  growthBarriers,

    strong_fit_now:        landscape.strong_fit_now,
    fit_after_improvement: landscape.fit_after_improvement,
    unlikely_today:        landscape.unlikely_today,

    ai_reality_check: aiRealityCheck,
    four_doors:       fourDoors,
    education_chains: educationChains,

    domain_expertise:  narratives.domain_expertise,
    career_flexibility: narratives.career_flexibility,

    parent_this_week:       parentGuidance.parent_this_week,
    parent_this_month:      parentGuidance.parent_this_month,
    parent_long_term_habit: parentGuidance.parent_long_term_habit,

    teacher_insight:       narratives.teacher_insight,
    learner_challenge:     narratives.learner_challenge,
    intelligence_summary:  narratives.intelligence_summary,
    if_learning_continues: narratives.if_learning_continues,

    disclaimer: STANDARD_DISCLAIMER,
  }
}
