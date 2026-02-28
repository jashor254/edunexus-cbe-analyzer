import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/utils/supabase/server'
import { AI } from '@/lib/ai/hybrid-system'

export const dynamic = 'force-dynamic' // ✅ Force dynamic for build
export const runtime = 'edge'

export async function POST(request: NextRequest) {
  try {
    const { message, studentId, conversationHistory } = await request.json()
    if (!message || !studentId) return NextResponse.json({ error: 'Missing fields' }, { status: 400 })

    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { data: student } = await supabase.from('students').select('name, grade').eq('id', studentId).single()
    
    const response = await AI.chat(
      student?.name || 'Student',
      student?.grade || 8,
      message,
      conversationHistory || []
    )

    return NextResponse.json({ success: true, response })
  } catch (error) {
    return NextResponse.json({ error: 'Chat failed', fallback: { message: 'Try again!' } }, { status: 500 })
  }
}