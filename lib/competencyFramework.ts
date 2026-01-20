// lib/competencyFramework.ts

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
 * CBC Competency Level Definitions
 */
export const CBC_LEVELS: CompetencyLevel[] = [
  {
    level: 1,
    name: 'Below Expectations (BE)',
    description: 'Learner requires significant support to meet learning outcomes',
    indicators: [
      'Struggles with basic concepts',
      'Needs extensive guidance and scaffolding',
      'Limited independent work capability',
      'Requires one-on-one intervention'
    ],
    learningFocus: 'Foundation building with intensive support'
  },
  {
    level: 2,
    name: 'Approaching Expectations (AE)',
    description: 'Learner is developing towards meeting learning outcomes',
    indicators: [
      'Grasps some concepts but inconsistently',
      'Needs regular support and reinforcement',
      'Can complete tasks with guidance',
      'Shows improvement but gaps remain'
    ],
    learningFocus: 'Gap closing and confidence building'
  },
  {
    level: 3,
    name: 'Meeting Expectations (ME)',
    description: 'Learner consistently meets expected learning outcomes',
    indicators: [
      'Demonstrates solid understanding',
      'Works independently on grade-level tasks',
      'Applies concepts in familiar contexts',
      'Performs at expected competency level'
    ],
    learningFocus: 'Maintaining and deepening understanding'
  },
  {
    level: 4,
    name: 'Exceeding Expectations (EE)',
    description: 'Learner consistently surpasses expected learning outcomes',
    indicators: [
      'Shows exceptional mastery',
      'Applies knowledge in novel situations',
      'Demonstrates creativity and critical thinking',
      'Ready for advanced challenges'
    ],
    learningFocus: 'Enrichment and advanced exploration'
  }
]

/**
 * Subject-specific competency frameworks
 */
