/**
 * Replace Grade 7 Creative Arts and Sports strands + substrands with the
 * user-provided KICD-aligned data. Lesson counts are derived from the
 * number of repetitions in the original list.
 */

import { createClient } from '@supabase/supabase-js'
import { randomUUID } from 'crypto'

const NEW_URL = 'https://lpxrfbmzncaztpmyqzkc.supabase.co'
const NEW_KEY = 'REDACTED_EDUNEXUS_SERVICE_KEY'
const db = createClient(NEW_URL, NEW_KEY)

const G7_CREATIVE_ARTS_LA_ID = '01c02f11-15d5-4cee-88be-9bd22edfdf9c'

// Each substrand: [title, suggestedLessons]
// Title format: "Substrand Name - Topic"
// Lesson count = number of times the line appeared in the original list
const STRANDS: Array<{ title: string; substrands: [string, number][] }> = [
  {
    title: 'Foundations of Creative Arts and Sports',
    substrands: [
      ['Introduction to Creative Arts and Sports - Categories of Creative Arts and Sports', 3],
      ['Introduction to Creative Arts and Sports - Relationships among the categories of Creative Arts and Sports', 2],
      ['Introduction to Creative Arts and Sports - Making a Collage/photo montage', 3],
      ['Components of Creative Arts and Sports - Elements of a story', 4],
      ['Components of Creative Arts and Sports - Coordination and strength in physical fitness', 3],
      ['Components of Creative Arts and Sports - Note values and their rest', 1],
    ],
  },
  {
    title: 'Creating and Performing in Creative Arts and Sports',
    substrands: [
      ['Picture Making - Drawing: Line, tone and balance', 4],
      ['Picture Making - Painting: Cool and warm colors', 6],
      ['Rhythm - Time signature', 2],
      ['Rhythm - Repetition of note values and rests', 2],
      ['Rhythm - Variation of note values and rests', 1],
      ['Rhythm - Body movements', 1],
      ['Rhythm - French rhythm names', 1],
      ['Rhythm - Composing rhythmic patterns', 2],
      ['Rhythm - Dictation and sight reading', 1],
      ['Athletics and Sculpture - Materials for carving', 1],
      ['Athletics and Sculpture - Javelin appearance', 1],
      ['Athletics and Sculpture - Carving', 3],
      ['Athletics and Sculpture - Decorating forms', 2],
      ['Athletics and Sculpture - Javelin throw', 5],
      ['Melody - Qualities of a good melody', 2],
      ['Melody - Melodies in C major', 6],
      ['Handball - Passes', 6],
      ['Handball - Dribbling', 4],
      ['Handball - Jump shot', 2],
      ['Multimedia - Motif design', 2],
      ['Multimedia - Stencil Printing', 4],
      ['Descant Recorder - Interpreting melodies on staff notation', 2],
      ['Descant Recorder - Performance directions', 2],
      ['Descant Recorder - Playing melodies', 3],
      ['Descant Recorder - Duets', 1],
      ['Storytelling and Animation - Storytelling techniques', 2],
      ['Storytelling and Animation - Qualities of a good flipbook', 2],
      ['Storytelling and Animation - Composing a story', 4],
      ['Storytelling and Animation - Flipbook animation', 4],
      ['Storytelling and Animation - Performing a story', 3],
      ['Storytelling and Animation - Storytelling as communication', 1],
      ['Football - Trapping', 6],
      ['Football - Dribbling', 6],
      ['Football - Shooting', 5],
      ['Football - Mini game', 1],
      ['Football - Crayon etching', 6],
      ['Kenyan Folk Songs - Classification', 4],
      ['Kenyan Folk Songs - Performance techniques', 4],
      ['Kenyan Folk Songs - Stencil printing', 3],
      ['Kenyan Folk Songs - Folk song performance', 1],
      ['Indigenous Kenyan Craft - Beadwork', 10],
      ['Swimming - Water entry techniques', 1],
      ['Swimming - Crouch dive', 2],
      ['Swimming - Pencil dive', 3],
      ['Swimming - Backstroke', 4],
      ['Kenyan Indigenous Games - Rope games', 10],
    ],
  },
  {
    title: 'Appreciation in Creative Arts and Sports',
    substrands: [
      ['Analysis of Creative Arts and Sports - Sports values', 3],
      ['Analysis of Creative Arts and Sports - Folk song', 4],
      ['Analysis of Creative Arts and Sports - Storytelling', 2],
      ['Analysis of Creative Arts and Sports - 2D Artwork', 2],
      ['Analysis of Creative Arts and Sports - Role of analysis', 1],
      ['Analysis of Creative Arts and Sports - Making a portfolio', 2],
      ['Analysis of Creative Arts and Sports - Portfolio showcase', 1],
    ],
  },
]

async function main() {
  console.log('Replace Grade 7 Creative Arts and Sports')
  console.log('=========================================')

  // 1. Delete existing strands + substrands
  const { data: existing } = await db
    .from('sow_strands')
    .select('id')
    .eq('learning_area_id', G7_CREATIVE_ARTS_LA_ID)

  if (existing?.length) {
    const ids = existing.map(s => s.id)
    const { error: d1 } = await db.from('sow_substrands').delete().in('strand_id', ids)
    if (d1) throw new Error(`delete substrands: ${d1.message}`)
    const { error: d2 } = await db.from('sow_strands').delete().in('id', ids)
    if (d2) throw new Error(`delete strands: ${d2.message}`)
    console.log(`  Cleared ${ids.length} old strands`)
  }

  // 2. Insert new strands + substrands
  let totalSubs = 0
  for (let si = 0; si < STRANDS.length; si++) {
    const stDef = STRANDS[si]
    const strandId = randomUUID()

    const { error: stErr } = await db.from('sow_strands').insert({
      id: strandId,
      learning_area_id: G7_CREATIVE_ARTS_LA_ID,
      title: stDef.title,
      order_index: si + 1,
      source_type: 'kicd',
      kicd_data: [],
    })
    if (stErr) throw new Error(`insert strand "${stDef.title}": ${stErr.message}`)

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
      if (error) throw new Error(`insert substrands batch: ${error.message}`)
    }
    totalSubs += subRows.length
    console.log(`  ✓ "${stDef.title}": ${stDef.substrands.length} substrands`)
  }

  // 3. Verify
  const { data: finalStrands } = await db.from('sow_strands').select('id, title').eq('learning_area_id', G7_CREATIVE_ARTS_LA_ID).order('order_index')
  const strandIds = (finalStrands || []).map(s => s.id)
  const { count: subCount } = await db.from('sow_substrands').select('*', { count: 'exact', head: true }).in('strand_id', strandIds)

  console.log(`\n  Total: ${finalStrands?.length} strands, ${subCount} substrands`)
  console.log('\n✅ Done')
}

main().catch(err => { console.error(err); process.exit(1) })
