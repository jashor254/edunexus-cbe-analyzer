// app/api/chat/route.ts
import { NextResponse } from 'next/server'
import { learningCompass } from '@/lib/ai/learningCompass'
import { createClient } from '@/lib/supabase/server'

export async function POST(req: Request) {
  try {
    const { message, studentId, sessionState } = await req.json()

    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Check token balance
    const { data: tokenData } = await supabase
      .from('user_tokens')
      .select('balance')
      .eq('user_id', user.id)
      .maybeSingle()

    if (!tokenData || tokenData.balance < 1) {
      return NextResponse.json({ 
        success: false, 
        error: 'Insufficient tokens' 
      }, { status: 403 })
    }

    // Detect struggle/confidence from message
    const struggled = message.toLowerCase().includes('don\'t understand') || 
                      message.toLowerCase().includes('confused') ||
                      message.toLowerCase().includes('help') ||
                      message.toLowerCase().includes('sijaelewa') ||
                      message.toLowerCase().includes('hard') ||
                      message.toLowerCase().includes('tough')

    let confidence: 'low' | 'medium' | 'high' = 'medium'
    if (message.toLowerCase().includes('got it') || 
        message.toLowerCase().includes('understand') ||
        message.toLowerCase().includes('easy') ||
        message.toLowerCase().includes('nimeelewa')) {
      confidence = 'high'
    } else if (struggled) {
      confidence = 'low'
    }

    // Detect subject
    let subject = 'mathematics'
    const subjectKeywords: Record<string, string[]> = {
      mathematics: ['math', 'algebra', 'fraction', 'percentage', 'geometry', 'numbers'],
      english: ['english', 'grammar', 'reading', 'writing', 'story'],
      kiswahili: ['kiswahili', 'sarufi', 'insha', 'kusoma'],
      biology: ['biology', 'cell', 'plant', 'animal', 'heart', 'lungs'],
      chemistry: ['chemistry', 'atom', 'molecule', 'reaction'],
      physics: ['physics', 'force', 'energy', 'electricity', 'circuit'],
      geography: ['geography', 'map', 'weather', 'climate', 'river'],
      agriculture: ['agriculture', 'farm', 'crop', 'soil', 'planting']
    }

    for (const [subj, keywords] of Object.entries(subjectKeywords)) {
      if (keywords.some(k => message.toLowerCase().includes(k))) {
        subject = subj
        break
      }
    }

    // Get response from Learning Compass
    const compassResponse = await learningCompass.getNextTask(
      studentId || user.id,
      subject,
      {
        completed: true,
        timeSpent: sessionState?.timeOnTask || 0,
        struggled: struggled,
        confidence: confidence
      }
    )

    // Deduct token
    await supabase
      .from('user_tokens')
      .update({ balance: tokenData.balance - 1 })
      .eq('user_id', user.id)

    // Log interaction
    await supabase
      .from('chat_logs')
      .insert({
        user_id: user.id,
        student_id: studentId,
        message,
        response: compassResponse.task.content.instruction,
        tokens_used: 1,
        subject: subject,
        difficulty: compassResponse.task.difficulty,
        metadata: {
          strategy: compassResponse.task.type,
          struggled,
          confidence
        }
      })

    // Format response
    const formattedResponse = {
      text: compassResponse.task.content.instruction + 
            (compassResponse.task.content.example ? `\n\n📌 For example: ${compassResponse.task.content.example}` : '') +
            (compassResponse.task.content.question ? `\n\n✏️ Try this: ${compassResponse.task.content.question}` : '') +
            `\n\n💡 ${compassResponse.encouragement}`,
      
      visualAid: compassResponse.task.content.visualAid || null,
      
      pedagogy: {
        strategy: compassResponse.task.type,
        checkForUnderstanding: compassResponse.task.successCriteria
      },
      
      parentInsight: {
        conceptAttempted: compassResponse.task.concept,
        childApproach: `Working at difficulty level ${compassResponse.task.difficulty}`,
        celebrationMoment: compassResponse.encouragement,
        practiceIdea: compassResponse.parentInsight,
        emotionDetected: struggled ? 'needs support' : confidence === 'high' ? 'confident' : 'engaged'
      },
      
      nextSteps: [
        `Complete this task (${compassResponse.task.estimatedMinutes} min)`,
        compassResponse.task.nextTaskRecommended
      ],
      
      encouragement: compassResponse.encouragement,
      
      metadata: {
        difficultyLevel: compassResponse.task.difficulty,
        timeEstimate: compassResponse.task.estimatedMinutes,
        visualProvided: !!compassResponse.task.content.visualAid
      },
      
      sessionUpdate: {
        timeOnTask: (sessionState?.timeOnTask || 0) + compassResponse.task.estimatedMinutes,
        currentSubject: subject,
        currentConcept: compassResponse.task.concept,
        needsBreak: compassResponse.needsBreak,
        breakDuration: compassResponse.breakDuration
      }
    }

    return NextResponse.json({ 
      success: true, 
      response: formattedResponse 
    })

  } catch (error) {
    console.error('Chat API Error:', error)
    return NextResponse.json({ 
      success: false, 
      error: 'Internal server error' 
    }, { status: 500 })
  }
}