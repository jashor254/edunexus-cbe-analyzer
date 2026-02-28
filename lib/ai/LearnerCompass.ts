// lib/ai/LearningCompass.ts
// 🧠 The Guardian Tutor Brain - Adaptive Learning Engine
// Updated to use Google Gemini (faster & cheaper!)

import { callGemini } from './gemini'

// ==================== TYPES ====================

export interface LearnerState {
  cognitiveLoad: 'low' | 'optimal' | 'high' | 'overwhelmed'
  strugglingConcepts: string[]
  strengthAreas: string[]
  engagementLevel: 'disengaged' | 'neutral' | 'engaged' | 'excited'
}

export interface TutorResponse {
  message: string
  encouragement: string
  nextSteps: string[]
  parentInsight: string
  visualAid?: string
}

// ==================== THE ENGINE ====================

export class LearningCompass {
  
  async teach(
    studentName: string,
    grade: number,
    question: string,
    conversationHistory: Array<{role: 'user' | 'assistant', content: string}> = []
  ): Promise<TutorResponse> {
    
    const learnerState = this.analyzeLearner(question, conversationHistory)
    const systemPrompt = this.buildPrompt(studentName, grade, learnerState)
    
    // Prepare conversation history for Gemini
    const historyText = conversationHistory
      .slice(-6) // Last 3 exchanges
      .map(m => `${m.role}: ${m.content}`)
      .join('\n')
    
    const fullPrompt = `
${systemPrompt}

PREVIOUS CONVERSATION:
${historyText}

STUDENT QUESTION: ${question}

YOUR RESPONSE:
    `.trim()

    try {
      // Use GEMINI instead of OpenAI (faster & cheaper!)
      const rawResponse = await callGemini(fullPrompt)
      
      return this.parseResponse(rawResponse, learnerState)
      
    } catch (error) {
      console.error('Gemini Error:', error)
      
      // Fallback response
      return {
        message: `Hi ${studentName}! I'd love to help you with that. Can you tell me a bit more about what you're working on? 🤔`,
        encouragement: 'Great question! Let\'s figure this out together.',
        nextSteps: ['Tell me which part is confusing', 'Share your current understanding'],
        parentInsight: `${studentName} is exploring a new concept. Encourage them to explain their thinking process.`
      }
    }
  }

  private analyzeLearner(
    question: string,
    history: Array<{role: string, content: string}>
  ): LearnerState {
    
    const questionLower = question.toLowerCase()
    
    // Detect frustration
    const frustrationWords = ['don\'t understand', 'confused', 'stuck', 'help', 'hard', 'difficult']
    const isFrustrated = frustrationWords.some(word => questionLower.includes(word))
    
    // Detect confidence
    const confidentWords = ['i think', 'maybe', 'could it be', 'is this right']
    const isConfident = confidentWords.some(word => questionLower.includes(word))
    
    // Detect engagement
    const engagedWords = ['why', 'how', 'what if', 'can you explain']
    const isEngaged = engagedWords.some(word => questionLower.includes(word))
    
    // Determine cognitive load
    let cognitiveLoad: LearnerState['cognitiveLoad'] = 'optimal'
    if (isFrustrated) cognitiveLoad = 'overwhelmed'
    else if (isConfident && isEngaged) cognitiveLoad = 'low'
    
    // Engagement level
    let engagementLevel: LearnerState['engagementLevel'] = 'neutral'
    if (isEngaged) engagementLevel = 'engaged'
    if (isFrustrated && history.length > 4) engagementLevel = 'disengaged'
    
    return {
      cognitiveLoad,
      strugglingConcepts: isFrustrated ? ['Current topic'] : [],
      strengthAreas: isConfident ? ['Problem-solving'] : [],
      engagementLevel
    }
  }

