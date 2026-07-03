// lib/ai-orchestration/templates.ts
// Centralized prompt template registry.
// Templates live in code (not DB) for type-safety and version control.
import type { PromptTemplate } from './types'

const TEMPLATES = new Map<string, PromptTemplate>()

/**
 * Register a prompt template. Call at module load time.
 */
export function registerTemplate(template: PromptTemplate): void {
  TEMPLATES.set(template.name, template)
}

/**
 * Get a template by name.
 */
export function getTemplate(name: string): PromptTemplate {
  const t = TEMPLATES.get(name)
  if (!t) throw new Error(`Prompt template not found: ${name}`)
  return t
}

/**
 * Render a template by substituting {{variable}} tokens.
 */
export function renderTemplate(
  name: string,
  variables: Record<string, string>
): { system: string; user: string } {
  const t = getTemplate(name)

  const render = (text: string): string =>
    text.replace(/\{\{(\w+)\}\}/g, (_, key) => {
      if (!(key in variables)) throw new Error(`Template variable missing: {{${key}}} in template '${name}'`)
      return variables[key]
    })

  return {
    system: render(t.system),
    user:   render(t.user_template),
  }
}

// ── Built-in platform templates ───────────────────────────────────────────────

registerTemplate({
  id:      'sow.generate.v1',
  name:    'sow.generate',
  version: '1.0',
  system:  'You are an expert Kenyan CBC curriculum specialist. Generate a complete Scheme of Work in valid JSON only. No markdown, no explanation — raw JSON only.',
  user_template: `Generate a {{term_weeks}}-week Scheme of Work for:
Subject: {{subject}}
Grade: {{grade}}
Term: {{term}}
Curriculum: CBC {{curriculum_track}}
Class context: {{class_context}}

Return JSON matching this structure exactly:
{ "weeks": [ { "week": 1, "strand": "", "sub_strand": "", "specific_learning_outcomes": [], "key_inquiry_questions": [], "learning_experiences": [], "learning_resources": [], "assessment": "", "values": [] } ] }`,
  defaults: { temperature: 0.3, max_tokens: 4096, mode: 'quality' },
})

registerTemplate({
  id:      'lesson_plan.generate.v1',
  name:    'lesson_plan.generate',
  version: '1.0',
  system:  'You are an expert CBC lesson plan writer for Kenyan teachers. Respond with valid JSON only.',
  user_template: `Write a detailed lesson plan for:
Subject: {{subject}}
Grade: {{grade}}
Strand: {{strand}}
Sub-strand: {{sub_strand}}
Duration: {{duration}} minutes
Prior knowledge: {{prior_knowledge}}

Return JSON with keys: specific_learning_outcomes, key_inquiry_questions, learning_activities (introduction/development/conclusion), resources, assessment, differentiation`,
  defaults: { temperature: 0.4, max_tokens: 2048, mode: 'quality' },
})

registerTemplate({
  id:      'assessment.generate.v1',
  name:    'assessment.generate',
  version: '1.0',
  system:  'You are a CBC assessment specialist. Generate assessments aligned to the CBC framework. Return valid JSON only.',
  user_template: `Create a {{assessment_type}} assessment for:
Subject: {{subject}}
Grade: {{grade}}
Sub-strand: {{sub_strand}}
Number of questions: {{num_questions}}
Difficulty: {{difficulty}}

Return JSON: { "title": "", "instructions": "", "questions": [ { "number": 1, "question": "", "marks": 0, "expected_answer": "", "cbc_level": 1 } ] }`,
  defaults: { temperature: 0.5, max_tokens: 3072, mode: 'standard' },
})
