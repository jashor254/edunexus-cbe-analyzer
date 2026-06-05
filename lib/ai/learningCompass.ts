// lib/ai/LearningCompass.ts
// 🧭 THE NEXT GENERATION LEARNING COMPASS
// Phase 1: Learner-facing with teacher oversight
// Perfect adaptation: Knows where learner is, meets them there, grows with them
// NOW WITH FULL DIAGRAM SUPPORT for Biology, Agriculture, Geography, Physics, Chemistry!
// UPDATED: Using DeepSeek instead of Gemini 🚀

import { callDeepSeek } from './deepseek'  // Changed from callGemini
import { analyzePerformance, getLearningTier } from '@/lib/adaptiveLearning'
import type { CurriculumType } from '@/lib/curriculum'

// ==================== TYPES ====================

export interface VisualAid {
  type: 'simple' | 'svg' | 'url' | 'generated'
  content: string
  caption?: string
  interactive?: boolean
  altText: string
  subject?: string
  concept?: string
}

export interface Learner {
  id: string
  name: string
  grade: number
  age: number
  strengths: string[]
  challenges: string[]
  interests: string[]
  dreamCareer?: string
  recommendedPathway: string | null
}

export interface LearnerState {
  // Reference to learner profile
  learner: Learner

  // Current performance level (from assessments)
  currentTier: 'below_expectations' | 'approaching_expectations' | 'meets_expectations' | 'exceeds_expectations'
  subjectTiers: Record<string, string> // per-subject tiers

  // Real-time session state
  cognitiveLoad: 'low' | 'optimal' | 'high' | 'overwhelmed'
  engagementLevel: 'disengaged' | 'neutral' | 'engaged' | 'excited'
  confidenceLevel: 'low' | 'medium' | 'high'

  // Session tracking
  currentSubject: string
  currentConcept: string
  timeOnTask: number // minutes in current session
  attemptsOnConcept: number
  consecutiveSuccesses: number
  breaksTaken: number
  lastBreakTime?: Date

  // History
  masteredConcepts: string[]
  strugglingConcepts: string[]

  // Curriculum
  curriculumType: CurriculumType

  // Compass directives from assessment pipeline
  sessionGoal: string
  guidedTopics: string[]
  careerContext: string
  subjectActionSteps: Record<string, string[]>
  subjectVelocities: Record<string, { velocity: number; trend: string; prediction: string }>
}

export interface Task {
  id: string
  type: 'concept_intro' | 'practice' | 'challenge' | 'break' | 'review'
  subject: string
  concept: string
  difficulty: 1 | 2 | 3 | 4 | 5 // 1=simplest, 5=hardest
  content: {
    instruction: string
    example?: string
    question?: string
    visualAid?: VisualAid  // 👈 Rich visual support!
    realWorldContext: string // Kenyan context always!
  }
  estimatedMinutes: number
  successCriteria: string // How to know they got it
  nextTaskRecommended: string // What to do next
}

export interface CompassDecision {
  task: Task
  adaptationReason: string // Why we chose this
  nextCheckpoint: number // minutes until reassessment
  encouragement: string
  parentInsight: string
  needsBreak: boolean
  breakDuration?: number // minutes
}

// ==================== THE LEARNING COMPASS ====================

export class LearningCompass {
  private learnerHistory: Map<string, LearnerState> = new Map()
  private taskQueue: Map<string, Task[]> = new Map()
  
  // Visual subjects that need diagrams
  private visualSubjects = [
    'biology', 'agriculture', 'geography',
    'physics', 'chemistry', 'integrated_science',
    'creative_arts', 'pre_technical', 'mathematics'
  ]
  
  /**
   * Initialize compass with learner's assessment data + optional pre-calculated context
   * learningContext comes from student_learning_context table (saved by guidance/career pages)
   * Falls back to live analyzePerformance() when context is absent
   */
  async initializeFromAssessments(
    learnerId: string,
    assessments: any[],
    interests: any,
    learningContext?: {
      overall_tier: string
      subject_tiers: Record<string, string>
      subject_action_steps: Record<string, string[]>
      subject_velocities: Record<string, { velocity: number; trend: string; prediction: string }>
      recommended_pathway: string | null
      pathway_confidence: string | null
      top_careers: Array<{ career: string; matchScore: number; gaps: string[]; requiredSubjects: string[] }>
      career_gaps: string[]
      first_subject: string
      session_goal: string
      guided_topics: string[]
      overall_level: number
      curriculum_type: string
      grade: number
    } | null,
    studentProfile?: {
      name: string
      grade: number
      curriculum_type: string
      current_pathway: string | null
    } | null
  ): Promise<void> {
    const latestAssessment = assessments[0]
    const historicalData = this.buildHistoricalData(assessments)

    // ── Resolve name + grade from studentProfile > assessment > fallback ──
    const studentName = studentProfile?.name ?? latestAssessment?.students?.name ?? 'Student'
    const grade = studentProfile?.grade ?? latestAssessment?.students?.grade ?? 7

    // ── Resolve tier / subject tiers / action steps ──
    let overallTier: LearnerState['currentTier'] = 'meets_expectations'
    let subjectTiers: Record<string, string> = {}
    let subjectActionSteps: Record<string, string[]> = {}
    let subjectVelocities: Record<string, { velocity: number; trend: string; prediction: string }> = {}
    let strugglingSubs: string[] = []
    let masteredSubs: string[] = []

    if (learningContext && Object.keys(learningContext.subject_tiers || {}).length > 0) {
      // Use pre-calculated context saved by guidance/career pages
      overallTier = this.mapOverallTier(learningContext.overall_tier)
      // Map raw DB tiers (reinforcement/standard/challenge) to canonical form
      subjectTiers = Object.fromEntries(
        Object.entries(learningContext.subject_tiers || {}).map(([k, v]) => [k, this.mapOverallTier(v as string)])
      )
      subjectActionSteps = learningContext.subject_action_steps || {}
      subjectVelocities = learningContext.subject_velocities || {}
      Object.entries(subjectTiers).forEach(([subj, tier]) => {
        if (tier === 'below_expectations' || tier === 'approaching_expectations') strugglingSubs.push(subj)
        else if (tier === 'exceeds_expectations') masteredSubs.push(subj)
      })
    } else if (latestAssessment?.subject_scores && Object.keys(latestAssessment.subject_scores).length > 0) {
      // Fall back: calculate fresh using adaptiveLearning
      const numericScores: Record<string, number> = {}
      Object.entries(latestAssessment.subject_scores).forEach(([k, v]) => {
        numericScores[k] = typeof v === 'number' ? v : 0
      })
      const analysis = analyzePerformance(numericScores, historicalData)
      overallTier = this.mapOverallTier(analysis.overallTier)
      analysis.recommendations.forEach(rec => {
        subjectTiers[rec.subject] = this.mapOverallTier(rec.tier)
        subjectActionSteps[rec.subject] = rec.actionSteps
        if (rec.tier === 'remedial' || rec.tier === 'reinforcement') strugglingSubs.push(rec.subject)
        else if (rec.tier === 'challenge') masteredSubs.push(rec.subject)
      })
    }

    const learner: Learner = {
      id: learnerId,
      name: studentName,
      grade,
      age: this.calculateAge(grade),
      strengths: masteredSubs,
      challenges: strugglingSubs,
      interests: interests?.interests || [],
      dreamCareer: interests?.dream_career ?? learningContext?.top_careers?.[0]?.career,
      recommendedPathway: learningContext?.recommended_pathway ?? studentProfile?.current_pathway ?? null,
    }

    const initialState: LearnerState = {
      learner,
      currentTier: overallTier,
      subjectTiers,
      cognitiveLoad: 'optimal',
      engagementLevel: 'neutral',
      confidenceLevel: 'medium',
      currentSubject: learningContext?.first_subject || strugglingSubs[0] || 'mathematics',
      currentConcept: '',
      timeOnTask: 0,
      attemptsOnConcept: 0,
      consecutiveSuccesses: 0,
      breaksTaken: 0,
      masteredConcepts: masteredSubs,
      strugglingConcepts: strugglingSubs,
      curriculumType: (learningContext?.curriculum_type ?? studentProfile?.curriculum_type ?? 'cbc') as CurriculumType,
      sessionGoal: learningContext?.session_goal || '',
      guidedTopics: learningContext?.guided_topics || [],
      careerContext: learningContext?.top_careers?.[0]?.career || '',
      subjectActionSteps,
      subjectVelocities,
    }

    this.learnerHistory.set(learnerId, initialState)
  }
  
