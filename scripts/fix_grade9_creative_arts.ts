/**
 * Replace Grade 9 Creative Arts and Sports strands + substrands.
 * The two "Creating and Performing" sections in the source are merged
 * into one strand for consistency with Grade 7/8.
 * Lesson counts derived from repetitions; singles get suggested_lessons=1.
 */

import { createClient } from '@supabase/supabase-js'
import { randomUUID } from 'crypto'

const NEW_URL = 'https://lpxrfbmzncaztpmyqzkc.supabase.co'
const NEW_KEY = 'REDACTED_EDUNEXUS_SERVICE_KEY'
const db = createClient(NEW_URL, NEW_KEY)

const G9_CREATIVE_ARTS_LA_ID = 'e5ec8993-735a-474e-b30d-7debb370426b'

// [title, suggestedLessons]
const STRANDS: Array<{ title: string; substrands: [string, number][] }> = [
  {
    title: 'Foundation of Creative Arts and Sports',
    substrands: [
      ['Careers in Creative Arts And Sports - Careers in Creative Arts', 2],
      ['Components of Creative Arts and Sports - Elements of a Play', 2],
      ['Components of Creative Arts and Sports - Physical Fitness', 2],
      ['Components of Creative Arts and Sports - Rhythm', 1],
      ['Components of Creative Arts and Sports - Note Extension', 1],
      ['Components of Creative Arts and Sports - Grand Staff', 1],
      ['Components of Creative Arts and Sports - Scale of F Major', 1],
    ],
  },
  {
    title: 'Creating and Performing in Creative Arts and Sports',
    substrands: [
      // Drawing and Painting (11 lessons, 5 unique)
      ['Drawing and Painting - Texture, Colour, Unity and Harmony', 2],
      ['Drawing and Painting - Analogous Colors', 3],
      ['Drawing and Painting - Analogous Colors and Color Harmony', 1],
      ['Drawing and Painting - Color Harmony', 1],
      ['Drawing and Painting - Scenery Composition', 5],
      // Rhythm (12)
      ['Rhythm - Effects of Note Extension', 1],
      ['Rhythm - Value Extension', 1],
      ['Rhythm - Dictation', 1],
      ['Rhythm - Time Signature', 1],
      ['Rhythm - Compose Rhythmic Pattern', 1],
      ['Rhythm - Group Activity', 1],
      ['Rhythm - Beat Numbering', 1],
      ['Rhythm - Composition', 1],
      ['Rhythm - Group Performance', 1],
      ['Rhythm - Notating Rhythmic Pattern', 1],
      ['Rhythm - Rhythm Writing Rules', 1],
      ['Rhythm - Body Percussion', 1],
      // Athletics and Mosaic (16)
      ['Athletics and Mosaic - Triple Jump', 1],
      ['Athletics and Mosaic - Approach and Take-off', 1],
      ['Athletics and Mosaic - Hop and Step', 1],
      ['Athletics and Mosaic - Jump and Landing', 1],
      ['Athletics and Mosaic - Complete Triple Jump', 1],
      ['Athletics and Mosaic - Long Distance Running', 1],
      ['Athletics and Mosaic - Starting Technique', 1],
      ['Athletics and Mosaic - Arm Action and Stride', 1],
      ['Athletics and Mosaic - Pacing and Breathing', 1],
      ['Athletics and Mosaic - Practice Run', 1],
      ['Athletics and Mosaic - Mosaic Characteristics', 1],
      ['Athletics and Mosaic - Monomedia', 1],
      ['Athletics and Mosaic - Materials Collection', 1],
      ['Athletics and Mosaic - Planning and Sketching', 1],
      ['Athletics and Mosaic - Creating Mosaic', 1],
      ['Athletics and Mosaic - Completing Mosaic', 1],
      // Melody (10)
      ['Melody - Variation Techniques', 1],
      ['Melody - Analyzing Phrases', 1],
      ['Melody - Rhythm Variation', 1],
      ['Melody - Scale of F Major', 1],
      ['Melody - Scale Practice', 1],
      ['Melody - Answering Phrases', 1],
      ['Melody - Opening Phrases', 1],
      ['Melody - Composing Melodies', 1],
      ['Melody - Notating Melodies', 1],
      ['Melody - Performing Melodies', 1],
      // Rugby (10)
      ['Rugby - Different Passes', 1],
      ['Rugby - Basic Pass', 1],
      ['Rugby - Spin Pass', 1],
      ['Rugby - Pop Pass', 1],
      ['Rugby - Pass Demonstrations', 1],
      ['Rugby - Group Practice', 1],
      ['Rugby - Kicking Techniques', 1],
      ['Rugby - Performing Kicks', 1],
      ['Rugby - Modified Game', 1],
      ['Rugby - Skill Review', 1],
      // Photography (7)
      ['Photography - Different Viewpoints', 1],
      ['Photography - Normal Viewpoint', 1],
      ["Photography - Bird's Eye Viewpoint", 1],
      ["Photography - Worm's Eye Viewpoint", 1],
      ['Photography - Taking Photographs', 1],
      ['Photography - Ethics', 1],
      ['Photography - Presenting Photographs', 1],
      // Descant Recorder (6)
      ['Descant Recorder - Fingering of Notes', 1],
      ['Descant Recorder - Playing Techniques', 1],
      ['Descant Recorder - Scale of F Major', 1],
      ['Descant Recorder - Simple Melodies', 1],
      ['Descant Recorder - Performance Directions', 1],
      ['Descant Recorder - Solo Pieces', 1],
      // Play (11)
      ['Play - Format of a Script', 1],
      ['Play - Script Reading', 1],
      ['Play - Elements of a Play', 1],
      ['Play - Societal Issues', 1],
      ['Play - Creating a Play', 1],
      ['Play - Warm-up Activities', 1],
      ['Play - Rehearsing', 1],
      ['Play - Blocking', 1],
      ['Play - Dress Rehearsal', 1],
      ['Play - Performance', 1],
      ['Play - Reflection', 1],
      // Basketball and Logo Design (14 — merged from both sections)
      ['Basketball and Logo Design - Passing Skills', 1],
      ['Basketball and Logo Design - Performing Passes in Basketball', 1],
      ['Basketball and Logo Design - Performing the Overhead Pass', 1],
      ['Basketball and Logo Design - Performing the Bounce Pass', 1],
      ['Basketball and Logo Design - Performing the Chest Pass', 1],
      ['Basketball and Logo Design - Practicing Different Passes', 1],
      ['Basketball and Logo Design - Executing Dribbling in Basketball', 1],
      ['Basketball and Logo Design - Performing High Dribble', 1],
      ['Basketball and Logo Design - Performing Low Dribble', 1],
      ['Basketball and Logo Design - Combining Dribbling Skills', 1],
      ['Basketball and Logo Design - Designing a Logo for a Basketball Team', 1],
      ['Basketball and Logo Design - Creating a Basketball Team Logo', 1],
      ['Basketball and Logo Design - Refining and Finalizing Logo Design', 1],
      ['Basketball and Logo Design - Applying Skills in a Modified Game', 1],
      // Indigenous Kenyan Crafts (10)
      ['Indigenous Kenyan Crafts - Pottery', 1],
      ['Indigenous Kenyan Crafts - Pottery Techniques', 1],
      ['Indigenous Kenyan Crafts - Preparing Clay for Pottery', 1],
      ['Indigenous Kenyan Crafts - Modeling a Vessel Using Coil Method', 1],
      ['Indigenous Kenyan Crafts - Decorating and Drying Clay Vessel', 1],
      ['Indigenous Kenyan Crafts - Firing Clay Vessels', 1],
      ['Indigenous Kenyan Crafts - Making a Frame Loom for Weaving', 1],
      ['Indigenous Kenyan Crafts - Constructing a Frame Loom', 1],
      ['Indigenous Kenyan Crafts - Making a Fabric Using 2/1 Twill Weaving', 1],
      ['Indigenous Kenyan Crafts - Completing a Woven Fabric', 1],
      // Swimming (10)
      ['Swimming - Body Positioning in Standing Dive', 1],
      ['Swimming - Techniques for Standing Dive', 1],
      ['Swimming - Performing Standing Dive', 1],
      ['Swimming - Body Positioning in Butterfly Stroke', 1],
      ['Swimming - Techniques for Butterfly Stroke', 1],
      ['Swimming - Performing Butterfly Stroke Components', 1],
      ['Swimming - Performing Leg Actions in Butterfly Stroke', 1],
      ['Swimming - Performing Breathing Technique in Butterfly Stroke', 1],
      ['Swimming - Combining Butterfly Stroke Components', 1],
      ['Swimming - Playing Water Games', 1],
      // Kenyan Indigenous Games (9)
      ['Kenyan Indigenous Games - Board Games', 1],
      ['Kenyan Indigenous Games - Learning Bao', 1],
      ['Kenyan Indigenous Games - Playing Bao', 1],
      ['Kenyan Indigenous Games - Improvising Bao Board', 1],
      ['Kenyan Indigenous Games - Playing Bao Game', 1],
      ['Kenyan Indigenous Games - Learning Shisima', 1],
      ['Kenyan Indigenous Games - Playing Shisima', 1],
      ['Kenyan Indigenous Games - Playing with Background Music', 1],
      ['Kenyan Indigenous Games - Mental Health Benefits', 1],
    ],
  },
  {
    title: 'Appreciation in Creative Arts and Sports',
    substrands: [
      ['Analysis of Creative Arts and Sports - Analysing a Play Performance', 1],
      ['Analysis of Creative Arts and Sports - Evaluating Play Elements', 1],
      ['Analysis of Creative Arts and Sports - Evaluating Performance Elements', 1],
      ['Analysis of Creative Arts and Sports - Analyzing Technical Elements', 1],
      ['Analysis of Creative Arts and Sports - Analyzing Production Elements', 1],
      ['Analysis of Creative Arts and Sports - Creating a Scoring Guide', 1],
      ['Analysis of Creative Arts and Sports - Examining Ethical Practices in Sports', 1],
      ['Analysis of Creative Arts and Sports - Anti-doping Measures', 1],
      ['Analysis of Creative Arts and Sports - Analyzing Solo Vocal Music', 1],
      ['Analysis of Creative Arts and Sports - Creating Music Analysis Tools', 1],
      ['Analysis of Creative Arts and Sports - Performing and Analyzing Music', 1],
      ['Analysis of Creative Arts and Sports - Analyzing "Zum Zum Zum"', 1],
      ['Analysis of Creative Arts and Sports - Critiquing Exhibited Artworks', 1],
      ['Analysis of Creative Arts and Sports - Art Exhibition Elements', 1],
      ['Analysis of Creative Arts and Sports - Visiting Art Exhibitions', 1],
      ['Analysis of Creative Arts and Sports - Creating Exhibition Analysis Tools', 1],
      ['Analysis of Creative Arts and Sports - Role of Analysis in Creative Arts and Sports', 1],
      ['Analysis of Creative Arts and Sports - Benefits of Analysis', 1],
      ['Analysis of Creative Arts and Sports - Critical Thinking Development', 1],
      ['Analysis of Creative Arts and Sports - Learning from Professionals', 1],
      ['Analysis of Creative Arts and Sports - Personal Analysis Application', 1],
      ['Analysis of Creative Arts and Sports - Analysis in the Creative Process', 1],
      ['Analysis of Creative Arts and Sports - Culminating Project', 1],
      ['Analysis of Creative Arts and Sports - Culminating Project Showcase', 1],
    ],
  },
]

