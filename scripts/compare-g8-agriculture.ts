import * as dotenv from 'dotenv'
import * as path from 'path'

dotenv.config({ path: path.resolve(__dirname, '../.env.local') })

const URL = process.env.NEXT_PUBLIC_SUPABASE_URL as string
const KEY = process.env.SUPABASE_SERVICE_ROLE_KEY as string

async function rpc(sql: string) {
  const r = await fetch(`${URL}/rest/v1/rpc/execute_sql`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      apikey: KEY,
      Authorization: `Bearer ${KEY}`,
    },
    body: JSON.stringify({ query: sql }),
  })
  return r.json()
}

async function get(table: string, params: Record<string, string>) {
  const qs = new URLSearchParams(params).toString()
  const r = await fetch(`${URL}/rest/v1/${table}?${qs}`, {
    headers: { apikey: KEY, Authorization: `Bearer ${KEY}` },
  })
  return r.json()
}

const COMPLETE: Record<string, string[]> = {
  'CONSERVATION OF RESOURCES': [
    'Importance of Soil Conservation',
    'Types of Soil Erosion',
    'Causes of Soil Erosion',
    'Effects of Soil Erosion',
    'Methods of Soil Erosion Control',
    'Soil Erosion Control Structures',
    'Fanya Juu Terraces',
    'Fanya Chini Terraces',
    'Contour Farming',
    'Strip Cropping',
    'Cover Cropping',
    'Mulching',
    'Grass Strips',
    'Cut-off Drains',
    'Importance of Water Conservation',
    'Methods of Water Conservation',
    'Rainwater Harvesting',
    'Minimum Tillage',
    'Zero Tillage',
  ],
  'FOOD PRODUCTION PROCESSES': [
    'Importance of Food Production',
    'Types of Food Crops',
    'Cereal Crops',
    'Root and Tuber Crops',
    'Legume Crops',
    'Vegetable Crops',
    'Fruit Crops',
    'Crop Rotation',
    'Importance of Crop Rotation',
    'Crop Rotation Practices',
    'Principles of Crop Rotation',
    'Cover Crops in Rotation',
    'Mixed Cropping',
    'Importance of Mixed Cropping',
    'Benefits of Mixed Cropping',
    'Mixed Cropping Practices',
    'Inter-cropping',
    'Importance of Inter-cropping',
    'Benefits of Inter-cropping',
    'Inter-cropping Patterns',
    'Irrigation',
    'Importance of Irrigation',
    'Types of Irrigation Systems',
    'Drip Irrigation',
    'Sprinkler Irrigation',
    'Surface Irrigation',
    'Irrigation Scheduling',
    'Organic Farming',
    'Importance of Organic Farming',
    'Benefits of Organic Farming',
    'Organic Farming Practices',
    'Composting',
    'Green Manuring',
    'Crop Protection',
    'Common Crop Pests',
    'Common Crop Diseases',
    'Pest and Disease Control',
    'Biological Control',
    'Chemical Control',
    'Cultural Control',
    'Harvesting',
    'Importance of Harvesting',
    'Methods of Harvesting',
    'Post-Harvest Handling',
    'Threshing',
    'Winnowing',
    'Storage',
    'Importance of Storage',
    'Methods of Storage',
    'Storage Structures',
    'Grain Storage',
    'Root Crop Storage',
    'Value Addition',
    'Importance of Value Addition',
    'Methods of Value Addition',
    'Food Processing',
    'Preservation Methods',
    'Packaging',
    'Marketing',
    'Importance of Marketing',
    'Market Structures',
    'Marketing Channels',
    'Agricultural Cooperatives',
  ],
  'HYGIENE PRACTICES': [
    'Personal Hygiene',
    'Importance of Personal Hygiene',
    'Food Hygiene',
    'Importance of Food Hygiene',
    'Kitchen Hygiene',
    'Importance of Kitchen Hygiene',
    'Environmental Hygiene',
    'Importance of Environmental Hygiene',
    'Waste Management',
  ],
  'PRODUCTION TECHNIQUES': [
    'Land Preparation',
    'Importance of Land Preparation',
    'Methods of Land Preparation',
    'Primary Tillage',
    'Secondary Tillage',
    'Minimum Tillage',
    'Zero Tillage',
    'Planting',
    'Importance of Planting',
    'Planting Methods',
    'Plant Spacing',
    'Seed Selection',
    'Fertilizer Application',
    'Importance of Fertilizer Application',
    'Types of Fertilizers',
    'Organic Fertilizers',
    'Inorganic Fertilizers',
    'Fertilizer Application Methods',
    'Weed Control',
    'Importance of Weed Control',
    'Methods of Weed Control',
    'Mechanical Weed Control',
    'Chemical Weed Control',
    'Cultural Weed Control',
    'Water Management',
    'Importance of Water Management',
    'Methods of Water Management',
    'Irrigation Techniques',
    'Drainage',
    'Soil Management',
    'Importance of Soil Management',
    'Methods of Soil Management',
    'Soil Testing',
  ],
}

