/**
 * Replace Grade 8 Creative Arts and Sports strands + substrands.
 * All items appear exactly once → suggested_lessons = 1 each.
 * Total: 16 + 136 + 8 = 160 substrands.
 */

import { createClient } from '@supabase/supabase-js'
import { randomUUID } from 'crypto'

const NEW_URL = 'https://lpxrfbmzncaztpmyqzkc.supabase.co'
const NEW_KEY = 'REDACTED_EDUNEXUS_SERVICE_KEY'
const db = createClient(NEW_URL, NEW_KEY)

const G8_CREATIVE_ARTS_LA_ID = '7771e0e9-a2a4-43ad-b884-8c8d95db886b'

const STRANDS: Array<{ title: string; substrands: string[] }> = [
  {
    title: 'Foundations of Creative Arts and Sports',
    substrands: [
      'Roles of Creative Arts and Sports - Introduction to Creative Arts and Sports',
      'Roles of Creative Arts and Sports - Social roles',
      'Roles of Creative Arts and Sports - Economic roles',
      'Roles of Creative Arts and Sports - Creating a storyboard',
      'Roles of Creative Arts and Sports - Collecting and cutting pictures',
      'Roles of Creative Arts and Sports - Painting background (splattering)',
      'Roles of Creative Arts and Sports - Painting background (wash)',
      'Roles of Creative Arts and Sports - Assembling the storyboard',
      'Components of Creative Arts and Sports - Elements of a verse',
      'Components of Creative Arts and Sports - Elements of a verse (character)',
      'Components of Creative Arts and Sports - Elements of a verse (theme)',
      'Components of Creative Arts and Sports - Elements of a verse (setting)',
      'Components of Creative Arts and Sports - Endurance',
      'Components of Creative Arts and Sports - Agility',
      'Components of Creative Arts and Sports - Endurance and agility with music',
      'Components of Creative Arts and Sports - Pitch (bass staff and ledger lines)',
    ],
  },
  {
    title: 'Creating and Performing in Creative Arts and Sports',
    substrands: [
      'Drawing and Painting - Dominance in a pictorial composition',
      'Drawing and Painting - Complementary colours',
      'Drawing and Painting - Painting a colour wheel',
      'Drawing and Painting - Colour gradation strip',
      'Drawing and Painting - Drawing a still life composition',
      'Drawing and Painting - Painting background (wash technique)',
      'Drawing and Painting - Painting objects with complementary colours',
      'Drawing and Painting - Completing still life painting',
      'Drawing and Painting - Displaying and critiquing paintings',
      'Drawing and Painting - Creating original composition',
      'Rhythm - 3/4 time in music',
      'Rhythm - Rhythmic patterns in 3/4 time',
      'Rhythm - Note values and rests',
      'Rhythm - Grouping notes in 3/4 time',
      'Rhythm - Rhythm dictation',
      'Rhythm - Composing four-bar rhythmic patterns',
      'Rhythm - Composing rhythms with rests',
      'Rhythm - Performing rhythmic patterns',
      'Rhythm - Improvising rhythmic accompaniment',
      'Rhythm - Creating rhythms for enjoyment',
      'Middle Distance Races and Montage - Introduction to middle distance races',
      'Middle Distance Races and Montage - 800 metres starting skills',
      'Middle Distance Races and Montage - 800 metres running skills',
      'Middle Distance Races and Montage - 1500 metres starting skills',
      'Middle Distance Races and Montage - 1500 metres running skills',
      'Middle Distance Races and Montage - Finishing techniques',
      'Middle Distance Races and Montage - Mini games',
      'Middle Distance Races and Montage - Characteristics of montage',
      'Middle Distance Races and Montage - Collecting pictures for montage',
      'Middle Distance Races and Montage - Creating montage composition',
      'Middle Distance Races and Montage - Finishing and displaying montage',
      'Middle Distance Races and Montage - Digital montage',
      'Melody - Methods of creating a melody',
      'Melody - Exact repetition',
      'Melody - Varied repetition',
      'Melody - Composing answer phrases',
      'Melody - Intervals (perfect fourth)',
      'Melody - Composing four-bar melody',
      'Melody - Phrase marks',
      'Melody - Performing melodies',
      'Melody - Digital notation',
      'Melody - Role in Creative Arts and Sports',
      'Netball - Introduction to passes',
      'Netball - Chest pass',
      'Netball - Overhead pass',
      'Netball - Landing',
      'Netball - Pivoting',
      'Netball - Marking',
      'Netball - Dodging',
      'Netball - Workouts and drills',
      'Netball - Mini games',
      'Netball - Zone passing game',
      'Netball - Teamwork challenge',
      'Netball - Skills reflection',
      'Fabric Decoration - Introduction',
      'Fabric Decoration - Marbling and stencil printing',
      'Fabric Decoration - Preparing fabric',
      'Fabric Decoration - Preparing dyes',
      'Fabric Decoration - Marbling technique',
      'Fabric Decoration - Pleating technique',
      'Fabric Decoration - Designing motif',
      'Fabric Decoration - Stencil printing',
      'Fabric Decoration - Making tote bag',
      'Fabric Decoration - Display and critique',
      'Descant Recorder - Fingering technique',
      'Descant Recorder - Correct fingering demonstration',
      'Descant Recorder - Embouchure and blowing',
      'Descant Recorder - Tonguing and pinching',
      'Descant Recorder - Slurring technique',
      'Descant Recorder - Performance directions (dynamics)',
      'Descant Recorder - Performance directions (repeat)',
      'Descant Recorder - Playing melodies in G major',
      'Descant Recorder - Performing solo pieces',
      'Descant Recorder - Recording and technique poster',
      'Verse - Language use in verse',
      'Verse - Imagery (simile, metaphor, personification)',
      'Verse - Sound devices (alliteration, rhyme, repetition)',
      'Verse - Diction, line and stanza',
      'Verse - Composing verse (exploring issues)',
      'Verse - Composing verse (developing idea)',
      'Verse - Composing verse (drafting and editing)',
      'Verse - Performance techniques',
      'Verse - Rehearsing verse',
      'Verse - Performing before audience',
      'Volleyball - Introduction to serves',
      'Volleyball - Overarm serve (stance and grip)',
      'Volleyball - Overarm serve (execution)',
      'Volleyball - Jump service',
      'Volleyball - Overarm serve workouts',
      'Volleyball - Volleying skill (introduction)',
      'Volleyball - Volleying (stance and positioning)',
      'Volleyball - Volleying (execution)',
      'Volleyball - Volleying workouts',
      'Volleyball - Volleying in game situation',
      'Volleyball - Mini game',
      'Volleyball - Skills reflection',
      'Kenyan Folk Dance - Classification of folk dances',
      'Kenyan Folk Dance - Classification by community and occasion',
      'Kenyan Folk Dance - Classification by gender, age and purpose',
      'Kenyan Folk Dance - Background information',
      'Kenyan Folk Dance - Songs and instruments',
      'Kenyan Folk Dance - Costumes and make-up',
      'Kenyan Folk Dance - Learning movements and songs',
      'Kenyan Folk Dance - Rehearsing folk dance',
      'Kenyan Folk Dance - Performing before audience',
      'Kenyan Folk Dance - Appreciating different cultures',
      'Indigenous Kenyan Craft - Introduction to basketry',
      'Indigenous Kenyan Craft - Coil technique items',
      'Indigenous Kenyan Craft - Steps in coil technique',
      'Indigenous Kenyan Craft - Materials and tools',
      'Indigenous Kenyan Craft - Preparing materials',
      'Indigenous Kenyan Craft - Dyeing materials',
      'Indigenous Kenyan Craft - Making mat (starting)',
      'Indigenous Kenyan Craft - Making mat (continuing)',
      'Indigenous Kenyan Craft - Making mat (finishing)',
      'Indigenous Kenyan Craft - Display and appreciation',
      'Swimming - Introduction to inverted breaststroke',
      'Swimming - Introduction to water treading',
      'Swimming - Water treading (body and arms)',
      'Swimming - Water treading (leg movements)',
      'Swimming - Inverted breaststroke (body and arms)',
      'Swimming - Inverted breaststroke (legs and breathing)',
      'Swimming - Practising inverted breaststroke',
      'Swimming - Combining skills',
      'Swimming - Mini games (relay)',
      'Swimming - Mini games (ball toss)',
      'Kenyan Indigenous Games - Introduction to tagging',
      'Kenyan Indigenous Games - Brikicho Banture (introduction)',
      'Kenyan Indigenous Games - Brikicho Banture (skills)',
      'Kenyan Indigenous Games - Playing Brikicho Banture',
      'Kenyan Indigenous Games - Chako (introduction)',
      'Kenyan Indigenous Games - Playing Chako',
      'Kenyan Indigenous Games - I Lost a Letter (introduction)',
      'Kenyan Indigenous Games - Playing I Lost a Letter',
      'Kenyan Indigenous Games - Tagging workouts',
      'Kenyan Indigenous Games - Mini games',
    ],
  },
  {
    title: 'Appreciation in Creative Arts and Sports',
    substrands: [
      'Analysis of Creative Arts and Sports - Showcasing artwork',
      'Analysis of Creative Arts and Sports - Displaying artwork',
      'Analysis of Creative Arts and Sports - Analysing artwork components',
      'Analysis of Creative Arts and Sports - Verse analysis criteria',
      'Analysis of Creative Arts and Sports - Verse analysis application',
      'Analysis of Creative Arts and Sports - Sportsmanship',
      'Analysis of Creative Arts and Sports - Promoting sportsmanship',
      'Analysis of Creative Arts and Sports - Folk dance analysis',
    ],
  },
]

async function main() {
  console.log('Replace Grade 8 Creative Arts and Sports')
  console.log('=========================================')

  const { data: existing } = await db.from('sow_strands').select('id').eq('learning_area_id', G8_CREATIVE_ARTS_LA_ID)
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
      learning_area_id: G8_CREATIVE_ARTS_LA_ID,
      title: stDef.title,
      order_index: si + 1,
      source_type: 'kicd',
      kicd_data: [],
    })
    if (stErr) throw new Error(`insert strand: ${stErr.message}`)

    const subRows = stDef.substrands.map((title, idx) => ({
      id: randomUUID(),
      strand_id: strandId,
      title,
      suggested_lessons: 1,
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
