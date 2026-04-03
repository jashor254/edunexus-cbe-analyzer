// app/api/careers/search/route.ts
import { NextRequest } from 'next/server';
import { apiSuccess, apiError, apiBadRequest } from '@/lib/api/response';
import { createClient } from '@/utils/supabase/server';
import { findCareerByName } from '@/lib/academicClinic/careerDatabase';
import { generateDynamicCareer } from '@/lib/academicClinic/dynamicCareerGenerator';

// In-memory rate limiting (simplest for now)
const rateLimitMap = new Map<string, { count: number, reset: number }>();

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const careerName = searchParams.get('name')?.trim();
  
  if (!careerName) {
    return apiBadRequest("Search query required");
  }

  // 1. RATE LIMITING (Basic)
  const ip = req.headers.get('x-forwarded-for') || '127.0.0.1';
  const now = Date.now();
  const userLimit = rateLimitMap.get(ip) || { count: 0, reset: now + 3600000 };

  if (now > userLimit.reset) {
    userLimit.count = 0;
    userLimit.reset = now + 3600000;
  }

  if (userLimit.count >= 20) {
    return apiError("Too many searches. Relax kidogo!", 429);
  }
  userLimit.count++;
  rateLimitMap.set(ip, userLimit);

  const supabase = await createClient();

  try {
    // 2. CHECK STATIC & DB FIRST (Zero Cost)
    // Angalia kama iko kwa static database kwanza
    const staticResult = findCareerByName(careerName);
    if (staticResult) {
      return apiSuccess({ source: 'static', career: staticResult });
    }

    // Angalia kama ilishawahi kutafutwa na AI ikahifadhiwa kwa DB
    const { data: cachedCareer, error: cacheError } = await supabase
      .from('careers')
      .select('*')
      .ilike('name', `%${careerName}%`)
      .maybeSingle();

    if (!cacheError && cachedCareer) {
      return apiSuccess({ source: 'database', career: cachedCareer });
    }

    // 3. GENERATE DYNAMICALLY (AI Research)
    // Ikiwa haipo popote, sasa AI inachukua usukani
    const dynamicCareer = await generateDynamicCareer(careerName);

    // 4. AUTO-PERSIST (Grow the database automatically)
    // Save this new research to Supabase so it's "Static" for the next user
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
        created_at: new Date().toISOString()
      }]);

    if (saveError) {
      console.error("Failed to persist dynamic career:", saveError);
    }

    return apiSuccess({
      source: 'dynamic',
      career: dynamicCareer,
      message: "AI researched this specifically for you!"
    });

  } catch (err) {
    console.error("Career Search Error:", err);
    return apiError("Failed to research career. Please try again.");
  }
}

export const dynamic = 'force-dynamic';