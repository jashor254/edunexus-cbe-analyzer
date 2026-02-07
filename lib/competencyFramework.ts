/**
 * CBC Competency Framework - Core Logic for EduNexus
 * Purpose: Provides data structures and analysis for student performance.
 */

export type CompetencyLevel = {
  level: number
  name: string
  description: string
  indicators: string[]
  learningFocus: string
}

export type SubjectCompetency = {
  subject: string
  skillAreas: string[]
  levelDescriptions: CompetencyLevel[]
}

/**
 * CBC Competency Level Definitions (Global Fallback)
 */
export const CBC_LEVELS: CompetencyLevel[] = [
  {
    level: 1,
    name: 'Below Expectations (BE)',
    description: 'Learner requires significant support',
    indicators: ['Basic concept mastery', 'Foundational support needed', 'Guided tasks'],
    learningFocus: 'Foundation building'
  },
  {
    level: 2,
    name: 'Approaching Expectations (AE)',
    description: 'Learner is developing skills',
    indicators: ['Concept grasping', 'Partial independence', 'Improving accuracy'],
    learningFocus: 'Gap closing'
  },
  {
    level: 3,
    name: 'Meeting Expectations (ME)',
    description: 'Learner consistently meets outcomes',
    indicators: ['Solid understanding', 'Independent work', 'Contextual application'],
    learningFocus: 'Deepening understanding'
  },
  {
    level: 4,
    name: 'Exceeding Expectations (EE)',
    description: 'Learner surpasses outcomes',
    indicators: ['Exceptional mastery', 'Creative thinking', 'Advanced challenges'],
    learningFocus: 'Enrichment'
  }
]

export const SUBJECT_COMPETENCIES: Record<string, SubjectCompetency> = {
  mathematics: {
    subject: 'Mathematics',
    skillAreas: ['Number Operations', 'Algebra', 'Geometry', 'Data'],
    levelDescriptions: [
      { level: 1, name: 'Foundation', description: 'Basic numeracy', indicators: ['Counting with support', 'Simple patterns', 'Shape ID'], learningFocus: 'Concrete manipulatives' },
      { level: 2, name: 'Developing', description: 'Fluency', indicators: ['Calculations with errors', 'Simple word problems', 'Basic geometry'], learningFocus: 'Strategy development' },
      { level: 3, name: 'Proficient', description: 'Competence', indicators: ['Accurate calculations', 'Geometric reasoning', 'Data analysis'], learningFocus: 'Deep connections' },
      { level: 4, name: 'Advanced', description: 'Exceptional', indicators: ['Multi-step problems', 'Generalizations', 'Beyond curriculum'], learningFocus: 'Challenge/Exploration' }
    ]
  },
  integrated_science: {
    subject: 'Integrated Science',
    skillAreas: ['Scientific Inquiry', 'Life Science', 'Physical Science'],
    levelDescriptions: [
      { level: 1, name: 'Exploring', description: 'Beginning', indicators: ['Basic observation', 'Fact recall', 'Guided procedures'], learningFocus: 'Vocabulary/Exploration' },
      { level: 2, name: 'Investigating', description: 'Growing', indicators: ['Independent observation', 'Phenomena explanation', 'Record findings'], learningFocus: 'Inquiry skills' },
      { level: 3, name: 'Analyzing', description: 'Competent', indicators: ['Independent inquiry', 'Cause & effect', 'Evidence use'], learningFocus: 'Critical analysis' },
      { level: 4, name: 'Innovating', description: 'Advanced', indicators: ['Investigation design', 'Hypothesis testing', 'Domain connection'], learningFocus: 'Independent research' }
    ]
  },
  english: {
    subject: 'English',
    skillAreas: ['Reading', 'Writing', 'Grammar', 'Communication'],
    levelDescriptions: [
      { level: 1, name: 'Emergent', description: 'Beginning', indicators: ['Simple texts', 'Basic sentences', 'Limited vocab'], learningFocus: 'Phonics/Sight words' },
      { level: 2, name: 'Developing', description: 'Growing', indicators: ['Grade-level texts', 'Simple paragraphs', 'Grammar practice'], learningFocus: 'Fluency' },
      { level: 3, name: 'Fluent', description: 'Competent', indicators: ['Independent comprehension', 'Organized writing', 'Good grammar'], learningFocus: 'Literary analysis' },
      { level: 4, name: 'Advanced', description: 'Mastery', indicators: ['Complex text analysis', 'Sophisticated style', 'Rich vocabulary'], learningFocus: 'Creative criticism' }
    ]
  }
}

/**
 * NEW: Simple Description Helper 
 * Fixes build error in reportGenerator.ts
 */
export function getCompetencyDescription(score: number, subject?: string): string {
  if (subject) {
    let subKey = subject.toLowerCase().trim().replace(/\s+/g, '_');
    if (subKey === 'maths' || subKey === 'math') subKey = 'mathematics';
    if (subKey === 'science') subKey = 'integrated_science';

    const competency = SUBJECT_COMPETENCIES[subKey];
    const levelDesc = competency?.levelDescriptions.find(l => l.level === score);
    if (levelDesc) return levelDesc.description;
  }

  const globalLevel = CBC_LEVELS.find(l => l.level === score);
  return globalLevel ? globalLevel.description : "Assessment completed successfully";
}

/**
 * Skill gap analysis logic
 */
export function analyzeSkillGaps(
  subject: string,
  currentLevel: number,
  targetLevel: number = 3
): {
  gaps: string[]
  nextSteps: string[]
  timeEstimate: string
} {
  let subKey = subject.toLowerCase().trim().replace(/\s+/g, '_');
  if (subKey === 'maths' || subKey === 'math') subKey = 'mathematics';
  if (subKey === 'science') subKey = 'integrated_science';
  
  const competency = SUBJECT_COMPETENCIES[subKey];
  const targetDesc = competency 
    ? competency.levelDescriptions.find(l => l.level === targetLevel)
    : CBC_LEVELS.find(l => l.level === targetLevel);
  
  if (!targetDesc) {
    return {
      gaps: ['Performance improvement markers'],
      nextSteps: ['Focus on general grade-level outcomes'],
      timeEstimate: '4-6 weeks'
    };
  }
  
  return { 
    gaps: targetDesc.indicators.map(ind => ind.toString()), 
    nextSteps: [
      `Focus: ${targetDesc.learningFocus}`,
      'Practice specific competency indicators',
      'Targeted assessments for milestone tracking'
    ],
    timeEstimate: Math.max(0, targetLevel - currentLevel) === 0 
      ? 'Maintenance phase' 
      : `${(targetLevel - currentLevel) * 4}-6 weeks`
  };
}