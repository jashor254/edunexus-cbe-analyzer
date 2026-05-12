import { createClient } from '@supabase/supabase-js'
import * as dotenv from 'dotenv'
dotenv.config({ path: '/home/the-dev/Desktop/edunexus-cbe-analyzer/.env.local' })

const db = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

async function check() {
  // Find Grade 10
  const { data: grades } = await db
    .from('sow_grades')
    .select('id, name, numeric_grade')
    .eq('numeric_grade', 10)
  
  console.log('Grade 10:', grades)
  
  if (!grades || grades.length === 0) {
    console.log('NO Grade 10 data found')
    return
  }

  const grade10 = grades[0]

  // Check learning areas
  const { data: areas } = await db
    .from('sow_learning_areas')
    .select('id, name')
    .eq('grade_id', grade10.id)
  
  console.log('Learning areas:', areas?.map(a => a.name))

  if (!areas || areas.length === 0) {
    console.log('NO learning areas for Grade 10')
    return
  }

  // Check strands for first subject
  const { data: strands } = await db
    .from('sow_strands')
    .select('id, title')
    .eq('learning_area_id', areas[0].id)
  
  console.log('Strands for', areas[0].name, ':', strands?.length)
  
  // Check substrands
  if (strands && strands[0]) {
    const { data: subs } = await db
      .from('sow_substrands')
      .select('title')
      .eq('strand_id', strands[0].id)
    
    console.log('Sample substrands:', subs?.map(s => s.title))
  }
}

check().catch(console.error)
