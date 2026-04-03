import { NextRequest } from 'next/server';
import { apiSuccess, apiError, apiUnauthorized, apiForbidden, apiBadRequest } from '@/lib/api/response';
import { createClient } from '@/utils/supabase/server';
import { careerMatcher } from '@/lib/academicClinic/careerMatcher';

export async function POST(req: NextRequest) {
  try {
    // 1. Authenticate the User (Parent/Guardian)
    const supabase = await createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
      return apiUnauthorized();
    }

    const { studentId, action, careerName } = await req.json();

    if (!studentId) {
      return apiBadRequest('Student ID required');
    }

    // 2. Security Check: Je, huyu student ni wa huyu user aliyelog-in?
    const { data: student, error: studentError } = await supabase
      .from('students')
      .select('id')
      .eq('id', studentId)
      .eq('user_id', user.id) // Muhimu sana!
      .single();

    if (studentError || !student) {
      return apiForbidden();
    }

    // 3. Process the AI Matching
    let result;

    switch (action) {
      case 'full-assessment':
        // Hii inatumia DeepSeek/Gemini kupiga mahesabu ya CBC subjects vs Careers
        result = await careerMatcher.generateMatches(studentId, true);
        break;

      case 'specific-career':
        if (!careerName) {
          return apiBadRequest('Career name required');
        }
        result = await careerMatcher.assessSpecificCareer(studentId, careerName);
        break;

      default:
        result = await careerMatcher.generateMatches(studentId, true);
    }

    // 4. Return the result to the Dashboard
    return apiSuccess(result);

  } catch (error: any) {
    console.error('Career matching error:', error);
    return apiError('Failed to generate career matches. Please try again later.');
  }
}