  /**
   * Main method: Get the next task for the learner
   * This is where the magic happens - COMPASS DECIDES what's next
   */
  async getNextTask(
    learnerId: string,
    subject?: string,
    previousTaskResult?: {
      completed: boolean
      timeSpent: number
      struggled: boolean
      confidence: 'low' | 'medium' | 'high'
    },
    ragSystemPrompt?: string,
    curriculumType?: CurriculumType
  ): Promise<CompassDecision> {

    // 1. Get current learner state — create default if missing (cold start or no assessments)
    let state = this.learnerHistory.get(learnerId)
    if (!state) {
      state = this.createDefaultState(learnerId, curriculumType)
      this.learnerHistory.set(learnerId, state)
    }

    // Apply curriculum type if provided
    if (curriculumType) state.curriculumType = curriculumType
    
    // 2. Update state based on previous task result
    if (previousTaskResult) {
      this.updateStateFromTask(learnerId, previousTaskResult, state)
    }
    
    // 3. CHECK FOR BREAK NEEDED ⏰
    if (this.needsBreak(state)) {
      return this.generateBreakTask(learnerId, state)
    }
    
    // 4. Determine the RIGHT difficulty for this learner NOW
    const difficulty = this.calculateOptimalDifficulty(state, subject)
    
    // 5. Check if subject needs visuals
    const needsVisuals = subject ? this.visualSubjects.includes(subject.toLowerCase()) : false
    
    // 6. Generate appropriate task based on tier, state, and visual needs
    const task = await this.generateTask(
      learnerId,
      subject || state.currentSubject,
      difficulty,
      state,
      needsVisuals,
      ragSystemPrompt
    )
    
    // 7. Queue next tasks for efficiency
    this.preloadNextTasks(learnerId, task, state)
    
    // 8. Prepare decision with reasoning
    const decision: CompassDecision = {
      task,
      adaptationReason: this.generateReason(state, difficulty),
      nextCheckpoint: this.calculateCheckpoint(state, difficulty),
      encouragement: this.getEncouragement(state),
      parentInsight: this.generateParentInsight(state, task),
      needsBreak: false
    }
    
    // 9. Update state with new task
    state.currentSubject = task.subject
    state.currentConcept = task.concept
    this.learnerHistory.set(learnerId, state)
    
    return decision
  }
  
  /**
   * CRITICAL: Calculate optimal difficulty - NOT TOO HARD, NOT TOO EASY
   * Goldilocks principle applied to learning
   */
  private calculateOptimalDifficulty(
    state: LearnerState,
    subject?: string
  ): 1 | 2 | 3 | 4 | 5 {
    
    const subjectTier = subject ? state.subjectTiers[subject] : state.currentTier
    
    // Base difficulty on learner's tier
    let baseDifficulty: 1 | 2 | 3 | 4 | 5
    
    switch(subjectTier) {
      case 'below_expectations':
        baseDifficulty = 1 // Start at simplest
        break
      case 'approaching_expectations':
        baseDifficulty = 2 // Simple but building
        break
      case 'meets_expectations':
        baseDifficulty = 3 // Right at grade level
        break
      case 'exceeds_expectations':
        baseDifficulty = 4 // Challenge but not extreme
        break
      default:
        baseDifficulty = 3
    }
    
    // ADJUST BASED ON REAL-TIME STATE 🎯
    
    // If struggling, dial it back
    if (state.cognitiveLoad === 'overwhelmed' || state.attemptsOnConcept > 3) {
      baseDifficulty = Math.max(1, baseDifficulty - 1) as 1 | 2 | 3 | 4 | 5
    }
    
    // If bored or too easy, increase slightly
    if (state.engagementLevel === 'disengaged' && state.confidenceLevel === 'high') {
      baseDifficulty = Math.min(5, baseDifficulty + 1) as 1 | 2 | 3 | 4 | 5
    }
    
    // For exceeding learners: cap at 4 (never give 5 unless they're truly ready)
    if (subjectTier === 'exceeds_expectations' && baseDifficulty > 4) {
      baseDifficulty = 4
    }
    
    return baseDifficulty
  }
  
