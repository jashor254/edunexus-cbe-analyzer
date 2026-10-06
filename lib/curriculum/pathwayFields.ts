// lib/curriculum/pathwayFields.ts
//
// The three CBC Senior School pathways and the broad FIELDS each opens — the
// one copy of this content. Junior learners (Grades 7–9) are guided toward a
// pathway, not toward careers: until the Grade 9 pathway choice, EduNexus
// shows fields like "Medicine & Health" or "Engineering", never job titles.
//
// Used by the Academic Clinic junior report (lib/academicClinic/
// reportGenerator.ts) and the student Career Explorer's junior pathway panel.
// Pure constants: safe to import from client components.

import type { SeniorPathway } from './subjects'

export type SeniorPathwayFields = {
  pathway: SeniorPathway
  /** Broad fields of study and work — never specific job titles. */
  fields: string[]
  whyItFits: string
}

export const SENIOR_PATHWAY_FIELDS: readonly SeniorPathwayFields[] = [
  {
    pathway: 'STEM',
    fields: ['Medicine & Health', 'Engineering', 'Computing', 'Applied Sciences'],
    whyItFits: 'Strong Mathematics and Science performance builds the foundation for analytical, technical, and problem-solving careers in high demand in Kenya and globally.',
  },
  {
    pathway: 'Social Sciences',
    fields: ['Law', 'Business & Finance', 'Education', 'Public Administration'],
    whyItFits: 'Strong language and reasoning skills align with careers that require clear communication, critical thinking, and working effectively with communities and institutions.',
  },
  {
    pathway: 'Arts & Sports Science',
    fields: ['Creative Industries', 'Sports Science', 'Design', 'Media'],
    whyItFits: 'Strong creative and practical competencies open Kenya\'s growing creative economy, sports industry, and digital media sector.',
  },
]