  private buildPrompt(
    studentName: string,
    grade: number,
    state: LearnerState
  ): string {
    
    const age = grade + 5
    const isYoung = grade <= 6
    
    // Adaptive teaching strategy
    let strategy = ''
    if (state.cognitiveLoad === 'overwhelmed') {
      strategy = `
🚨 STUDENT IS STRUGGLING - RESCUE MODE:
- Break down into TINY steps
- Use super simple language
- Give lots of encouragement
- Ask: "What's the first small thing we can figure out?"
- Celebrate every micro-win
      `
    } else if (state.cognitiveLoad === 'low') {
      strategy = `
🎯 STUDENT IS READY FOR CHALLENGE:
- Ask deeper "why" and "how" questions
- Introduce slight complexity
- Connect to real-world applications
- Encourage them to teach you back
      `
    } else {
      strategy = `
✅ OPTIMAL LEARNING ZONE:
- Clear step-by-step guidance
- Check understanding frequently
- Balance explanation with questions
- Build confidence through success
      `
    }

    return `
You are Mwalimu - Kenya's most patient and encouraging CBC tutor. You're chatting with ${studentName}, a Grade ${grade} student (about ${age} years old).

${strategy}

🇰🇪 KENYAN CONTEXT (CRITICAL):
- Use Kenyan examples: matatu rides, ugali cooking, Nairobi traffic, shamba work, KES currency
- Mix English with Swahili encouragement: "Sawa!", "Vizuri sana!", "Hongera!", "Jaribu tena!"
- Reference local places: Kibera, Mombasa, Kisumu, Nakuru, Mt. Kenya
- Use Kenyan names in examples: Wanjiku, Otieno, Achieng, Kamau, Njeri

📚 CBC COMPETENCIES:
- Communication & Collaboration
- Critical Thinking & Problem Solving
- Creativity & Imagination
- Learning to Learn
- Digital Literacy

🎓 YOUR TEACHING STYLE:
${isYoung ? `
- VERY simple words (max 12 words per sentence)
- Use emojis frequently 😊📝✨
- Relate to games, family, school life
- Ask yes/no questions first
- Praise effort, not just correctness
` : `
- Clear, grade-appropriate language
- Occasional emojis for emphasis
- Connect to real-world careers
- Ask open-ended questions
- Encourage deeper thinking
`}

🗣️ RESPONSE FORMAT (STRICT):

1. Start with warm greeting using their name
2. Acknowledge their question/struggle with empathy
3. Teach using ONE of these methods:
   ${state.cognitiveLoad === 'overwhelmed' ? 
     '- Break concept into 3 micro-steps with checkpoints' : 
     '- Give clear explanation with Kenyan example'}
4. Check understanding with a specific question
5. End with Swahili encouragement + next micro-goal

📝 EXAMPLE STRUCTURE:

"Hi ${studentName}! 👋

[Empathy line: "I can see why that's tricky..." or "Great question!"]

[Teaching moment with local example]
For example: Imagine you're helping mama count KES at the duka...

[Check understanding]
Je, can you try this: [specific micro-task]?

Hongera for asking! 🌟 You're getting better every day.

[Parent tip for tonight]"

⚠️ SAFETY RULES:
- NEVER say "wrong" - say "almost!" or "let's look again"
- If student is frustrated: Slow down, simplify, encourage
- If question is off-topic: Gently redirect to learning
- Keep responses under 150 words for young learners
- Always end positively with concrete next step

🎯 GOALS FOR THIS RESPONSE:
- Build ${studentName}'s confidence
- Make learning feel achievable
- Connect to their Kenyan life
- Give parents actionable insight
- Create momentum for next question

Ready to teach? Make this response count! 🚀
    `.trim()
  }

  private parseResponse(raw: string, state: LearnerState): TutorResponse {
    
    // Extract parent insight (usually at end)
    const parentMatch = raw.match(/\[Parent tip:?\]?\s*(.+?)(?:\n|$)/i)
    const parentInsight = parentMatch?.[1] || 
      state.cognitiveLoad === 'overwhelmed' 
        ? 'Tonight, ask them to explain one thing they learned. Celebrate their effort, not perfection.'
        : 'Ask them to teach you what they learned today. Teaching helps cement understanding.'
    
    // Generate encouragement based on state
    const encouragements = {
      overwhelmed: ['You\'re doing great by asking for help! 💪', 'Every expert was once a beginner', 'Pole pole ndio mwendo! (Slowly but surely!)'],
      low: ['Ready for something trickier? 🎯', 'You\'re crushing this!', 'Hongera! Let\'s level up!'],
      optimal: ['Vizuri sana! Keep going!', 'You\'re on the right track!', 'Sawa! One more step...'],
      high: ['Jaribu tena! You\'ve got this!', 'Take your time, think it through', 'Almost there, keep trying!']
    }
    
    const encouragement = encouragements[state.cognitiveLoad][
      Math.floor(Math.random() * encouragements[state.cognitiveLoad].length)
    ]
    
    // Generate next steps
    const nextSteps = this.generateNextSteps(raw, state)
    
    return {
      message: raw.replace(/\[Parent tip:?\].+$/i, '').trim(),
      encouragement,
      nextSteps,
      parentInsight
    }
  }

  private generateNextSteps(response: string, state: LearnerState): string[] {
    
    if (state.cognitiveLoad === 'overwhelmed') {
      return [
        'Take a deep breath and try the first small step',
        'Ask if you need me to explain differently',
        'Practice this one part before moving on'
      ]
    }
    
    if (state.cognitiveLoad === 'low') {
      return [
        'Try a harder version of this problem',
        'Explain how you solved it in your own words',
        'Can you create your own example?'
      ]
    }
    
    return [
      'Practice one more similar problem',
      'Explain your thinking process',
      'Ask me if anything is unclear'
    ]
  }
}

// Singleton instance
export const learningCompass = new LearningCompass()