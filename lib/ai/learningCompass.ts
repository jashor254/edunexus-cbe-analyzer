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
    'creative_arts', 'pre_technical'
  ]
  
  /**
   * Initialize compass with learner's assessment data
   * This is where it all begins - compass now KNOWS the learner
   */
  async initializeFromAssessments(
    learnerId: string,
    assessments: any[],
    interests: any
  ): Promise<Learner> {
    // 1. Run full performance analysis
    const latestAssessment = assessments[0]
    const historicalData = this.buildHistoricalData(assessments)
    const analysis = analyzePerformance(latestAssessment.subject_scores, historicalData)
    
    // 2. Build learner profile with assessment context
    const learner: Learner = {
      id: learnerId,
      name: latestAssessment.students.name,
      grade: latestAssessment.students.grade,
      age: this.calculateAge(latestAssessment.students.grade),
      strengths: this.extractStrengths(analysis),
      challenges: this.extractChallenges(analysis),
      interests: interests?.interests || [],
      dreamCareer: interests?.dream_career
    }
    
    // 3. Initialize learner state WITH learner reference
    const initialState: LearnerState = {
      learner: learner,
      currentTier: this.mapOverallTier(analysis.overallTier),
      subjectTiers: this.mapSubjectTiers(analysis.recommendations),
      cognitiveLoad: 'optimal',
      engagementLevel: 'neutral',
      confidenceLevel: 'medium',
      currentSubject: '',
      currentConcept: '',
      timeOnTask: 0,
      attemptsOnConcept: 0,
      consecutiveSuccesses: 0,
      breaksTaken: 0,
      masteredConcepts: [],
      strugglingConcepts: [],
      curriculumType: 'cbc'
    }

    this.learnerHistory.set(learnerId, initialState)
    
    return learner
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

    // 1. Get current learner state
    const state = this.learnerHistory.get(learnerId)
    if (!state) throw new Error('Learner not initialized')

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
        task: "Stand up and touch your toes 5 times! 🏃",
        duration: 2
      },
      {
        type: 'fun_fact',
        task: "Did you know? A hippo's yawn means 'go away'! 😮",
        duration: 1
      },
      {
        type: 'quick_game',
        task: "How many blue things can you see around you? Count them! 🔵",
        duration: 2
      },
      {
        type: 'stretch',
        task: "Stretch your arms high like a giraffe eating leaves! 🦒",
        duration: 2
      },
      {
        type: 'joke',
        task: "Why did the matatu cross the road? To get to the other side! 🚌😂",
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
      encouragement: "Pumzika kidogo! Rest a bit then come back stronger! 💪",
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
    const task = await this.createTaskForDifficulty(subject, difficulty, state, needsVisuals, ragSystemPrompt)

    return task
  }
  
  /**
   * CREATE task at specific difficulty level
   * This is where subject mastery, Kenyan context, and VISUALS come together
   */
  private async createTaskForDifficulty(
    subject: string,
    difficulty: 1 | 2 | 3 | 4 | 5,
    state: LearnerState,
    needsVisuals: boolean = false,
    ragSystemPrompt?: string
  ): Promise<Task> {

    // Build prompt for DeepSeek to generate appropriate task
    const prompt = this.buildTaskPrompt(subject, difficulty, state, needsVisuals, state.curriculumType || 'cbc')

    try {
      const response = await callDeepSeek(prompt, ragSystemPrompt)  // Changed to DeepSeek
      const task = this.parseTaskResponse(response, subject, difficulty, state)
      
      // If it's a visual subject but no visual was generated, add a fallback
      if (needsVisuals && !task.content.visualAid) {
        task.content.visualAid = await this.generateDiagram(subject, task.concept, difficulty)
      }
      
      return task
    } catch (error) {
      console.error('Task generation failed, using fallback:', error)
      return this.getFallbackTask(subject, difficulty, state, needsVisuals)
    }
  }
  
  /**
   * GENERATE diagram for visual subjects
   * This is where the magic happens for Biology, Geography, Agriculture, etc!
   */
  private async generateDiagram(
    subject: string, 
    concept: string, 
    difficulty: 1 | 2 | 3 | 4 | 5
  ): Promise<VisualAid> {
    
    const diagramPrompt = `
      Create a simple ASCII/Unicode diagram for a Kenyan student learning:
      
      Subject: ${subject}
      Concept: ${concept}
      Difficulty Level: ${difficulty} (1=simplest, 5=most detailed)
      
      The diagram should be:
      - Clear and easy to understand
      - Use simple ASCII characters (+, -, |, /, \, ┌, ┐, └, ┘, ├, ┤, ─, │, etc.)
      - Include labels with emojis where helpful
      - Max 15 lines
      - Use Kenyan context where possible
      
      IMPORTANT: Return ONLY the diagram text, no explanations.
      
      Examples of good diagrams:
      
      For Plant Cell (Biology):
      ┌─────────────────────┐
      │  ┌───────────────┐  │
      │  │    Nucleus    │  │
      │  │      ☢️       │  │
      │  └───────────────┘  │
      │    🌿 Chloroplast   │
      │    💧 Vacuole       │
      └─────────────────────┘
      Cell Wall (outside)
      
      For Water Cycle (Geography):
          ☁️ Clouds
           ↑  ↓
      💧 Lake → Rain
           ↓
      🌊 River
      
      For Simple Circuit (Physics):
      [Battery]───[Bulb]───[Switch]
          ↑                    ↓
          └──────────┘
      
      For Maize Planting (Agriculture):
      🌱──30cm──🌱──30cm──🌱
       │        │        │
      60cm      60cm      60cm
       │        │        │
      🌱──30cm──🌱──30cm──🌱
    `
    
    try {
      const diagramText = await callDeepSeek(diagramPrompt)  // Changed to DeepSeek
      
      return {
        type: 'simple',
        content: diagramText.trim(),
        altText: `${concept} diagram for ${subject}`,
        caption: `${subject} - ${concept}`,
        subject,
        concept
      }
    } catch (error) {
      console.error('Diagram generation failed, using fallback:', error)
      return this.getFallbackDiagram(subject, concept, difficulty)
    }
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
            💧 WATER CYCLE IN KENYA 💧
            
                 ☁️ CLOUDS
                  ↑  ↓
            LAKE VICTORIA → RAIN
            (Evaporation)  ↓
                      RIVERS flow
                        ↓
                    INDIAN OCEAN
                        
            Process: Sun heats water → Evaporation → 
            Condensation → Clouds → Rain → Rivers → Back to ocean
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
            🌤️ WEATHER SYMBOLS:
            
            ☀️ Sunny      (Jua kali)
            ⛅ Partly     (Mawingu kidogo)
            ☁️ Cloudy     (Mawingu mengi)
            🌧️ Rain       (Mvua)
            ⚡ Thunder    (Ngurumo)
            🌈 Rainbow    (Upindi)
            
            Nairobi today: ⛅ 24°C
            Mombasa:       ☀️ 30°C
            Kisumu:        🌧️ 26°C
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
            ♻️ MAKING COMPOST:
            
            LAYERS IN THE PIT:
            ┌─────────────────┐
            │ 🌿 Dry leaves   │ ← Top
            ├─────────────────┤
            │ 🥬 Kitchen waste│
            ├─────────────────┤
            │ 🌱 Fresh grass  │
            ├─────────────────┤
            │   Soil + Ash    │
            ├─────────────────┤
            │ 💧 Water (moist)│
            └─────────────────┘
            
            Mix every 2 weeks!
            After 3 months: 🪴 Rich soil for shamba
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
            
            Examples: Jembe, crowbar, see-saw
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
   * BUILD task prompt with specific difficulty instructions
   */
  private buildTaskPrompt(
    subject: string,
    difficulty: 1 | 2 | 3 | 4 | 5,
    state: LearnerState,
    needsVisuals: boolean = false,
    curriculumType: CurriculumType = 'cbc'
  ): string {
    
    // DIFFICULTY LEVEL DEFINITIONS
    const difficultyDescriptions = curriculumType === 'igcse' ? {
      1: `FOUNDATION - Grade E-G level (needs support)
- Break into small steps using Cambridge foundation style
- Use simple vocabulary; every sentence max 10 words
- Focus on one key fact or skill at a time
- Cambridge command word: "State" or "Identify"
- Success = they can recall a key fact`,
      2: `DEVELOPING - Grade C-D level (approaching target)
- Clear step-by-step approach
- One worked example in Cambridge exam style
- Connect to something already known
- Cambridge command words: "Describe" or "Outline"
- Success = they can follow and apply the example`,
      3: `ACHIEVING - Grade B-C level (meeting expectations)
- Standard Cambridge IGCSE difficulty
- Require application of knowledge to a scenario
- Cambridge command words: "Explain" or "Calculate"
- Success = they can apply to similar exam questions`,
      4: `EXCEEDING - Grade A level (above expectations)
- Push analytical and evaluative thinking
- Require connecting multiple ideas or concepts
- Cambridge command words: "Analyse" or "Compare"
- Success = they can justify and explain their reasoning`,
      5: `DISTINCTION - Grade A* level (outstanding)
- Complex multi-step problems requiring synthesis
- Evaluation, judgement, and extended writing
- Cambridge command word: "Evaluate" or "To what extent..."
- Success = they can construct a well-argued response`
    } : {
      1: `EXTREMELY SIMPLE - For learners BELOW expectations
- Break into TINY steps (max 2-3 steps)
- Use ONLY basic vocabulary
- Every sentence max 8 words
- Include a picture or emoji for each step
- Example MUST be from daily Kenyan life
- Celebrate each micro-step
- Success = they can do one tiny piece`,

      2: `SIMPLE - For learners APPROACHING expectations
- Clear, straightforward steps
- Simple vocabulary
- One clear example
- Connect to things they already know
- Success = they can follow the example`,

      3: `GRADE LEVEL - For learners MEETING expectations
- Standard difficulty for Grade ${state.learner.grade}
- Mix of simple and slightly challenging
- Require some thinking but not too much
- Success = they can apply to similar problems`,

      4: `CHALLENGING - For learners EXCEEDING expectations
- Push them to think deeper
- Require connecting multiple ideas
- Ask "what if" questions
- Success = they can explain their reasoning
- NOT TOO HARD - keep them engaged, not frustrated`,

      5: `ADVANCED - Only for learners who've MASTERED level 4
- Complex problems requiring synthesis
- Multiple steps with reasoning
- Success = they can teach someone else
- Use sparingly! Only when truly ready`
    }
    
    const visualInstruction = needsVisuals ? `
IMPORTANT: This subject NEEDS VISUAL DIAGRAMS!
After your explanation, include a SIMPLE ASCII DIAGRAM using:
- Box drawing characters: ┌ ┐ └ ┘ ├ ┤ ─ │
- Emojis for objects: 🌱 🌿 ☀️ 💧 🔧 ⚡
- Labels showing parts

Example format:
EXPLANATION: [your text]

DIAGRAM:
┌─────────────────┐
│  ☢️ Nucleus     │
│  💧 Vacuole     │
│  🌿 Chloroplast │
└─────────────────┘
` : ''
    
    return `
You are the Learning Compass creating a PERFECT task for a Kenyan student.

SUBJECT: ${subject}
DIFFICULTY LEVEL: ${difficulty} - ${difficultyDescriptions[difficulty]}

STUDENT CONTEXT:
- Name: ${state.learner.name}
- Grade: ${state.learner.grade}
- Current Tier: ${state.currentTier}
- Struggling with: ${state.strugglingConcepts.join(', ') || 'nothing specific'}
- Good at: ${state.masteredConcepts.join(', ') || 'willing to learn'}
- Interests: ${state.learner.interests.join(', ') || 'learning through stories'}
- Dream Career: ${state.learner.dreamCareer || 'not sure yet'}

${curriculumType === 'igcse' ? `🌍 CONTEXT GUIDELINES (Cambridge IGCSE student):
- Use international examples primarily (London, New York, Tokyo, Nairobi)
- Reference Cambridge exam style: structured questions, mark schemes
- Connect concepts to global contexts and international data
- Frame progress in Cambridge grade terms (targeting Grade C and above, pushing for A/A*)
- Phrases: "Well done!", "Excellent effort!", "Keep pushing for that A*!", "Good thinking!"
- Mention real-world global applications (e.g., multinational companies, international research)
- For exam questions: use command words (Describe, Explain, Analyse, Evaluate, Calculate)` : `🇰🇪 KENYAN CONTEXT (MUST USE THESE):
- Places: Nairobi, Mombasa, Kisumu, Eldoret, local market, shamba, duka
- Transport: matatu, boda boda, tuk-tuk, train
- Food: ugali, sukuma, nyama choma, chai, mandazi, mangoes
- Money: KES (coins: 1,5,10,20 | notes: 50,100,200,500,1000)
- Names: Wanjiku, Otieno, Achieng, Kamau, Njeri, Juma
- Phrases: "Sawa!", "Vizuri sana!", "Hongera!", "Jaribu tena!"`}

${visualInstruction}

CREATE A TASK WITH:

1. INSTRUCTION: Clear, step-by-step what to do
2. EXAMPLE: Real Kenyan situation showing how
3. QUESTION: What to solve/practice (if applicable)
4. VISUAL AID: ${needsVisuals ? 'INCLUDE a simple ASCII diagram using box characters' : 'Description of helpful image (optional)'}
5. REAL-WORLD CONTEXT: Explain why this matters in Kenya

RESPOND WITH JSON:
{
  "instruction": "...",
  "example": "...",
  "question": "...",
  "visualAid": "${needsVisuals ? 'ASCII diagram here' : ''}",
  "realWorldContext": "...",
  "successCriteria": "..."
}

CRITICAL TEACHING RULES — ALWAYS FOLLOW:
- NEVER give the answer directly on first ask
- ALWAYS respond with a guiding question first
- After student attempts: give a HINT not the answer
- After 3 failed attempts: show worked example + give a similar NEW problem to try
- Response format must be:
  "What do you think would happen if...?"
  "You're very close! What about the second step?"
  "Interesting approach — why did you choose that?"
- Celebrate effort always:
  "Vizuri! Your thinking is right, let's refine it"
  "Jaribu tena! Every attempt makes you stronger"
- NEVER say "Wrong" — say "Almost!" or "Good try!"
- For struggling students (difficulty 1-2):
  Break into ONE tiny step at a time
  Ask ONE question only per response
- For excelling students (difficulty 4-5):
  Ask multi-step reasoning questions
  "Can you explain WHY that works?"
  "How would you teach this to a friend?"
`
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
    if (state.cognitiveLoad === 'overwhelmed') {
      return "Pole pole ndio mwendo! Slow and steady wins the race. You can do this! 💪"
    }
    if (state.confidenceLevel === 'high') {
      return "Vizuri sana! You're on fire today! 🔥 Hongera!"
    }
    if (state.attemptsOnConcept > 2) {
      return "Jaribu tena! Every attempt makes you stronger. I believe in you! 🌟"
    }
    return "Sawa sawa! Keep going - you're doing great! 🚀"
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
          instruction: "Let's count mangoes! 🥭",
          example: "Mama has 3 mangoes. Baba gives her 2 more. Let's count together: 1,2,3... + 1,2 = 5!",
          question: "If you have 2 mangoes and your friend gives you 3, how many do you have?",
          context: "Counting happens every day at the market!"
        },
        3: {
          instruction: "Let's practice multiplication with matatu fares!",
          example: "A matatu ride costs KES 50. If you take 4 rides in a week, how much do you spend? 50 × 4 = 200",
          question: "If a boda boda ride costs KES 100 and you take it 3 times, how much do you pay?",
          context: "Knowing multiplication helps you budget for transport!"
        }
      },
      biology: {
        1: {
          instruction: "Let's learn about plant cells!",
          example: "A plant cell has a strong outer wall, like a fence around a shamba.",
          question: "Can you point to where the nucleus might be?",
          context: "Plants are all around us in Kenya - in our farms, gardens, and forests!",
          visualAid: this.getFallbackDiagram('biology', 'plant_cell', difficulty)
        },
        3: {
          instruction: "Let's understand photosynthesis - how plants make their own food!",
          example: "Just like how you need ugali to get energy, plants need sunlight, water, and air.",
          question: "What three things does a plant need to make food?",
          context: "This happens in every plant around us - from the maize in the farm to the trees in the park!",
          visualAid: this.getFallbackDiagram('biology', 'photosynthesis', difficulty)
        }
      },
      geography: {
        2: {
          instruction: "Let's explore the water cycle!",
          example: "The sun heats water in Lake Victoria, it rises as vapor, forms clouds, then rains in the mountains.",
          question: "What happens after water evaporates?",
          context: "This is why it rains in different parts of Kenya throughout the year!",
          visualAid: this.getFallbackDiagram('geography', 'water_cycle', difficulty)
        }
      },
      agriculture: {
        2: {
          instruction: "Let's learn about proper planting!",
          example: "Farmer Kamau plants maize in rows. He leaves 30cm between each plant so they have room to grow.",
          question: "Why is it important to space plants properly?",
          context: "Good spacing means bigger harvest and healthier plants!",
          visualAid: this.getFallbackDiagram('agriculture', 'row_planting', difficulty)
        }
      },
      physics: {
        2: {
          instruction: "Let's learn about simple circuits!",
          example: "When you connect a battery, wire, and bulb in a circle, the bulb lights up!",
          question: "What happens if you break the circle?",
          context: "Electricity needs a complete path, like water in a pipe!",
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
        example: `Think about ${subject} in your daily life.`,
        question: "What did you learn today?",
        realWorldContext: `${subject} is all around us in Kenya!`,
        visualAid: isVisualSubject ? this.getFallbackDiagram(subject, 'general', difficulty) : undefined
      },
      estimatedMinutes: 5,
      successCriteria: "Share one thing you learned",
      nextTaskRecommended: "Continue learning"
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
  
  private parseTaskResponse(
    response: string, 
    subject: string, 
    difficulty: number,
    state: LearnerState
  ): Task {
    try {
      const parsed = JSON.parse(response)
      const needsVisuals = this.visualSubjects.includes(subject.toLowerCase())
      
      const task: Task = {
        id: `task-${Date.now()}`,
        type: difficulty <= 2 ? 'concept_intro' : difficulty >= 4 ? 'challenge' : 'practice',
        subject,
        concept: 'current',
        difficulty: difficulty as 1 | 2 | 3 | 4 | 5,
        content: {
          instruction: parsed.instruction || 'Let\'s learn something new!',
          example: parsed.example,
          question: parsed.question,
          realWorldContext: parsed.realWorldContext || 'This is useful in Kenya!'
        },
        estimatedMinutes: difficulty === 1 ? 3 : difficulty === 2 ? 4 : difficulty === 3 ? 5 : 6,
        successCriteria: parsed.successCriteria || 'Can you explain this?',
        nextTaskRecommended: 'continue'
      }
      
      // Add visual aid if provided or needed
      if (parsed.visualAid && parsed.visualAid.length > 10) {
        task.content.visualAid = {
          type: 'simple',
          content: parsed.visualAid,
          altText: `Diagram for ${subject}`,
          caption: `${subject} diagram`,
          subject,
          concept: 'current'
        }
      } else if (needsVisuals && !task.content.visualAid) {
        // Add fallback diagram for visual subjects
        task.content.visualAid = this.getFallbackDiagram(subject, 'general', difficulty as 1|2|3|4|5)
      }
      
      return task
    } catch (error) {
      console.error('Failed to parse task response:', error)
      return this.getFallbackTask(subject, difficulty as 1|2|3|4|5, state, 
        this.visualSubjects.includes(subject.toLowerCase()))
    }
  }// ─────────────────────────────────────────────────────────────────────────────
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