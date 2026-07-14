// lib/career/parentIntelligence.ts
// Phase 6: Parent Intelligence — translate student capability profile into parent-friendly insights.
import type {
  CapabilityProfile, CapabilityMatchReport,
  ParentIntelligenceReport, CapabilityDimension,
} from './types'
import { COS_DISCLAIMER } from './types'
import { CAPABILITY_LABELS, LEVEL_DESCRIPTIONS } from './capabilityExtractor'
import { familiesFromMatches } from '@/lib/learnerIntelligence/careerIntelligence'

const DIMS: CapabilityDimension[] = [
  'analytical_reasoning', 'communication', 'creative_thinking',
  'technical_aptitude', 'social_intelligence', 'resilience',
]

const STARTERS: Record<CapabilityDimension, [string, string]> = {
  analytical_reasoning: [
    'What problem did you tackle this week that surprised you?',
    'How do you figure out where to start when a maths question looks impossible?',
  ],
  communication: [
    'Tell me about something you explained to a friend recently — how did you make sure they understood?',
    'What\'s something you find hard to put into words? Why?',
  ],
  creative_thinking: [
    'If you could change one rule at your school, what would it be and why?',
    'What\'s a wild idea you\'ve had recently that might actually work?',
  ],
  technical_aptitude: [
    'What tool or technology would you love to learn how to build?',
    'If you had to solve a problem in our neighbourhood using tech, what would you build?',
  ],
  social_intelligence: [
    'Who do you go to when you need advice? What makes them good at listening?',
    'Tell me about a time you helped a classmate — how did it feel afterward?',
  ],
  resilience: [
    'What\'s the hardest thing you pushed through this term? How did you get yourself to keep going?',
    'When you get a bad grade, what\'s your first reaction — and then what do you actually do?',
  ],
}

const SUPPORT_BY_DIM: Record<CapabilityDimension, string> = {
  analytical_reasoning: 'Give them logic puzzles, coding challenges, or chess — anything that rewards structured thinking over speed',
  communication:        'Ask them to summarise their school day in exactly 3 sentences each evening — forces clarity',
  creative_thinking:    'Let them redesign something at home (a room layout, a weekly schedule, a recipe) — low-stakes creativity builds the muscle',
  technical_aptitude:   'Get them access to free tools: Scratch, Canva, or an Arduino kit — hands-on builds confidence fast',
  social_intelligence:  'Encourage one community involvement activity per term — clubs, volunteering, group projects all count',
  resilience:           'When they fail, ask "what did you learn?" before "what grade did you get?" — this reframe changes everything',
}