  /**
   * CHECK: Does learner need a break?
   * Rule: If too much time or too frustrated, force break
   */
  private needsBreak(state: LearnerState): boolean {
    // Time-based break (15 minutes max on one concept)
    if (state.timeOnTask > 15) {
      return true
    }
    
    // Frustration break (multiple attempts, overwhelmed)
    if (state.attemptsOnConcept > 4 && state.cognitiveLoad === 'overwhelmed') {
      return true
    }
    
    // Engagement break (completely disengaged)
    if (state.engagementLevel === 'disengaged' && state.timeOnTask > 10) {
      return true
    }
    
    // Ensure they're not taking too many breaks
    if (state.breaksTaken > 3) {
      return false // Enough breaks, push through
    }
    
    return false
  }
  
  /**
   * GENERATE BREAK TASK - Fun, light, refreshing
   */
  private generateBreakTask(learnerId: string, state: LearnerState): CompassDecision {
    
    const breakIdeas = [
      {
        type: 'movement',
        task: "Stand up and touch your toes 5 times.",
        duration: 2
      },
      {
        type: 'fun_fact',
        task: "Did you know? A hippo's yawn is actually a threat display.",
        duration: 1
      },
      {
        type: 'quick_game',
        task: "How many blue things can you see around you? Count them.",
        duration: 2
      },
      {
        type: 'stretch',
        task: "Stretch your arms above your head and hold for 10 seconds.",
        duration: 2
      },
      {
        type: 'breathe',
        task: "Breathe in slowly for 4 counts, hold for 4, out for 4. Twice.",
        duration: 1
      }
    ]
    
    const breakIdea = breakIdeas[Math.floor(Math.random() * breakIdeas.length)]
    
    // Update break count
    state.breaksTaken++
    state.lastBreakTime = new Date()
    this.learnerHistory.set(learnerId, state)
    
    return {
      task: {
        id: `break-${Date.now()}`,
        type: 'break',
        subject: state.currentSubject,
        concept: 'break_time',
        difficulty: 1,
        content: {
          instruction: breakIdea.task,
          example: '',
          realWorldContext: 'Taking breaks helps your brain learn better!'
        },
        estimatedMinutes: breakIdea.duration,
        successCriteria: 'Just have fun and relax!',
        nextTaskRecommended: 'Return to learning'
      },
      adaptationReason: "Your brain needs a rest! Let's take a short break.",
      nextCheckpoint: breakIdea.duration,
      encouragement: "Take a short break. Your brain will work better when you return.",
      parentInsight: `${state.currentSubject} was getting tough. A ${breakIdea.duration}-minute brain break will help.`,
      needsBreak: true,
      breakDuration: breakIdea.duration
    }
  }
  
  /**
   * GENERATE TASK with Kenyan context and appropriate difficulty
   * NOW WITH VISUAL AID SUPPORT!
   */
  private async generateTask(
    learnerId: string,
    subject: string,
    difficulty: 1 | 2 | 3 | 4 | 5,
    state: LearnerState,
    needsVisuals: boolean = false,
    ragSystemPrompt?: string
  ): Promise<Task> {

    // Check if we have preloaded tasks
    const queue = this.taskQueue.get(learnerId) || []
    if (queue.length > 0) {
      const nextTask = queue.shift()
      this.taskQueue.set(learnerId, queue)
      if (nextTask) return nextTask
    }

    // Generate fresh task based on difficulty
    const task = this.createTaskForDifficulty(subject, difficulty, state, needsVisuals, ragSystemPrompt)

    return task
  }
  
  /**
   * CREATE task at specific difficulty level
   */
  private createTaskForDifficulty(
    subject: string,
    difficulty: 1 | 2 | 3 | 4 | 5,
    state: LearnerState,
    needsVisuals: boolean = false,
    _ragSystemPrompt?: string
  ): Task {
    // Skip the internal AI call entirely — the route's single DeepSeek call
    // already has subject, locked topic, difficulty, and student level to
    // generate the actual response. Task metadata guides difficulty only.
    if (difficulty === 1) {
      const concept = state.currentConcept || this.getDefaultConceptForSubject(subject)
      return this.getStrugglingLearnerFallback(subject, concept, state)
    }
    return this.getFallbackTask(subject, difficulty, state, needsVisuals)
  }

  /** Guaranteed simple fallback when AI fails for level 1 learners */
  private getStrugglingLearnerFallback(subject: string, concept: string, _state: LearnerState): Task {
    const fallbacks: Record<string, { instruction: string; example: string; question: string; visualAid?: VisualAid; realWorldContext: string }> = {
      mathematics: {
        instruction: '1/2 means one part out of two equal parts.',
        example: 'Split a rectangle into 2 equal parts — each part is 1/2.',
        question: 'What is 1/2 as a decimal?\n\nA) 0.2\nB) 0.5\nC) 2.0\n\nType A, B, or C.',
        visualAid: {
          type: 'simple',
          content: `  ┌─────────┬─────────┐\n  │   ½     │   ½     │\n  └─────────┴─────────┘\n  1 out of 2 equal parts`,
          altText: 'Half of a rectangle',
          caption: '1/2 = one of two equal parts',
        },
        realWorldContext: 'Fractions help you share things equally.',
      },
      biology: {
        instruction: 'A plant cell has a strong outer wall.',
        example: 'It works like a firm container — it holds everything inside and keeps the shape.',
        question: 'What surrounds a plant cell?\n\nA) Cell wall\nB) Nucleus\nC) Vacuole\n\nType A, B, or C.',
        visualAid: {
          type: 'simple',
          content: `  ┌─────────────────┐\n  │  ┌───────────┐  │\n  │  │  Nucleus  │  │\n  │  └───────────┘  │\n  └─────────────────┘\n  ↑ Cell wall (outer layer)`,
          altText: 'Plant cell diagram',
          caption: 'Cell wall is the outer protective layer',
        },
        realWorldContext: 'Cells are the building blocks of every living thing.',
      },
      geography: {
        instruction: 'Water from lakes rises and becomes rain.',
        example: 'Lake water heats up, rises as vapor, forms clouds, then rains.',
        question: 'What happens to lake water when the sun heats it?\n\nA) It disappears\nB) It rises as vapor\nC) It stays still\n\nType A, B, or C.',
        visualAid: {
          type: 'simple',
          content: `  ☁️ Clouds\n   ↑\n  💧 Lake\n   ↓\n  🌧️ Rain`,
          altText: 'Simple water cycle',
          caption: 'Water rises, becomes clouds, falls as rain',
        },
        realWorldContext: 'This is why it rains in different seasons.',
      },
    }

    const fb = fallbacks[subject.toLowerCase()] ?? {
      instruction: `Let's learn one small thing about ${subject}.`,
      example: `Think about how ${subject} shows up in your daily life.`,
      question: `What did you just learn about ${subject}?\n\nA) A key fact\nB) An example\nC) I'm not sure yet\n\nType A, B, or C.`,
      realWorldContext: `${subject} connects to things you see every day.`,
    }

    return {
      id: `fallback-struggling-${Date.now()}`,
      type: 'concept_intro',
      subject,
      concept: concept || 'basics',
      difficulty: 1,
      content: {
        instruction: fb.instruction,
        example: fb.example,
        question: fb.question,
        visualAid: fb.visualAid,
        realWorldContext: fb.realWorldContext,
      },
      estimatedMinutes: 3,
      successCriteria: 'Answer the multiple choice question correctly.',
      nextTaskRecommended: 'practice_same_concept',
    }
  }

