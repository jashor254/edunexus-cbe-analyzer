import { createClient } from '@supabase/supabase-js'
import * as dotenv from 'dotenv'
dotenv.config({ path: '/home/the-dev/Desktop/edunexus-cbe-analyzer/.env.local' })

const db = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

// YOUR VERIFIED BIOLOGY GRADE 10 DATA
const BIOLOGY_DATA = [
  {
    strand_order: 1,
    title: 'Cell Biology and Biodiversity',
    substrands: [
      { order: 1, title: 'Introduction to Biology — Meaning and application of Biology', lessons: 2 },
      { order: 2, title: 'Introduction to Biology — Application of Biology in everyday life', lessons: 2 },
      { order: 3, title: 'Introduction to Biology — Fields of study in Biology', lessons: 2 },
      { order: 4, title: 'Introduction to Biology — Careers related to fields of study in Biology', lessons: 2 },
      { order: 5, title: 'Introduction to Biology — Factors influencing career choices', lessons: 2 },
      { order: 6, title: 'Introduction to Biology — Importance of Biology in everyday life', lessons: 2 },
      { order: 7, title: 'Specimen Collection and Preservation — Apparatus for collecting specimen', lessons: 2 },
      { order: 8, title: 'Specimen Collection and Preservation — Apparatus for processing and preserving specimen', lessons: 2 },
      { order: 9, title: 'Specimen Collection and Preservation — Sorting, pressing and drying of specimen', lessons: 2 },
      { order: 10, title: 'Specimen Collection and Preservation — Mounting, labelling, storage and protection', lessons: 2 },
      { order: 11, title: 'Specimen Collection and Preservation — Making a herbarium', lessons: 2 },
      { order: 12, title: 'Specimen Collection and Preservation — Improvising apparatus for collecting specimen', lessons: 2 },
      { order: 13, title: 'Specimen Collection and Preservation — Improvising a sweep net and other apparatus', lessons: 2 },
      { order: 14, title: 'Specimen Collection and Preservation — Collecting, processing and preserving an animal specimen', lessons: 2 },
      { order: 15, title: 'Specimen Collection and Preservation — Project on collecting and preserving biological specimen', lessons: 3 },
      { order: 16, title: 'Specimen Collection and Preservation — Importance of collecting and preserving biological specimen', lessons: 2 },
      { order: 17, title: 'Cell Structure and Specialisation — Differences between light and electron microscope', lessons: 2 },
      { order: 18, title: 'Cell Structure and Specialisation — Preparation of temporary slides', lessons: 2 },
      { order: 19, title: 'Cell Structure and Specialisation — Estimation of cell size during microscopy', lessons: 2 },
      { order: 20, title: 'Cell Structure and Specialisation — Plant and animal cell structure under the electron microscope', lessons: 2 },
      { order: 21, title: 'Cell Structure and Specialisation — Structures and functions of cell organelles', lessons: 3 },
      { order: 22, title: 'Cell Structure and Specialisation — Modelling plant and animal cells', lessons: 2 },
      { order: 23, title: 'Cell Structure and Specialisation — Specialised cells in plants', lessons: 2 },
      { order: 24, title: 'Cell Structure and Specialisation — Specialised cells in animals', lessons: 2 },
      { order: 25, title: 'Cell Structure and Specialisation — Cell organisation: Organelles, cells and tissues', lessons: 2 },
      { order: 26, title: 'Cell Structure and Specialisation — Cell organisation: Organs and organ systems', lessons: 2 },
      { order: 27, title: 'Cell Structure and Specialisation — Differences between plant and animal cells', lessons: 2 },
      { order: 28, title: 'Cell Structure and Specialisation — The cell as the basic unit of life', lessons: 2 },
      { order: 29, title: 'Chemicals of Life — Composition, properties and functions of carbohydrates (Monosaccharides)', lessons: 2 },
      { order: 30, title: 'Chemicals of Life — Composition, properties and functions of carbohydrates (Disaccharides and polysaccharides)', lessons: 2 },
      { order: 31, title: 'Chemicals of Life — Investigating the presence of carbohydrates in food substances', lessons: 2 },
      { order: 32, title: 'Chemicals of Life — Composition, properties and functions of proteins', lessons: 2 },
      { order: 33, title: 'Chemicals of Life — Composition, properties and functions of lipids', lessons: 2 },
      { order: 34, title: 'Chemicals of Life — Composition, properties and functions of vitamins', lessons: 2 },
      { order: 35, title: 'Chemicals of Life — Enzymes: Meaning and properties of enzymes', lessons: 2 },
      { order: 36, title: 'Chemicals of Life — Investigating the presence of catalase enzymes in living tissues', lessons: 2 },
      { order: 37, title: 'Chemicals of Life — Factors affecting enzyme activity: Temperature and pH', lessons: 2 },
      { order: 38, title: 'Chemicals of Life — Factors affecting enzyme activity: Substrate and enzyme concentration', lessons: 2 },
      { order: 39, title: 'Chemicals of Life — Functions of water and mineral salts', lessons: 2 },
      { order: 40, title: 'Chemicals of Life — Importance of chemical components in cells', lessons: 2 },
    ]
  },
  {
    strand_order: 2,
    title: 'Anatomy and Physiology of Plants',
    substrands: [
      { order: 1, title: 'Nutrition — Types of nutrition in plants (Autotrophism and Heterotrophism)', lessons: 2 },
      { order: 2, title: 'Nutrition — Parasitism as a mode of nutrition in plants', lessons: 2 },
      { order: 3, title: 'Nutrition — Saprophytic, symbiotic and insectivorous modes of nutrition', lessons: 2 },
      { order: 4, title: 'Nutrition — Structure of the chloroplast', lessons: 2 },
      { order: 5, title: 'Nutrition — Function of the chloroplast in plants', lessons: 2 },
      { order: 6, title: 'Nutrition — The process of photosynthesis', lessons: 2 },
      { order: 7, title: 'Nutrition — The light stage of photosynthesis', lessons: 2 },
      { order: 8, title: 'Nutrition — The dark stage of photosynthesis', lessons: 2 },
      { order: 9, title: 'Nutrition — Comparing the light and dark stages of photosynthesis', lessons: 2 },
      { order: 10, title: 'Nutrition — Significance of photosynthesis in nature', lessons: 2 },
      { order: 11, title: 'Nutrition — Other products of photosynthesis', lessons: 2 },
      { order: 12, title: 'Nutrition — Assessment and review on nutrition in plants', lessons: 2 },
      { order: 13, title: 'Transport — External structures of the plant transport system', lessons: 2 },
      { order: 14, title: 'Transport — Structure and function of roots in transport', lessons: 2 },
      { order: 15, title: 'Transport — Internal structure of the root (transverse section)', lessons: 2 },
      { order: 16, title: 'Transport — Structure and function of stems in transport', lessons: 2 },
      { order: 17, title: 'Transport — Structure and function of leaves in transport', lessons: 2 },
      { order: 18, title: 'Transport — Structure, functions and adaptations of xylem vessels', lessons: 2 },
      { order: 19, title: 'Transport — Structure, functions and adaptations of phloem tissue', lessons: 2 },
      { order: 20, title: 'Transport — Arrangement of vascular tissues in roots of monocots and dicots', lessons: 2 },
      { order: 21, title: 'Transport — Arrangement of vascular tissues in stems of monocots and dicots', lessons: 2 },
      { order: 22, title: 'Transport — Mechanisms of water uptake in plants (osmosis and active transport)', lessons: 2 },
      { order: 23, title: 'Transport — Movement of water up the plant (transpiration pull, cohesion, adhesion)', lessons: 2 },
      { order: 24, title: 'Transport — Absorption of mineral salts and demonstrating water uptake', lessons: 2 },
      { order: 25, title: 'Transport — The process of transpiration', lessons: 2 },
      { order: 26, title: 'Transport — Structural factors affecting the rate of transpiration', lessons: 2 },
      { order: 27, title: 'Transport — Environmental factors affecting transpiration (Temperature and light)', lessons: 2 },
      { order: 28, title: 'Transport — Environmental factors affecting transpiration (Wind and other factors)', lessons: 2 },
      { order: 29, title: 'Transport — Translocation of manufactured food in plants', lessons: 2 },
      { order: 30, title: 'Transport — Demonstrating translocation by bark ringing', lessons: 2 },
      { order: 31, title: 'Gaseous Exchange and Respiration — Meaning and significance of gaseous exchange in plants', lessons: 2 },
      { order: 32, title: 'Gaseous Exchange and Respiration — Stomata as a site for gaseous exchange', lessons: 2 },
      { order: 33, title: 'Gaseous Exchange and Respiration — Distribution of stomata in different plant habitats', lessons: 2 },
      { order: 34, title: 'Gaseous Exchange and Respiration — Lenticels as gaseous exchange sites in stems', lessons: 2 },
      { order: 35, title: 'Gaseous Exchange and Respiration — Pneumatophores as gaseous exchange sites in roots', lessons: 2 },
      { order: 36, title: 'Gaseous Exchange and Respiration — Photosynthetic theory of stomatal opening and closing', lessons: 2 },
      { order: 37, title: 'Gaseous Exchange and Respiration — Starch-sugar inter-conversion theory', lessons: 2 },
      { order: 38, title: 'Gaseous Exchange and Respiration — Potassium ion theory of stomatal opening and closing', lessons: 2 },
      { order: 39, title: 'Gaseous Exchange and Respiration — The process of respiration and aerobic respiration', lessons: 2 },
      { order: 40, title: 'Gaseous Exchange and Respiration — Anaerobic respiration in plants', lessons: 2 },
      { order: 41, title: 'Gaseous Exchange and Respiration — Investigating aerobic and anaerobic respiration', lessons: 2 },
      { order: 42, title: 'Gaseous Exchange and Respiration — Economic importance of anaerobic respiration', lessons: 2 },
      { order: 43, title: 'Gaseous Exchange and Respiration — Biogas production project', lessons: 3 },
      { order: 44, title: 'Gaseous Exchange and Respiration — Significance of gaseous exchange and respiration', lessons: 2 },
      { order: 45, title: 'Gaseous Exchange and Respiration — Assessment and review on gaseous exchange', lessons: 2 },
    ]
  },
  {
    strand_order: 3,
    title: 'Anatomy and Physiology of Animals',
    substrands: [
      { order: 1, title: 'Mouthparts of insects — Structure of mouthparts of insects and their functions', lessons: 2 },
      { order: 2, title: 'Mouthparts of insects — Biting and chewing mouthparts', lessons: 2 },
      { order: 3, title: 'Mouthparts of insects — Piercing and sucking mouthparts', lessons: 2 },
      { order: 4, title: 'Mouthparts of insects — Siphoning mouthparts', lessons: 2 },
      { order: 5, title: 'Mouthparts of insects — Comparing mouthparts and modes of feeding', lessons: 2 },
      { order: 6, title: 'Beaks of birds — Structure of beaks of birds', lessons: 2 },
      { order: 7, title: 'Beaks of birds — Filter feeders, fish eaters and wood chippers', lessons: 2 },
      { order: 8, title: 'Beaks of birds — Fruit eaters, multipurpose feeders and insect eaters', lessons: 2 },
      { order: 9, title: 'Beaks of birds — Nature walk to observe birds and their feeding habits', lessons: 2 },
      { order: 10, title: 'Beaks of birds — Comparing beaks and modes of feeding in birds', lessons: 2 },
      { order: 11, title: 'Importance of diversity in feeding modes of insects and birds', lessons: 2 },
      { order: 12, title: 'Significance of transport in animals', lessons: 2 },
      { order: 13, title: 'Types of circulatory systems — Open and closed circulatory systems', lessons: 2 },
      { order: 14, title: 'Types of circulatory systems — Single and double circulatory systems', lessons: 2 },
      { order: 15, title: 'Transport system in insects', lessons: 2 },
      { order: 16, title: 'Transport system in fish — Structure and blood flow', lessons: 2 },
      { order: 17, title: 'Transport system in fish — Illustrating the circulatory system', lessons: 2 },
      { order: 18, title: 'Transport system in amphibians — Structure and blood flow', lessons: 2 },
      { order: 19, title: 'Transport system in amphibians — Illustrating the circulatory system', lessons: 2 },
      { order: 20, title: 'Transport system in reptiles — Structure and blood flow', lessons: 2 },
      { order: 21, title: 'Transport system in reptiles — Illustrating the circulatory system', lessons: 2 },
      { order: 22, title: 'Transport system in mammals — Structure and components', lessons: 2 },
      { order: 23, title: 'Transport system in mammals — Pulmonary and systemic circulation', lessons: 2 },
      { order: 24, title: 'Transport system in mammals — Illustrating the circulatory system', lessons: 2 },
      { order: 25, title: 'Transport system in mammals — Dissection of a small mammal', lessons: 2 },
      { order: 26, title: 'Pumping mechanism of the mammalian heart — Structure of the heart', lessons: 2 },
      { order: 27, title: 'Pumping mechanism of the mammalian heart — The cardiac cycle', lessons: 2 },
      { order: 28, title: 'Human lymphatic system — Structure and components', lessons: 2 },
      { order: 29, title: 'Human lymphatic system — Functions', lessons: 2 },
      { order: 30, title: 'Human immune system — Types of immunity', lessons: 2 },
      { order: 31, title: 'Human immune system — Active and passive immunity', lessons: 2 },
      { order: 32, title: 'Blood clotting mechanism in humans', lessons: 2 },
      { order: 33, title: 'Blood clotting mechanism — Importance and flow chart', lessons: 2 },
      { order: 34, title: 'ABO and rhesus factor blood grouping — Blood groups and antigens', lessons: 2 },
      { order: 35, title: 'ABO and rhesus factor blood grouping — Rhesus factor and blood transfusion', lessons: 2 },
      { order: 36, title: 'Respiratory surfaces in animals — General characteristics', lessons: 2 },
      { order: 37, title: 'Respiratory structures in insects — Tracheal system', lessons: 2 },
      { order: 38, title: 'Respiratory structures in insects — Adaptations and observation', lessons: 2 },
      { order: 39, title: 'Respiratory structures in fish — Structure of gills', lessons: 2 },
      { order: 40, title: 'Respiratory structures in fish — Counter current flow and practical observation', lessons: 2 },
      { order: 41, title: 'Respiratory structures in amphibians', lessons: 2 },
      { order: 42, title: 'Respiratory structures in birds', lessons: 2 },
      { order: 43, title: 'Mechanism of gaseous exchange in humans — Respiratory structures', lessons: 2 },
      { order: 44, title: 'Inhalation and exhalation in humans', lessons: 2 },
      { order: 45, title: 'Model to demonstrate inhalation and exhalation', lessons: 2 },
      { order: 46, title: 'Dissection to observe gaseous exchange structures in mammals', lessons: 2 },
      { order: 47, title: 'Aerobic respiration in animals', lessons: 2 },
      { order: 48, title: 'Demonstrating aerobic respiration in animals', lessons: 2 },
      { order: 49, title: 'Anaerobic respiration and oxygen debt', lessons: 2 },
      { order: 50, title: 'Factors affecting energy requirement in humans', lessons: 2 },
      { order: 51, title: 'Respiratory substrates', lessons: 2 },
      { order: 52, title: 'Calculating the respiratory quotient', lessons: 2 },
      { order: 53, title: 'Factors affecting the rate of respiration', lessons: 2 },
      { order: 54, title: 'Importance of gaseous exchange and respiration in animals', lessons: 2 },
    ]
  }
]

