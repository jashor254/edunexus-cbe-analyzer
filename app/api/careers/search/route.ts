// app/api/careers/search/route.ts
import { NextRequest } from 'next/server';
import { apiSuccess, apiError, apiBadRequest } from '@/lib/api/response';
import { createClient } from '@/utils/supabase/server';
import { findCareerByName } from '@/lib/academicClinic/careerDatabase';
import { generateDynamicCareer } from '@/lib/academicClinic/dynamicCareerGenerator';
import { checkRateLimit } from '@/lib/ai/rateLimit';

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const careerName = searchParams.get('name')?.trim();
  const gradeParam = searchParams.get('grade');

  if (!careerName) {
    return apiBadRequest('Search query required');
  }

  const supabase = await createClient();

  // Auth check for proper rate limiting
  const { data: { user } } = await supabase.auth.getUser();

  // Rate limit: 20 searches/hour per user (or IP for anonymous)
  const rateLimitKey = user?.id || req.headers.get('x-forwarded-for') || '127.0.0.1';
  try {
    const rateLimit = await checkRateLimit(rateLimitKey, 'careerAnalysis', 'free');
    if (!rateLimit.allowed) {
      return apiError('Too many searches. Relax kidogo! Try again in an hour.', 429);
    }
  } catch {
    // rateLimit table missing: fall through
  }

  try {
    // 1. Check static database first (zero cost)
    const staticResult = findCareerByName(careerName);
    if (staticResult) {
      return apiSuccess({ source: 'static', career: staticResult });
    }

    // 2. Check DB cache — specific columns, with optional grade filter
    let query = supabase
      .from('careers')
      .select('id, name, description, salary_range, education_path, education_duration, outlook, demand_in_kenya, ai_disruption_risk, required_subjects, required_subjects_display, universities_in_kenya, tvet_options, career_path')
      .ilike('name', `%${careerName}%`);

    if (gradeParam) {
      const grade = parseInt(gradeParam, 10);
      if (!isNaN(grade)) {
        query = query.lte('min_grade', grade);
      }
    }

    const { data: cachedCareer, error: cacheError } = await query.limit(1).maybeSingle();

    if (!cacheError && cachedCareer) {
      return apiSuccess({ source: 'database', career: cachedCareer });
    }

    // 3. Generate dynamically via DeepSeek AI
    const dynamicCareer = await generateDynamicCareer(careerName);

    // 4. Auto-persist to DB for future lookups
    const { error: saveError } = await supabase
      .from('careers')
      .insert([{
        name: dynamicCareer.name,
        description: dynamicCareer.description,
        salary_range: dynamicCareer.salary_range,
        education_path: dynamicCareer.education_path,
        education_duration: dynamicCareer.education_duration,
        outlook: dynamicCareer.outlook,
        demand_in_kenya: dynamicCareer.demand_in_kenya,
        ai_disruption_risk: dynamicCareer.ai_disruption_risk,
        required_subjects: dynamicCareer.required_subjects,
        required_subjects_display: dynamicCareer.required_subjects_display,
        universities_in_kenya: dynamicCareer.universities_in_kenya,
        tvet_options: dynamicCareer.tvet_options,
        career_path: dynamicCareer.career_path,
        is_ai_generated: true,
        created_at: new Date().toISOString(),
      }]);

    if (saveError) {
      console.error('Failed to persist dynamic career:', saveError);
    }

    return apiSuccess({
      source: 'dynamic',
      career: dynamicCareer,
      message: 'AI researched this specifically for you!',
    });

  } catch (err) {
    console.error('Career Search Error:', err);
    return apiError('Failed to research career. Please try again.');
  }
}

export const dynamic = 'force-dynamic';