  /** Default concept to focus on when no session concept is set */
  private getDefaultConceptForSubject(subject: string): string {
    const defaults: Record<string, string> = {
      mathematics:        'fractions',
      biology:            'cell_structure',
      chemistry:          'atoms',
      physics:            'forces',
      geography:          'water_cycle',
      english:            'basic_grammar',
      kiswahili:          'msamiati',
      agriculture:        'crop_growing',
      integrated_science: 'scientific_method',
    }
    return defaults[subject.toLowerCase()] ?? 'basic_concepts'
  }
  
  /**
   * FALLBACK diagrams for common subjects
   * Rich library of Kenyan-context diagrams
   */
  private getFallbackDiagram(subject: string, concept: string, difficulty: 1 | 2 | 3 | 4 | 5): VisualAid {
    
    // Normalize subject and concept for lookup
    const subjectLower = subject.toLowerCase()
    const conceptLower = concept.toLowerCase().replace(/\s+/g, '_')
    
    // 📚 COMPREHENSIVE DIAGRAM LIBRARY 📚
    const diagrams: Record<string, Record<string, VisualAid>> = {
      mathematics: {
        fractions: {
          type: 'simple',
          content: `
  FRACTIONS — Dividing into EQUAL parts

  1/2 (one half):
  ┌──────┬──────┐
  │ ████ │      │   ← 1 shaded out of 2
  └──────┴──────┘

  1/4 (one quarter):
  ┌──────┬──────┐
  │ ████ │      │   ← 1 shaded out of 4
  ├──────┼──────┤
  │      │      │
  └──────┴──────┘

  2/3 (two thirds):
  ┌──────┬──────┬──────┐
  │ ████ │ ████ │      │   ← 2 shaded out of 3
  └──────┴──────┴──────┘

  Numerator → top number (shaded parts)
  Denominator → bottom number (total parts)
          `,
          altText: 'Fraction diagram showing shaded rectangle parts',
          caption: 'Fractions: shaded parts out of total equal parts',
          subject: 'mathematics',
          concept: 'fractions'
        },
        number_line: {
          type: 'simple',
          content: `
  📏 NUMBER LINE

  0    1    2    3    4    5    6    7    8    9   10
  |----|----|----|----|----|----|----|----|----|----|
  ↑              ↑                        ↑
  Start          3                        8

  Counting forward (+): move RIGHT  →
  Counting back   (-): move LEFT   ←

  Example: 3 + 5 = ?
  Start at 3, jump 5 steps right → land on 8  ✓
          `,
          altText: 'Number line from 0 to 10 with arrows showing addition',
          caption: 'Number line — addition moves right, subtraction moves left',
          subject: 'mathematics',
          concept: 'number_line'
        },
        shapes: {
          type: 'simple',
          content: `
  📐 2D SHAPES

  Triangle (3 sides):     Square (4 equal sides):
       /\\                  ┌────┐
      /  \\                 │    │
     /____\\                └────┘

  Rectangle (4 sides):    Circle:
  ┌────────┐                 ○
  │        │              (no corners)
  └────────┘

  Pentagon (5 sides):
      /‾‾‾\\
     /     \\
    |       |
     \\_____/
          `,
          altText: 'Common 2D shapes: triangle, square, rectangle, circle, pentagon',
          caption: '2D shapes and their number of sides',
          subject: 'mathematics',
          concept: 'shapes'
        },
        multiplication: {
          type: 'simple',
          content: `
  ✖️  MULTIPLICATION — rows of equal groups

  3 × 4 = 12  (3 rows of 4):
  🔵 🔵 🔵 🔵
  🔵 🔵 🔵 🔵
  🔵 🔵 🔵 🔵
  Count all: 12 ✓

  2 × 5 = 10  (2 rows of 5):
  ⭐ ⭐ ⭐ ⭐ ⭐
  ⭐ ⭐ ⭐ ⭐ ⭐
  Count all: 10 ✓

  Tip: 3 × 4 is the same as 4 × 3 = 12
          `,
          altText: 'Multiplication as equal groups shown with dots',
          caption: 'Multiplication = equal groups added together',
          subject: 'mathematics',
          concept: 'multiplication'
        },
      },
      biology: {
        plant_cell: {
          type: 'simple',
          content: `
            🌱 PLANT CELL DIAGRAM:
            
            ┌─────────────────────┐
            │  ┌───────────────┐  │
            │  │    Nucleus    │  │
            │  │      ☢️       │  │
            │  └───────────────┘  │
            │    🌿 Chloroplast   │
            │    💧 Vacuole       │
            └─────────────────────┘
            
            Cell Wall (outer layer)
            Nucleus (control center)
            Chloroplast (makes food)
            Vacuole (stores water)
          `,
          altText: 'Diagram of a plant cell showing nucleus, chloroplast, and vacuole',
          caption: 'Plant Cell Structure - Like a small factory!'
        },
        photosynthesis: {
          type: 'simple',
          content: `
            ☀️ PHOTOSYNTHESIS ☀️
            
                Sunlight
                   ↓
            ┌──────────────┐
            │    LEAF      │
            │  ┌────────┐  │
            │  │ 🌿 Food│  │
            │  └────────┘  │
            └──────────────┘
              ↑         ↑
            💧 Water   🌬️ CO2
            
            OUTPUT: 🌽 Glucose (food) + 💨 Oxygen
          `,
          altText: 'Photosynthesis diagram showing sunlight, water, CO2 producing food',
          caption: 'How plants make their own food - like cooking!'
        },
        human_heart: {
          type: 'simple',
          content: `
            ❤️ HUMAN HEART:
            
                ┌─────┐
             ┌──┘     └──┐
             │  🫀  🫀   │
             │  Right Left│
             └──┐     ┌──┘
                └─────┘
              ↓        ↓
            Body     Lungs
          `,
          altText: 'Simple diagram of human heart showing chambers',
          caption: 'Your heart pumps blood all day!'
        }
      },
      
      geography: {
        water_cycle: {
          type: 'simple',
          content: `
            THE WATER CYCLE

                 ☁️ CLOUDS
                  ↑  ↓
            OCEAN/LAKE → RAIN
            (Evaporation)  ↓
                      RIVERS flow
                        ↓
                    OCEAN/LAKE (returns)

            Sun heats water → Evaporation → Condensation
            → Clouds → Precipitation → Rivers → Ocean
          `,
          altText: 'Water cycle showing evaporation, condensation, precipitation',
          caption: 'Water keeps moving in a circle - like magic!'
        },
        mount_kenya: {
          type: 'simple',
          content: `
            🏔️ MOUNT KENYA ZONES:
            
            5,199m ⛰️ PEAK - Snow/Ice ❄️
                ↑
            4,000m 🪨 ALPINE - Rocks, cold
                ↑
            3,000m 🌲 FOREST - Trees, animals
                ↑
            1,500m 🌾 FARMLAND - Crops, homes
                ↑
            Base - Towns (Nanyuki, Meru)
            
            Temperature drops as you go up!
          `,
          altText: 'Vegetation zones of Mount Kenya from base to peak',
          caption: 'Different plants and animals at different heights'
        },
        weather: {
          type: 'simple',
          content: `
            WEATHER SYMBOLS:

            ☀️ Sunny
            ⛅ Partly cloudy
            ☁️ Overcast
            🌧️ Rain
            ⚡ Thunder
            🌈 Rainbow

            Temperature rises with more sunshine.
            Humidity increases before rain.
          `,
          altText: 'Weather symbols and Kenya forecast',
          caption: 'Check the weather before going out!'
        }
      },
      
      agriculture: {
        row_planting: {
          type: 'simple',
          content: `
            🌽 MAIZE ROW PLANTING:
            
            🌱──30cm──🌱──30cm──🌱   ← Row 1
             │        │        │
            60cm      60cm      60cm
             │        │        │
            🌱──30cm──🌱──30cm──🌱   ← Row 2
             │        │        │
            60cm      60cm      60cm
             │        │        │
            🌱──30cm──🌱──30cm──🌱   ← Row 3
            
            Spacing:
            • Between plants: 30cm (foot step)
            • Between rows: 60cm (two steps)
            • Gives each plant room to grow!
          `,
          altText: 'Row planting diagram showing spacing between maize plants',
          caption: 'Proper spacing means bigger harvest!'
        },
        compost: {
          type: 'simple',
          content: `
            MAKING COMPOST:

            LAYERS IN THE PIT:
            ┌─────────────────┐
            │ Dry leaves      │ ← Top
            ├─────────────────┤
            │ Organic waste   │
            ├─────────────────┤
            │ Fresh plant matter│
            ├─────────────────┤
            │ Soil + Ash      │
            ├─────────────────┤
            │ Water (moist)   │
            └─────────────────┘

            Mix every 2 weeks.
            After 3 months: rich organic soil ready to use.
          `,
          altText: 'Compost pit layers diagram',
          caption: 'Turn kitchen waste into garden gold!'
        },
        cow_digestive: {
          type: 'simple',
          content: `
            🐄 COW DIGESTIVE SYSTEM:
            
            Food in mouth → Rumen → Reticulum → Omasum → Abomasum
                 (1)          (2)        (3)        (4)       (5)
                 ↓
            Chews cud (brings food back)
            
            Rumen: 4 stomachs! 🤯
            • Holds 150L of food
            • Bacteria help digest grass
            • Produces methane (burps!)
          `,
          altText: 'Cow digestive system diagram showing four stomachs',
          caption: 'Cows have 4 stomachs to digest grass!'
        }
      },
      
      physics: {
        simple_circuit: {
          type: 'simple',
          content: `
            ⚡ SIMPLE CIRCUIT:
            
            [Battery]────[Bulb]────[Switch]
                │                    │
                └──────────┘
                
            When switch is CLOSED:
            • Current flows 💡
            • Bulb lights up!
            
            When switch is OPEN:
            • Current stops
            • Bulb goes dark
            
            Like a water tap - open = flow, closed = stop
          `,
          altText: 'Simple electrical circuit with battery, bulb, and switch',
          caption: 'Electricity needs a complete path to flow'
        },
        refraction: {
          type: 'simple',
          content: `
            💧 LIGHT REFRACTION:
            
                AIR
            ─────╮
                 ╲
            WATER ─╲───
                  
            Why pencil looks bent:
            
            Real pencil:    What you see:
            ┌──────┐        ┌──────┐
            │      │        │      │
            │      │   →    │   ┌──┘
            │      │        │   │
            └──────┘        └───┘
            
            Light bends when entering water!
          `,
          altText: 'Light refraction diagram showing bent pencil in water',
          caption: 'That\'s why fish aren\'t where they look!'
        },
        lever: {
          type: 'simple',
          content: `
            🔧 SIMPLE LEVER:
            
            Load    Fulcrum    Effort
            (box)      ▲       (you push)
              ↓        ↓          ↓
            ┌────┐    │    ┌────────┐
            │    │    │    │        │
            └────┘    │    └────────┘
              └────────┴────────┘
            
            Like a seesaw:
            • Push down one side
            • Other side lifts load
            • Makes work easier!
            
            Examples: crowbar, see-saw, scissors
          `,
          altText: 'Lever diagram showing load, fulcrum, and effort',
          caption: 'Levers make heavy things feel light!'
        }
      },
      
      chemistry: {
        atom: {
          type: 'simple',
          content: `
            ⚛️ ATOM STRUCTURE:
            
                  ┌─────┐
                 │  ☢️  │  ← Nucleus
                  └─────┘
                Proton (+)  
                Neutron (no charge)
                
                   ⚫
              ⚫  ⚫  ⚫   ← Electrons (-)
                 ⚫  ⚫
                   ⚫
            
            Electrons spin around nucleus
            Like planets around the sun!
          `,
          altText: 'Atom diagram showing nucleus and electrons',
          caption: 'Everything is made of atoms!'
        },
        water_molecule: {
          type: 'simple',
          content: `
            💧 WATER MOLECULE (H₂O):
            
                  O
                 ╱ ╲
                H   H
                
            One Oxygen atom
            Two Hydrogen atoms
            Like Mickey Mouse ears!
            
            Why special:
            • Dissolves many things
            • Sticks to itself (surface tension)
            • Expands when frozen
          `,
          altText: 'Water molecule diagram showing H2O structure',
          caption: 'Water is H2O - 2 hydrogens + 1 oxygen'
        }
      },
      
      integrated_science: {
        solar_system: {
          type: 'simple',
          content: `
            🌍 OUR SOLAR SYSTEM:
            
                ☀️ SUN
                 │
            ┌────┼────┬────┬────┐
            ☿    ♀    🌍    ♂    ♃
            Mercury Venus Earth Mars Jupiter
            
            ──┬───┬───┬───┐
              ♄    ♅    ♆
            Saturn Uranus Neptune
            
            Earth: 3rd from sun
            Takes 365 days to go around
            Moon goes around Earth 🌕
          `,
          altText: 'Solar system diagram showing planets orbiting the sun',
          caption: 'We live on planet Earth!'
        },
        food_chain: {
          type: 'simple',
          content: `
            🦁 SAVANNAH FOOD CHAIN:
            
            Sun ☀️
             ↓
            Grass 🌾 (Producer)
             ↓
            Zebra 🦓 (Primary Consumer)
             ↓
            Lion 🦁 (Secondary Consumer)
             ↓
            Vulture 🦅 (Decomposer)
            
            Energy flows from sun to plants to animals!
            Everything is connected.
          `,
          altText: 'Food chain diagram showing sun, grass, zebra, lion, vulture',
          caption: 'Who eats who in the wild?'
        }
      }
    }
    
    // Try to find specific diagram
    const subjectDiagrams = diagrams[subjectLower]
    if (subjectDiagrams) {
      // Try exact concept match
      if (subjectDiagrams[conceptLower]) {
        return subjectDiagrams[conceptLower]
      }
      
      // Try first available diagram for this subject
      const firstKey = Object.keys(subjectDiagrams)[0]
      if (firstKey) {
        return subjectDiagrams[firstKey]
      }
    }
    
    // Generic fallback for any subject
    return {
      type: 'simple',
      content: `
        📐 DIAGRAM: ${concept}
        
        ┌─────────────────────┐
        │                     │
        │    ✏️ DRAW HERE     │
        │                     │
        │   Ask your teacher  │
        │   to show you this  │
        │   diagram!          │
        │                     │
        └─────────────────────┘
        
        Subject: ${subject}
        Concept: ${concept}
        
        Tip: Try drawing it yourself!
      `,
      altText: `Diagram placeholder for ${concept}`,
      caption: `Ask your teacher to draw this ${concept} diagram`,
      subject,
      concept
    }
  }
  /**
   * UPDATE learner state based on task result
   * This is how compass LEARNS and ADAPTS
   */
  private updateStateFromTask(
    learnerId: string,
    result: { completed: boolean; timeSpent: number; struggled: boolean; confidence: 'low' | 'medium' | 'high' },
    state: LearnerState
  ) {
    
    // Update time on task
    state.timeOnTask += result.timeSpent
    
    // Update attempts
    if (result.struggled) {
      state.attemptsOnConcept++
      state.consecutiveSuccesses = 0
    } else {
      state.consecutiveSuccesses = (state.consecutiveSuccesses || 0) + 1
      // Only reset attempts after 2 consecutive successes
      if (state.consecutiveSuccesses >= 2) {
        state.attemptsOnConcept = 0
        state.consecutiveSuccesses = 0
      }
    }
    
    // Update cognitive load based on performance
    if (result.struggled && result.timeSpent > 5) {
      state.cognitiveLoad = 'high'
    } else if (result.struggled && result.timeSpent > 10) {
      state.cognitiveLoad = 'overwhelmed'
    } else if (!result.struggled && result.timeSpent < 3) {
      state.cognitiveLoad = 'low'
    } else {
      state.cognitiveLoad = 'optimal'
    }
    
    // Update confidence
    state.confidenceLevel = result.confidence
    
    // Update engagement (simplified - would be more sophisticated in production)
    if (result.confidence === 'high' && !result.struggled) {
      state.engagementLevel = 'engaged'
    } else if (result.struggled && result.confidence === 'low') {
      state.engagementLevel = 'disengaged'
    }
    
    // Track concept mastery/struggles
    if (!result.struggled && result.confidence === 'high') {
      if (!state.masteredConcepts.includes(state.currentConcept)) {
        state.masteredConcepts.push(state.currentConcept)
      }
      // Remove from struggling if it was there
      state.strugglingConcepts = state.strugglingConcepts.filter(c => c !== state.currentConcept)
    } else if (result.struggled) {
      if (!state.strugglingConcepts.includes(state.currentConcept)) {
        state.strugglingConcepts.push(state.currentConcept)
      }
    }
    
    this.learnerHistory.set(learnerId, state)
  }
  
