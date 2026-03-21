import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server'; // Tumia ile helper ya server!
import { careerMatcher } from '@/lib/academicClinic/careerMatcher';

export async function POST(req: NextRequest) {
  try {
    // 1. Authenticate the User (Parent/Guardian)
    const supabase = await createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { studentId, action, careerName } = await req.json();

    if (!studentId) {
      return NextResponse.json({ error: 'Student ID required' }, { status: 400 });
    }

    // 2. Security Check: Je, huyu student ni wa huyu user aliyelog-in?
    const { data: student, error: studentError } = await supabase
      .from('students')
      .select('id')
      .eq('id', studentId)
      .eq('user_id', user.id) // Muhimu sana!
      .single();

    if (studentError || !student) {
      return NextResponse.json({ error: 'Student not found or access denied' }, { status: 403 });
    }

    // 3. Process the AI Matching
    let result;

    switch (action) {
      case 'full-assessment':
        // Hii inatumia DeepSeek/Gemini kupiga mahesabu ya CBC subjects vs Careers
        result = await careerMatcher.generateMatches(studentId);
        break;
      
      case 'specific-career':
        if (!careerName) {
          return NextResponse.json({ error: 'Career name required' }, { status: 400 });
        }
        result = await careerMatcher.assessSpecificCareer(studentId, careerName);
        break;
      
      default:
        result = await careerMatcher.generateMatches(studentId);
    }

    // 4. Return the result to the Dashboard
    return NextResponse.json(result);

  } catch (error: any) {
    console.error('Career matching error:', error);
    return NextResponse.json(
      { error: 'Failed to generate career matches. Please try again later.' },
      { status: 500 }
    );
  }
}