async function main() {
  console.log('Replace Grade 9 Creative Arts and Sports')
  console.log('=========================================')

  const { data: existing } = await db.from('sow_strands').select('id').eq('learning_area_id', G9_CREATIVE_ARTS_LA_ID)
  if (existing?.length) {
    const ids = existing.map(s => s.id)
    await db.from('sow_substrands').delete().in('strand_id', ids)
    await db.from('sow_strands').delete().in('id', ids)
    console.log(`  Cleared ${ids.length} old strands`)
  }

  let totalSubs = 0
  for (let si = 0; si < STRANDS.length; si++) {
    const stDef = STRANDS[si]
    const strandId = randomUUID()

    const { error: stErr } = await db.from('sow_strands').insert({
      id: strandId,
      learning_area_id: G9_CREATIVE_ARTS_LA_ID,
      title: stDef.title,
      order_index: si + 1,
      source_type: 'kicd',
      kicd_data: [],
    })
    if (stErr) throw new Error(`insert strand: ${stErr.message}`)

    const subRows = stDef.substrands.map(([title, lessons], idx) => ({
      id: randomUUID(),
      strand_id: strandId,
      title,
      suggested_lessons: lessons,
      order_index: idx + 1,
      content: null,
      source_type: 'kicd',
    }))

    const BATCH = 200
    for (let i = 0; i < subRows.length; i += BATCH) {
      const { error } = await db.from('sow_substrands').insert(subRows.slice(i, i + BATCH))
      if (error) throw new Error(`insert substrands: ${error.message}`)
    }
    totalSubs += subRows.length
    console.log(`  ✓ "${stDef.title}": ${stDef.substrands.length} substrands`)
  }

  console.log(`\n  Total: ${STRANDS.length} strands, ${totalSubs} substrands`)
  console.log('✅ Done')
}

main().catch(err => { console.error(err); process.exit(1) })