  /**
   * PRELOAD next tasks for smooth experience
   */
  private preloadNextTasks(learnerId: string, currentTask: Task, state: LearnerState) {
    // Queue up next 2 tasks based on likely progression
    // This makes the compass feel instant
    
    // In production, would generate these in background
    // For now, just clear queue - we'll generate on demand
    this.taskQueue.set(learnerId, [])
  }
  
  /**
   * CALCULATE when to check in again
   */
  private calculateCheckpoint(state: LearnerState, difficulty: number): number {
    // Check more frequently for struggling learners
    if (state.cognitiveLoad === 'overwhelmed') {
      return 2 // Check every 2 minutes
    }
    
    // Check moderately for engaged learners
    if (state.engagementLevel === 'engaged') {
      return 5 // Check every 5 minutes
    }
    
    // Default
    return 3
  }
  
  /**
   * GENERATE reason for adaptation (for transparency)
   */
  private generateReason(state: LearnerState, difficulty: number): string {
    if (state.cognitiveLoad === 'overwhelmed') {
      return "I noticed you're working really hard. Let's try something a bit easier to build confidence."
    }
    if (state.engagementLevel === 'disengaged') {
      return "Let's try a different approach to make this more interesting!"
    }
    if (difficulty === 4) {
      return "You're doing great! Here's a challenge to stretch your thinking."
    }
    return "You're making progress! Let's keep going at this level."
  }
  
