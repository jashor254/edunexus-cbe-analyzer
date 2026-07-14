export type AcademyModule = {
  id: string
  title: string
  slug: string
  phase: number
  order: number
  description: string | null
  estimated_mins: number | null
  color: string | null
  published: boolean
  created_at: string
}

export type AcademyLesson = {
  id: string
  module_id: string
  title: string
  order: number
  content: string
  practice_prompt: string | null
  practice_link: string | null
  created_at: string
}

export type AcademyProgress = {
  id: string
  teacher_id: string
  lesson_id: string
  completed_at: string
}

export type LessonStub = {
  id: string
  module_id: string
  title: string
  order: number
  created_at: string
}

export type ModuleWithProgress = AcademyModule & {
  lessons: LessonStub[]
  completedCount: number
}

export type LessonWithCompletion = AcademyLesson & {
  completed: boolean
  completed_at: string | null
}

export type ModuleWithLessons = AcademyModule & {
  lessons: LessonWithCompletion[]
  completedCount: number
}

export type AcademyStats = {
  totalLessons: number
  completedLessons: number
  allComplete: boolean
}

export type PhaseStats = {
  phase: number
  totalLessons: number
  completedLessons: number
  pct: number
  allComplete: boolean
  earlyAccess: boolean  // >= 50% of previous phase done
  locked: boolean       // < 50% of previous phase done
}

export type PhaseMeta = {
  phase: number
  title: string
  badge: string
  description: string
  color: string
}

export const PHASE_META: PhaseMeta[] = [
  {
    phase: 1,
    title: 'AI Foundations',
    badge: 'AI Literate',
    description: 'Understand what AI is, try it safely, and stop being afraid of it.',
    color: '#14b8a6',
  },
  {
    phase: 2,
    title: 'The Classroom Toolkit',
    badge: 'AI-Productive Teacher',
    description: 'Use EduNexus and free AI tools to handle your real planning workload.',
    color: '#f97316',
  },
  {
    phase: 3,
    title: 'The AI-Intelligent Educator',
    badge: 'AI-Intelligent Educator',
    description: 'Differentiate, read your learners, teach AI literacy, and research with confidence.',
    color: '#8b5cf6',
  },
  {
    phase: 4,
    title: 'The AI Pioneer',
    badge: 'AI Pioneer',
    description: 'Lead AI adoption in your school, train colleagues, and build your teaching portfolio.',
    color: '#1d4ed8',
  },
  {
    phase: 5,
    title: 'The AI Builder',
    badge: 'AI Builder',
    description: 'Build your own prompt libraries, custom workflows, and contribute to Kenya\'s AI education future.',
    color: '#b45309',
  },
]

export type ProgressUpdateResponse = {
  success: boolean
  message: string
  updatedStats?: AcademyStats
}

// ── Reflections ───────────────────────────────────────────────────────────────

export type AcademyReflection = {
  id: string
  teacher_id: string
  lesson_id: string
  module_id: string
  tried: string
  worked: string
  failed: string
  surprised: string
  next_action: string
  ai_feedback: string | null
  quality_score: number | null
  is_fallback: boolean
  word_count: number
  created_at: string
  updated_at: string
}

export type ReflectionInput = {
  lesson_id: string
  module_id: string
  tried: string
  worked: string
  failed: string
  surprised: string
  next_action: string
}

export type ReflectionFeedback = {
  quality_score: 1 | 2 | 3 | 4 | 5
  feedback_text: string
  growth_indicator: 'surface' | 'developing' | 'deep' | 'transformative'
  suggested_next_action: string
  // true when this score is NOT a genuine AI judgement — either the AI call
  // failed/timed out, its response failed to parse, or the submission was
  // too short to send to the AI at all. Never render this as a real grade.
  isFallback: boolean
}

export type ReflectionResponse = {
  success: boolean
  reflection: AcademyReflection
  feedback: ReflectionFeedback
}

// ── Enriched lesson types (new columns) ──────────────────────────────────────

export type LessonWithReflection = LessonWithCompletion & {
  learning_objective: string | null
  competency_tags: string[]
  reflection: AcademyReflection | null
}

// ── Missions ──────────────────────────────────────────────────────────────────

export type MissionType = 'compare' | 'create' | 'apply' | 'investigate' | 'teach' | 'build'

export type RubricDimension = {
  key: string
  label: string
  description: string
}

export type EvaluationRubric = {
  dimensions: RubricDimension[]
}

export type AcademyMission = {
  id: string
  module_id: string
  phase: number
  title: string
  description: string
  instructions: string
  mission_type: MissionType
  tool_a_label: string | null
  tool_b_label: string | null
  tool_a_prompt: string | null
  tool_b_link: string | null
  evaluation_rubric: EvaluationRubric | null
  xp_reward: number
  order: number
  published: boolean
  created_at: string
}

export type MissionCompletion = {
  id: string
  teacher_id: string
  mission_id: string
  tool_a_output: string | null
  tool_b_output: string | null
  comparison_notes: string | null
  self_scores: Record<string, number> | null
  ai_score: number | null
  ai_verdict: string | null
  is_fallback: boolean
  completed_at: string
  updated_at: string
}

export type MissionWithCompletion = AcademyMission & {
  completion: MissionCompletion | null
}

export type MissionInput = {
  mission_id: string
  tool_a_output: string
  tool_b_output: string
  comparison_notes: string
  self_scores: Record<string, number>
}

export type MissionVerdict = {
  ai_score: 1 | 2 | 3 | 4 | 5
  ai_verdict: string
  key_insight: string
  suggested_next_action: string
  // true when this score is NOT a genuine AI judgement — see
  // ReflectionFeedback.isFallback for the identical rationale.
  isFallback: boolean
}

export type MissionCompleteResponse = {
  success: boolean
  completion: MissionCompletion
  verdict: MissionVerdict
  xp_earned: number
}

// ── Evidence ──────────────────────────────────────────────────────────────────

export type EvidenceType = 'text' | 'link' | 'plan_id'

export type AcademyEvidence = {
  id: string
  teacher_id: string
  lesson_id: string
  evidence_type: EvidenceType
  content: string | null        // text/link value
  linked_id: string | null      // plan_id reference
  linked_title: string | null   // display name for linked resource
  description: string
  created_at: string
  updated_at: string
}

export type EvidenceInput = {
  lesson_id: string
  evidence_type: EvidenceType
  content: string
  linked_id: string
  linked_title: string
  description: string
}

export type RecentPlan = {
  id: string
  strand: string
  sub_strand: string
  week_number: number
  lesson_number: number
  taught_date: string | null
  created_at: string
}
