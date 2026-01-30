import { NextRequest, NextResponse } from 'next/server';
import { GuardianTutor } from '@/lib/ai/GuardianTutor';

export async function POST(req: NextRequest) {
  try {
    // 1. Jaribu kusoma body
    const body = await req.json().catch(() => ({}));
    console.log("📥 Incoming Data:", body);

    // 2. Toa vigezo na uweke 'fallbacks' (default values)
    const { 
      message, 
      subjectId = 'mathematics', 
      grade = 7, 
      conversationHistory = [] 
    } = body;

    // 3. Hakikisha message ipo, isipokuwepo toa error ya kueleweka
    if (!message) {
      return NextResponse.json(
        { error: 'Message is required' }, 
        { status: 400 }
      );
    }

    // 4. Muite GuardianTutor
    const response = await GuardianTutor.generateResponse({
      subjectId,
      studentGrade: grade,
      studentLevel: 2,
      question: message,
      conversationHistory
    });

    return NextResponse.json({ text: response });

  } catch (error: any) {
    console.error('🔴 API ROUTE CRASH:', error.message);
    
    // Rudisha error message halisi ili tuione kwenye browser
    return NextResponse.json(
      { error: error.message || 'Internal Server Error' }, 
      { status: 500 }
    );
  }
}