  /**
   * GET appropriate encouragement
   */
  private getEncouragement(state: LearnerState): string {
    const pick = (arr: string[]) => arr[Math.floor(Math.random() * arr.length)]

    if (state.cognitiveLoad === 'overwhelmed') {
      return pick([
        "Take it one step at a time — you're doing well.",
        "No rush. Understanding takes time.",
        "You're working through something tricky — that's real learning.",
        "Slow and steady. You'll get there.",
      ])
    }
    if (state.confidenceLevel === 'high') {
      return pick([
        "You're really getting this.",
        "Nice thinking.",
        "Excellent observation.",
        "That's strong work — keep it up.",
        "You're making solid progress.",
      ])
    }
    if (state.attemptsOnConcept > 2) {
      return pick([
        "Every attempt is progress — keep going.",
        "You almost have it.",
        "That's closer than you think.",
        "Don't stop now — you're building understanding.",
      ])
    }
    return pick([
      "Keep going — you're making progress.",
      "Good effort.",
      "You're improving.",
      "That step was correct.",
      "Solid work.",
    ])
  }
  
  /**
   * GENERATE insight for parents/teachers
   */
  private generateParentInsight(state: LearnerState, task: Task): string {
    if (task.type === 'break') {
      return `${state.currentSubject} was getting challenging. A short brain break will help them return refreshed.`
    }
    if (state.cognitiveLoad === 'overwhelmed') {
      return `${state.currentSubject} concept needs reinforcement. Practice at home with real examples: ${task.content.realWorldContext}`
    }
    if (state.confidenceLevel === 'high') {
      return `${state.currentSubject} confidence is growing! Encourage them to explain today's concept to you.`
    }
    return `${state.currentSubject} practice at level ${task.difficulty}. Ask them to show you the example from today.`
  }
  
