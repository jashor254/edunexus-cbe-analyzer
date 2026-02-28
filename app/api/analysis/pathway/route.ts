import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/utils/supabase/server'
import { AI } from '@/lib/ai/hybrid-system'

export const dynamic = 'force-dynamic' // ✅ Force dynamic for build

export async function POST(request: NextRequest) {
  try {
    const { studentId, grades, interests, strengths } = await request.json()
    if (!studentId || !grades) return NextResponse.json({ error: 'Missing required fields' }, { status: 400 })

    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { data: profile } = await supabase.from('profiles').select('plan_type, tokens').eq('id', user.id).single()
    if (!profile) return NextResponse.json({ error: 'Profile not found' }, { status: 404 })

    const planType = profile.plan_type || 'trial'
    const tokens = profile.tokens || 0
    if (planType === 'trial' && tokens < 1) return NextResponse.json({ error: 'No tokens', needsUpgrade: true }, { status: 403 })

    const { data: student } = await supabase.from('students').select('name, grade').eq('id', studentId).single()
    if (!student) return NextResponse.json({ error: 'Student not found' }, { status: 404 })

    const analysis = await AI.analyzePathway({
      studentName: student.name,
      grade: student.grade,
      grades,
      interests: interests || [],
      strengths: strengths || []
    })

    // Save & Deduct logic...
    await supabase.from('pathway_analyses').insert({ student_id: studentId, user_id: user.id, recommended_pathway: analysis.recommendedPathway, career_matches: analysis.careerMatches })

    return NextResponse.json({ success: true, analysis })
  } catch (error) {
    return NextResponse.json({ error: 'Failed to analyze' }, { status: 500 })
  }
}