export const SUBJECT_COMPETENCIES: Record<string, SubjectCompetency> = {
  mathematics: {
    subject: 'Mathematics',
    skillAreas: [
      'Number Operations',
      'Algebra & Patterns',
      'Geometry & Measurement',
      'Data & Probability',
      'Problem Solving'
    ],
    levelDescriptions: [
      {
        level: 1,
        name: 'Foundation',
        description: 'Building basic numeracy',
        indicators: [
          'Counting and basic operations with support',
          'Simple pattern recognition',
          'Basic shape identification',
          'Reading simple graphs with help'
        ],
        learningFocus: 'Concrete manipulatives, visual aids, basic operations'
      },
      {
        level: 2,
        name: 'Developing',
        description: 'Growing mathematical fluency',
        indicators: [
          'Performs calculations with occasional errors',
          'Solves simple word problems',
          'Uses basic geometric properties',
          'Interprets data with guidance'
        ],
        learningFocus: 'Practice, error correction, strategy development'
      },
      {
        level: 3,
        name: 'Proficient',
        description: 'Solid mathematical competence',
        indicators: [
          'Accurate calculations independently',
          'Applies multiple strategies to problems',
          'Uses geometric reasoning',
          'Analyzes and interprets data'
        ],
        learningFocus: 'Application, connections, deeper understanding'
      },
      {
        level: 4,
        name: 'Advanced',
        description: 'Exceptional mathematical thinking',
        indicators: [
          'Solves complex multi-step problems',
          'Creates own problem-solving strategies',
          'Makes mathematical generalizations',
          'Explores beyond curriculum'
        ],
        learningFocus: 'Challenge problems, competitions, exploration'
      }
    ]
  },
  integrated_science: {
    subject: 'Integrated Science',
    skillAreas: [
      'Scientific Inquiry',
      'Life Science',
      'Physical Science',
      'Earth & Space',
      'Scientific Reasoning'
    ],
    levelDescriptions: [
      {
        level: 1,
        name: 'Exploring',
        description: 'Beginning scientific understanding',
        indicators: [
          'Basic observations with prompting',
          'Simple classification tasks',
          'Follows procedures with help',
          'Recalls basic facts'
        ],
        learningFocus: 'Hands-on exploration, vocabulary, basic concepts'
      },
      {
        level: 2,
        name: 'Investigating',
        description: 'Growing scientific skills',
        indicators: [
          'Makes observations independently',
          'Follows scientific method with guidance',
          'Explains simple phenomena',
          'Records findings'
        ],
        learningFocus: 'Experimentation, inquiry skills, connections'
      },
      {
        level: 3,
        name: 'Analyzing',
        description: 'Competent scientific thinking',
        indicators: [
          'Conducts investigations independently',
          'Explains cause and effect',
          'Uses evidence to support conclusions',
          'Applies scientific concepts'
        ],
        learningFocus: 'Analysis, critical thinking, application'
      },
      {
        level: 4,
        name: 'Innovating',
        description: 'Advanced scientific understanding',
        indicators: [
          'Designs own investigations',
          'Makes predictions and tests hypotheses',
          'Connects across scientific domains',
          'Thinks like a scientist'
        ],
        learningFocus: 'Independent research, competitions, advanced topics'
      }
    ]
  },
  english: {
    subject: 'English',
    skillAreas: [
      'Reading Comprehension',
      'Writing Skills',
      'Grammar & Mechanics',
      'Vocabulary',
      'Communication'
    ],
    levelDescriptions: [
      {
        level: 1,
        name: 'Emergent',
        description: 'Beginning language skills',
        indicators: [
          'Reads simple texts with support',
          'Writes basic sentences',
          'Limited vocabulary',
          'Needs help with grammar'
        ],
        learningFocus: 'Phonics, sight words, basic grammar, simple writing'
      },
      {
        level: 2,
        name: 'Developing',
        description: 'Growing language competence',
        indicators: [
          'Reads grade-level texts with some help',
          'Writes simple paragraphs',
          'Expanding vocabulary',
          'Inconsistent grammar use'
        ],
        learningFocus: 'Fluency, paragraph structure, grammar practice'
      },
      {
        level: 3,
        name: 'Fluent',
        description: 'Competent language use',
        indicators: [
          'Reads and comprehends independently',
          'Writes organized multi-paragraph texts',
          'Good vocabulary range',
          'Correct grammar usually'
        ],
        learningFocus: 'Literary analysis, varied writing, expression'
      },
      {
        level: 4,
        name: 'Advanced',
        description: 'Exceptional language mastery',
        indicators: [
          'Analyzes complex texts',
          'Writes with sophistication and style',
          'Rich vocabulary',
          'Masterful grammar and mechanics'
        ],
        learningFocus: 'Creative writing, literary criticism, advanced texts'
      }
    ]
  }
}

/**
 * Get competency description for a subject and level
 */
export function getCompetencyDescription(subject: string, level: number): CompetencyLevel | null {
  const competency = SUBJECT_COMPETENCIES[subject]
  if (!competency) return CBC_LEVELS.find(l => l.level === level) || null
  
  return competency.levelDescriptions.find(l => l.level === level) || null
}

/**
 * Get skill gap analysis
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
  const competency = SUBJECT_COMPETENCIES[subject]
  
  if (!competency) {
    return {
      gaps: ['Subject-specific framework not available'],
      nextSteps: ['Focus on general skill development for this subject'],
      timeEstimate: 'Varies by individual progress'
    }
  }
  
  const currentDesc = competency.levelDescriptions.find(l => l.level === currentLevel)
  const targetDesc = competency.levelDescriptions.find(l => l.level === targetLevel)
  
  if (!currentDesc || !targetDesc) {
    return {
      gaps: [],
      nextSteps: [],
      timeEstimate: 'Unknown'
    }
  }
  
  const gaps = targetDesc.indicators.map((indicator, i) => 
    `${i + 1}. ${indicator}`
  )
  
  const nextSteps = [
    `Focus on: ${targetDesc.learningFocus}`,
    'Work through targeted practice in weak areas',
    'Seek feedback from teacher regularly',
    'Track progress with mini-assessments'
  ]
  
  const levelGap = targetLevel - currentLevel
  const timeEstimate = levelGap === 1 
    ? '4-6 weeks with consistent effort'
    : `${levelGap * 6}-${levelGap * 8} weeks with dedicated practice`
  
  return { gaps, nextSteps, timeEstimate }
}