  /**
   * FALLBACK task when AI fails
   * NOW WITH DIAGRAM SUPPORT!
   */
  private getFallbackTask(
    subject: string, 
    difficulty: 1 | 2 | 3 | 4 | 5, 
    state: LearnerState,
    needsVisuals: boolean = false
  ): Task {
    
    const subjectLower = subject.toLowerCase()
    const visualSubjects = ['biology', 'agriculture', 'geography', 'physics', 'chemistry', 'integrated_science']
    const isVisualSubject = visualSubjects.includes(subjectLower)
    
    // Rich fallback tasks with diagrams
    const fallbackExamples: Record<string, any> = {
      mathematics: {
        1: {
          instruction: "Let's count items in a group.",
          example: "There are 3 items in one group and 2 in another. Together: 1,2,3 + 1,2 = 5.",
          question: "If you have a group of 2 and someone adds 3 more, how many total?",
          context: "Counting and adding are the foundation of all arithmetic."
        },
        3: {
          instruction: "Let's practice multiplication.",
          example: "A box holds 50 items. If you have 4 boxes, how many items total? 50 × 4 = 200.",
          question: "A shelf holds 100 items. You have 3 shelves. How many items can you store?",
          context: "Multiplication lets you scale up any repeated quantity quickly."
        }
      },
      biology: {
        1: {
          instruction: "Let's learn about plant cells.",
          example: "A plant cell has a strong outer wall — it acts like a firm container that holds everything inside.",
          question: "Can you name one part of a plant cell?",
          context: "Cells are the building blocks of every living organism.",
          visualAid: this.getFallbackDiagram('biology', 'plant_cell', difficulty)
        },
        3: {
          instruction: "Let's understand photosynthesis — how plants produce their own food.",
          example: "Plants capture light energy and use it to convert water and carbon dioxide into glucose.",
          question: "What three things does a plant need to make food?",
          context: "Photosynthesis is how nearly all energy enters the food chain.",
          visualAid: this.getFallbackDiagram('biology', 'photosynthesis', difficulty)
        }
      },
      geography: {
        2: {
          instruction: "Let's explore the water cycle.",
          example: "The sun heats surface water, which rises as vapor, condenses into clouds, then falls as rain.",
          question: "What happens to water after it evaporates?",
          context: "The water cycle drives weather patterns across the planet.",
          visualAid: this.getFallbackDiagram('geography', 'water_cycle', difficulty)
        }
      },
      agriculture: {
        2: {
          instruction: "Let's learn about proper crop spacing.",
          example: "Plants in rows with 30cm between each one have enough room to grow and access nutrients.",
          question: "Why is spacing plants properly important?",
          context: "Good spacing means better yields and healthier plants.",
          visualAid: this.getFallbackDiagram('agriculture', 'row_planting', difficulty)
        }
      },
      physics: {
        2: {
          instruction: "Let's learn about simple circuits.",
          example: "When a battery, wire, and bulb form a complete loop, current flows and the bulb lights up.",
          question: "What happens if you break the loop?",
          context: "Electricity needs a complete path — like water in a closed pipe.",
          visualAid: this.getFallbackDiagram('physics', 'simple_circuit', difficulty)
        }
      }
    }
    
    // Try to get subject-specific fallback
    const subjectFallback = fallbackExamples[subjectLower]
    
    if (subjectFallback) {
      const difficultyFallback = subjectFallback[difficulty] || subjectFallback[Math.min(difficulty, 3) as 1|2|3] || subjectFallback[3]
      
      if (difficultyFallback) {
        return {
          id: `fallback-${Date.now()}`,
          type: difficulty <= 2 ? 'concept_intro' : 'practice',
          subject,
          concept: 'practice',
          difficulty,
          content: {
            instruction: difficultyFallback.instruction,
            example: difficultyFallback.example,
            question: difficultyFallback.question,
            realWorldContext: difficultyFallback.context,
            visualAid: difficultyFallback.visualAid
          },
          estimatedMinutes: difficulty === 1 ? 3 : 5,
          successCriteria: "Can you explain what you learned?",
          nextTaskRecommended: "Continue practicing"
        }
      }
    }
    
    // Generic fallback for any subject
    return {
      id: `fallback-${Date.now()}`,
      type: 'practice',
      subject,
      concept: 'practice',
      difficulty,
      content: {
        instruction: `Let's practice ${subject}!`,
        example: `Think about how ${subject} concepts appear in everyday situations.`,
        question: "What did you learn today?",
        realWorldContext: `${subject} connects to many real situations.`,
        visualAid: isVisualSubject ? this.getFallbackDiagram(subject, 'general', difficulty) : undefined
      },
      estimatedMinutes: 5,
      successCriteria: "Share one thing you learned",
      nextTaskRecommended: "Continue learning"
    }
  }
  