async function seedBiology() {
  console.log('🌱 Seeding Biology Grade 10...')
  console.log('='.repeat(50))

  // Get Grade 10 — use first one
  const { data: grades } = await db
    .from('sow_grades')
    .select('id, name')
    .eq('numeric_grade', 10)
    .limit(1)

  if (!grades || grades.length === 0) {
    console.log('❌ Grade 10 not found')
    return
  }

  const grade10Id = grades[0].id
  console.log('✅ Grade 10 found:', grade10Id)

  // Find Biology learning area
  const { data: areas } = await db
    .from('sow_learning_areas')
    .select('id, name')
    .eq('grade_id', grade10Id)
    .ilike('name', '%biology%')

  if (!areas || areas.length === 0) {
    console.log('❌ Biology learning area not found')
    return
  }

  const bioAreaId = areas[0].id
  console.log('✅ Biology area found:', bioAreaId)

  let totalStrands = 0
  let totalSubstrands = 0

  // Seed each strand
  for (const strand of BIOLOGY_DATA) {
    const { data: strandRow, error: strandErr } = await db
      .from('sow_strands')
      .insert({
        learning_area_id: bioAreaId,
        title: strand.title,
        order_index: strand.strand_order,
        source_type: 'verified'
      })
      .select()
      .single()

    if (strandErr || !strandRow) {
      console.log('❌ Strand error:', strandErr?.message)
      continue
    }

    totalStrands++
    console.log(`\n✅ STRAND ${strand.strand_order}: ${strand.title}`)

    // Seed substrands in batches of 20
    const batches = []
    for (let i = 0; i < strand.substrands.length; i += 20) {
      batches.push(strand.substrands.slice(i, i + 20))
    }

    for (const batch of batches) {
      const subRows = batch.map(sub => ({
        strand_id: strandRow.id,
        title: sub.title,
        suggested_lessons: sub.lessons,
        order_index: sub.order,
        source_type: 'verified'
      }))

      const { error: subErr } = await db
        .from('sow_substrands')
        .insert(subRows)

      if (subErr) {
        console.log('❌ Substrand error:', subErr.message)
      } else {
        totalSubstrands += batch.length
        console.log(`   ✅ ${batch.length} substrands seeded`)
      }

      // Small delay
      await new Promise(r => setTimeout(r, 200))
    }
  }

  console.log('\n' + '='.repeat(50))
  console.log('🎉 BIOLOGY GRADE 10 SEEDED!')
  console.log(`✅ Strands: ${totalStrands}`)
  console.log(`✅ Substrands: ${totalSubstrands}`)
  console.log('source_type: verified ✅')
  console.log('='.repeat(50))
}

seedBiology().catch(console.error)
