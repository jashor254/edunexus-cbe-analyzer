import { NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server" // Hakikisha ni ya server!

export async function GET() {
  try {
    const supabase = await createClient() // Lazima iwe na await sasa

    const { data: { user }, error: authError } = await supabase.auth.getUser()
    
    if (authError || !user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    // Pata stats zako sasa "asteaste"
    const { count: studentCount } = await supabase
      .from('students')
      .select('*', { count: 'exact', head: true })
      .eq('user_id', user.id)

    return NextResponse.json({
      students: studentCount || 0,
      lastSync: new Date().toISOString()
    })

  } catch (err) {
    console.error(err)
    return NextResponse.json({ error: "Server Error" }, { status: 500 })
  }
}