  // ─── Default state for cold-start / no-assessment users ─────────────────────
  private createDefaultState(learnerId: string, curriculumType?: CurriculumType): LearnerState {
    return {
      learner: {
        id:                 learnerId,
        name:               'Learner',
        grade:              7,
        age:                13,
        strengths:          [],
        challenges:         [],
        interests:          [],
        recommendedPathway: null,
      },
      currentTier:          'meets_expectations',
      subjectTiers:         {},
      cognitiveLoad:        'optimal',
      engagementLevel:      'neutral',
      confidenceLevel:      'medium',
      currentSubject:       '',
      currentConcept:       '',
      timeOnTask:           0,
      attemptsOnConcept:    0,
      consecutiveSuccesses: 0,
      breaksTaken:          0,
      masteredConcepts:     [],
      strugglingConcepts:   [],
      curriculumType:       curriculumType ?? 'cbc',
      sessionGoal:          '',
      guidedTopics:         [],
      careerContext:        '',
      subjectActionSteps:   {},
      subjectVelocities:    {},
    }
  }

  // Helper methods
  private buildHistoricalData(assessments: any[]) {
    const historical: Record<string, Array<{ term: number; score: number }>> = {}
    
    assessments.forEach((assessment: any) => {
      Object.entries(assessment.subject_scores).forEach(([subject, score]) => {
        if (!historical[subject]) {
          historical[subject] = []
        }
        historical[subject].push({
          term: assessment.term,
          score: score as number
        })
      })
    })
    
    return historical
  }
  
  private calculateAge(grade: number): number {
    return grade + 6 // Approximate
  }
  
  private extractStrengths(analysis: any): string[] {
    return analysis.recommendations
      .filter((r: any) => r.tier === 'challenge' || r.tier === 'standard')
      .map((r: any) => r.subject)
  }
  
  private extractChallenges(analysis: any): string[] {
    return analysis.recommendations
      .filter((r: any) => r.tier === 'remedial' || r.tier === 'reinforcement')
      .map((r: any) => r.subject)
  }
  
  private mapOverallTier(tier: string): LearnerState['currentTier'] {
    const map: Record<string, LearnerState['currentTier']> = {
      remedial: 'below_expectations',
      reinforcement: 'approaching_expectations',
      standard: 'meets_expectations',
      challenge: 'exceeds_expectations'
    }
    return map[tier] || 'meets_expectations'
  }
  
  private mapSubjectTiers(recommendations: any[]): Record<string, string> {
    const tiers: Record<string, string> = {}
    recommendations.forEach((rec: any) => {
      tiers[rec.subject] = this.mapOverallTier(rec.tier)
    })
    return tiers
  }
// ADD THESE TWO METHODS to the LearningCompass class in lib/ai/learningCompass.ts
// Place them just before the closing brace of the class (before the singleton export)
// ─────────────────────────────────────────────────────────────────────────────

  /**
   * Restore learner state from DB into memory
   * Called at the start of each request to rebuild in-memory state
   */
  restoreState(learnerId: string, savedState: any): void {
    if (!savedState || typeof savedState !== 'object') return

    // Only restore if it looks like a valid LearnerState
    if (savedState.currentTier && savedState.learner) {
      this.learnerHistory.set(learnerId, savedState as LearnerState)
    }
  }

  /**
   * Export current learner state for DB persistence
   * Called at the end of each request to save state
   */
  exportState(learnerId: string): Partial<LearnerState> | null {
    const state = this.learnerHistory.get(learnerId)
    if (!state) return null

    // Return a clean serializable version (no circular refs)
    return {
      learner:            state.learner,
      currentTier:        state.currentTier,
      subjectTiers:       state.subjectTiers,
      cognitiveLoad:      state.cognitiveLoad,
      engagementLevel:    state.engagementLevel,
      confidenceLevel:    state.confidenceLevel,
      currentSubject:     state.currentSubject,
      currentConcept:     state.currentConcept,
      timeOnTask:           state.timeOnTask,
      attemptsOnConcept:    state.attemptsOnConcept,
      consecutiveSuccesses: state.consecutiveSuccesses,
      breaksTaken:          state.breaksTaken,
      masteredConcepts:   state.masteredConcepts,
      strugglingConcepts: state.strugglingConcepts,
    }
  }

// ─────────────────────────────────────────────────────────────────────────────
// ALSO: Add session_state column to compass_sessions table
// Run this in Supabase SQL Editor:
// ─────────────────────────────────────────────────────────────────────────────
//
// ALTER TABLE compass_sessions
//   ADD COLUMN IF NOT EXISTS session_state JSONB DEFAULT '{}',
//   ADD COLUMN IF NOT EXISTS last_subject   TEXT,
//   ADD COLUMN IF NOT EXISTS updated_at     TIMESTAMPTZ DEFAULT NOW();
//
// ─────────────────────────────────────────────────────────────────────────────
}

// Singleton instance for app-wide use
export const learningCompass = new LearningCompass()