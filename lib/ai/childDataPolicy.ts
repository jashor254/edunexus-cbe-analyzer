// lib/ai/childDataPolicy.ts
//
// Containment switch for AI workflows that send learner-identifiable data
// (a child's own messages, essays, handwritten scripts, or a learner profile)
// to an external AI provider whose contractual eligibility and data-processing
// safeguards for learners are not yet resolved.
//
// FAIL-CLOSED and code-pinned, like SHARE_GENERATION_ENABLED: flipping this is
// a deliberate, reviewed code change (a unit test pins the value) — never an
// environment variable that a misconfigured Preview or Production could flip.
//
// Enforcement points (all server-side):
//   1. startLogicalCall() — every provider request path begins here, so a
//      blocked feature throws before any provider function can run.
//   2. Each low-level egress function (DeepSeek fetch, Gemini request,
//      streaming variants) re-checks the feature on its LogicalCall, so a
//      retry, fallback or background job can never reach a provider either.
//   3. Route-level guards give the user a clear, honest message before any
//      database work or quota is consumed.
//
// Only features listed in GENERIC_CONTENT_AI_FEATURES — curriculum or
// instructional content with no learner-identifiable data — may reach a
// provider while the switch is off. A feature that is in neither list is
// treated as child-data (default deny). An architecture test requires every
// provider-call feature in the source tree to be classified here.

export const CHILD_DATA_AI_ENABLED: boolean = false

/** Features whose requests carry learner-identifiable data. Blocked while the switch is off. */
export const CHILD_DATA_AI_FEATURES = [
  'learning_compass',               // learner chat messages + learning profile (Gemini first, DeepSeek fallback)
  'kiswahili_insha_pack',           // full learner essays
  'paper_intelligence_mark_script', // photographed handwritten scripts
  'paper_intelligence_mark_page',   // photographed handwritten page
  'career_intelligence_report',     // pseudonymised capability/interest profile
  'holiday_plan',                   // pseudonymised grade + weak topics
  'class_reports_generate',         // pseudonymised learner gap profile (Compass bridge)
] as const

/** Features that send only generic curriculum/instructional content or adult-authored content. */
export const GENERIC_CONTENT_AI_FEATURES = [
  'sow_generate',
  'lesson_plan_generate',
  'slides_generate',
  'remedial_planner',               // group sizes + generic activities only; no names
  'adaptive_variant_generate',      // tier label + question text only
  'teaching_quick_check',           // grade/sub-strand + aggregate count only
  'study_group_challenge',          // grade + subject only
  'career_knowledge_request',       // career names only
  'academy_reflection_judge',       // teacher (adult) training reflections
  'academy_mission_judge',
  'paper_intelligence_extract_rubric', // teacher's marking-scheme pages (no learner content)
] as const

export type ChildDataAIFeature = (typeof CHILD_DATA_AI_FEATURES)[number]
export type GenericContentAIFeature = (typeof GENERIC_CONTENT_AI_FEATURES)[number]

const GENERIC = new Set<string>(GENERIC_CONTENT_AI_FEATURES)

export const CHILD_DATA_AI_PAUSED_CODE = 'AI_FEATURE_PAUSED_FOR_REVIEW'
export const CHILD_DATA_AI_PAUSED_STATUS = 503

// Honest wording: the pause is a deliberate review of AI-provider terms for use
// with learners — not a technical fault — and learner records are untouched.
export const CHILD_DATA_AI_PAUSED_MESSAGE =
  'This AI feature is paused while we review our AI service providers’ terms for use with learners. ' +
  'Your records and the rest of EduNexus are not affected.'

export class ChildDataAIPausedError extends Error {
  readonly code = CHILD_DATA_AI_PAUSED_CODE
  readonly feature: string
  constructor(feature: string) {
    super(CHILD_DATA_AI_PAUSED_MESSAGE)
    this.name = 'ChildDataAIPausedError'
    this.feature = feature
  }
}

/** True when `feature` may NOT reach an AI provider right now. Default deny for unclassified features. */
export function isChildDataAIBlocked(feature: string | null | undefined): boolean {
  if (CHILD_DATA_AI_ENABLED) return false
  return !(typeof feature === 'string' && GENERIC.has(feature))
}

/** Throws before any provider request is built when the feature is blocked. */
export function assertAIFeatureAllowed(feature: string | null | undefined): void {
  if (isChildDataAIBlocked(feature)) throw new ChildDataAIPausedError(feature ?? 'unattributed')
}

/** For route guards: is the learner-data AI switch currently off? */
export function isChildDataAIPaused(): boolean {
  return !CHILD_DATA_AI_ENABLED
}

export function isChildDataAIPausedError(err: unknown): err is ChildDataAIPausedError {
  return err instanceof ChildDataAIPausedError
}
