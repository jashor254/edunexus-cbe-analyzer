import { NextRequest } from 'next/server';
import { apiSuccess, apiError, apiUnauthorized, apiForbidden, apiBadRequest } from '@/lib/api/response';
import { createClient } from '@/utils/supabase/server';
import { careerMatcher } from '@/lib/academicClinic/careerEngine';
import { unstable_cache, revalidateTag } from 'next/cache';

export async function POST(req: NextRequest) {
  try {
    const supabase = await createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
      return apiUnauthorized();
    }

    const { studentId, action, careerName } = await req.json();

    if (!studentId) {
      return apiBadRequest('Student ID required');
    }

    // Security: confirm student belongs to this user
    const { data: student, error: studentError } = await supabase
      .from('students')
      .select('id, curriculum_type')
      .eq('id', studentId)
      .eq('user_id', user.id)
      .single();

    if (studentError || !student) {
      return apiForbidden();
    }

    const curriculumType = (student as any).curriculum_type || 'cbc';

    let result: any;

    switch (action) {
      case 'specific-career':
        if (!careerName) return apiBadRequest('Career name required');
        result = await careerMatcher.assessSpecificCareer(studentId, careerName);
        break;

      case 'full-assessment':
      default: {
        // Cache per-student for 6 hours; IGCSE gets different tag
        const cacheTag = `career-match-${studentId}`;
        const getCachedMatch = unstable_cache(
          () => careerMatcher.generateMatches(studentId, true),
          [cacheTag],
          { revalidate: 21600, tags: [cacheTag] }
        );
        result = await getCachedMatch();

        // Attach curriculum metadata for the client
        result = { ...result, curriculumType };
        break;
      }
    }

    return apiSuccess(result);

  } catch (error: any) {
    console.error('Career matching error:', error);
    return apiError('Failed to generate career matches. Please try again later.');
  }
}

// Call this when a new assessment is saved to bust the cached match
export async function DELETE(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const studentId = searchParams.get('studentId');
  if (studentId) {
    revalidateTag(`career-match-${studentId}`, 'default');
  }
  return apiSuccess({ cleared: true });
}