export function buildParentIntelligence(
  profile: CapabilityProfile,
  matchReport: CapabilityMatchReport,
  studentId: string,
  studentName: string,
  // Career Principle: Junior (Grade 7-9) is exploring, never predicted — so
  // Junior parents get career_families (broad, no ranking/percentage)
  // instead of recommended_careers, even though the same matchReport (same
  // matcher, same data) is used to derive both.
  mode: 'exploration' | 'planning' = 'planning'
): ParentIntelligenceReport {
  const ranked = DIMS
    .map(d => ({ dim: d, score: profile[d].raw_score, level: profile[d].level }))
    .sort((a, b) => b.score - a.score)

  const topDim = ranked[0].dim
  const gapDim = ranked[ranked.length - 1].dim

  const topStrengths = ranked.slice(0, 2).map(r => {
    const label = CAPABILITY_LABELS[r.dim]
    const desc  = LEVEL_DESCRIPTIONS[r.dim]?.[r.level] ?? r.level
    return `${label} (${r.level}): ${desc}`
  })

  const growthAreas = ranked.slice(-2).map(r =>
    `${CAPABILITY_LABELS[r.dim]} — currently ${r.level}, grows quickly with regular practice`
  )

  const recommendedCareers = mode === 'planning'
    ? [...matchReport.primary.slice(0, 2), ...matchReport.stretch.slice(0, 1)]
    : []
  const careerFamilies = mode === 'exploration'
    ? familiesFromMatches([...matchReport.primary, ...matchReport.stretch])
    : undefined

  const conversationStarters = [
    STARTERS[topDim][0],
    STARTERS[gapDim][0],
    'What career have you been thinking about lately? What drew you to it?',
    'If you could shadow any professional for one day, who would you pick?',
  ]

  const supportActions = [
    `Build on their strength — ${SUPPORT_BY_DIM[topDim]}`,
    `Grow their gap area — ${SUPPORT_BY_DIM[gapDim]}`,
    'Review assessment scores together once a term — not to judge, but to plan next steps',
    'Ask their teachers which subjects they engage with most, not just which they score highest in',
  ]

  const weeklyHabits = buildWeeklyHabits(profile)
  const redFlags     = buildRedFlags(profile, matchReport, mode)

  const count          = profile.assessment_count
  const topLabel       = CAPABILITY_LABELS[topDim]
  const topLevel       = profile[topDim].level
  const gapLabel       = CAPABILITY_LABELS[gapDim]

  const profileSummary =
    `Based on ${count} assessment${count === 1 ? '' : 's'}, ${studentName} shows ${topLevel} ` +
    `${topLabel} — a real strength for careers that need deep thinking and problem-solving. ` +
    `The area with most room to grow is ${gapLabel}. ` +
    `This is completely normal at this stage and very improvable with the right activities.`

  return {
    student_id:            studentId,
    student_name:          studentName,
    profile_summary:       profileSummary,
    top_strengths:         topStrengths,
    growth_areas:          growthAreas,
    recommended_careers:   recommendedCareers,
    career_families:       careerFamilies,
    mode,
    conversation_starters: conversationStarters,
    support_actions:       supportActions,
    weekly_habits:         weeklyHabits,
    red_flags:             redFlags,
    generated_at:          new Date().toISOString(),
    disclaimer:            COS_DISCLAIMER,
  }
}

function buildWeeklyHabits(profile: CapabilityProfile): string[] {
  const habits = [
    '15 minutes of free reading on any topic they choose — builds curiosity and vocabulary',
    'One "teach me something" conversation per week — they explain a school topic to you',
  ]

  if (profile.resilience.level === 'emerging' || profile.resilience.level === 'developing') {
    habits.push('Weekly check-in: "What was hard this week? What did you do about it?"')
  }

  if (profile.social_intelligence.raw_score < 0.5) {
    habits.push('Encourage one peer collaboration per week — group study, joint project, or team sport')
  }

  habits.push('Celebrate effort over outcomes — "You stayed with that problem" lands better than "You\'re so smart"')

  return habits
}

function buildRedFlags(
  profile: CapabilityProfile,
  report: CapabilityMatchReport,
  mode: 'exploration' | 'planning',
): string[] {
  const flags: string[] = []

  if (profile.assessment_count < 2) {
    flags.push(
      'Only 1 assessment on record — the profile becomes much more accurate with more data. ' +
      'Encourage regular assessments this term.'
    )
  }

  if (profile.resilience.level === 'emerging') {
    flags.push('Resilience is at the earliest stage — watch for signs of giving up quickly when work gets challenging.')
  }

  const allMatches = [...report.primary, ...report.stretch]
  if (allMatches.length === 0) {
    flags.push(
      mode === 'planning'
        ? 'No strong career matches found yet — this almost always means the profile needs more assessment data, not that options are limited.'
        : 'No exploration areas found yet — this almost always means the profile needs more assessment data, not that possibilities are limited.'
    )
  }

  const hasSigGaps = allMatches.some(m => m.gaps.some(g => g.gap_severity === 'significant'))
  if (hasSigGaps) {
    flags.push(
      mode === 'planning'
        ? 'Some career matches have significant capability gaps. Worth discussing which gaps are bridgeable with focused effort versus which suggest exploring a different direction.'
        : 'Some exploration areas have significant capability gaps at this stage. Perfectly normal this early — worth revisiting as more evidence comes in.'
    )
  }

  return flags
}