async function main() {
  // Fetch all G8 Agriculture substrands grouped by strand
  const r = await fetch(
    `${URL}/rest/v1/substrands?select=title,strand_id,strands!inner(title,subject_id,subjects!inner(name,grade_id,grades!inner(name)))&strands.subjects.name=ilike.*agriculture*&strands.subjects.grades.name=eq.Grade 8`,
    {
      headers: { apikey: KEY, Authorization: `Bearer ${KEY}`, Prefer: 'return=representation' },
    }
  )

  // Use RPC approach instead — query via PostgREST joins
  const queryUrl = `${URL}/rest/v1/substrands?select=title,strands!inner(title,subjects!inner(name,grades!inner(name)))&strands.subjects.grades.name=eq.Grade 8&strands.subjects.name=ilike.*griculture*`
  const r2 = await fetch(queryUrl, {
    headers: { apikey: KEY, Authorization: `Bearer ${KEY}` },
  })

  if (!r2.ok) {
    console.error('Query failed:', r2.status, await r2.text())
    return
  }

  const rows: Array<{ title: string; strands: { title: string; subjects: { name: string; grades: { name: string } } } }> = await r2.json()

  if (!Array.isArray(rows)) {
    console.error('Unexpected response:', rows)
    return
  }

  // Group by strand
  const dbByStrand: Record<string, string[]> = {}
  for (const row of rows) {
    const strand = row.strands?.title?.toUpperCase().trim() || 'UNKNOWN'
    if (!dbByStrand[strand]) dbByStrand[strand] = []
    dbByStrand[strand].push(row.title.trim())
  }

  console.log('\n========== GRADE 8 AGRICULTURE — DB AUDIT ==========\n')
  console.log(`Total in DB: ${rows.length} substrands across ${Object.keys(dbByStrand).length} strands\n`)

  let totalMissing = 0
  let totalExtra = 0

  for (const [strand, expected] of Object.entries(COMPLETE)) {
    const inDB = dbByStrand[strand] || []
    const expectedSet = new Set(expected.map(s => s.toLowerCase()))
    const dbSet = new Set(inDB.map(s => s.toLowerCase()))

    const missing = expected.filter(e => !dbSet.has(e.toLowerCase()))
    const extra = inDB.filter(d => !expectedSet.has(d.toLowerCase()))

    console.log(`── ${strand}`)
    console.log(`   Expected: ${expected.length}  |  In DB: ${inDB.length}`)

    if (missing.length === 0 && extra.length === 0) {
      console.log('   ✅ PERFECT MATCH\n')
    } else {
      if (missing.length > 0) {
        console.log(`   ❌ MISSING (${missing.length}):`)
        missing.forEach(m => console.log(`      - ${m}`))
        totalMissing += missing.length
      }
      if (extra.length > 0) {
        console.log(`   ⚠️  EXTRA/DIFFERENT (${extra.length}):`)
        extra.forEach(e => console.log(`      + ${e}`))
        totalExtra += extra.length
      }
      console.log()
    }
  }

  // Show phantom strands (strands in DB not in our expected list)
  const phantoms = Object.keys(dbByStrand).filter(s => !Object.keys(COMPLETE).includes(s))
  if (phantoms.length > 0) {
    console.log('── PHANTOM STRANDS (in DB but not in expected list):')
    phantoms.forEach(p => console.log(`   ⚠️  "${p}" (${dbByStrand[p].length} substrands)`))
    console.log()
  }

  console.log('========== SUMMARY ==========')
  console.log(`Missing substrands: ${totalMissing}`)
  console.log(`Extra/different substrands: ${totalExtra}`)
  console.log(`Phantom strands: ${phantoms.length}`)
}

main().catch(console.error)
