import { getAllCareersWithCOS } from '../lib/career/careerEngine'
import { computeCapabilityMatches } from '../lib/career/capabilityMatchEngine'
import type { CapabilityProfile } from '../lib/career/types'

// Synthetic profile: strong analytical + technical (typical STEM student)
const stemProfile: CapabilityProfile = {
  analytical_reasoning: { level: 'strong',      raw_score: 0.75, trend: 'growing',  evidence: ['mathematics: 3.5/4'], confidence: 0.8 },
  communication:        { level: 'capable',      raw_score: 0.55, trend: 'stable',   evidence: ['english: 2.8/4'],     confidence: 0.7 },
  creative_thinking:    { level: 'developing',   raw_score: 0.38, trend: 'stable',   evidence: [],                     confidence: 0.2 },
  technical_aptitude:   { level: 'strong',       raw_score: 0.72, trend: 'growing',  evidence: ['physics: 3.2/4'],     confidence: 0.7 },
  social_intelligence:  { level: 'developing',   raw_score: 0.35, trend: 'stable',   evidence: [],                     confidence: 0.3 },
  resilience:           { level: 'capable',      raw_score: 0.52, trend: 'stable',   evidence: ['improving in 2 subjects'], confidence: 0.4 },
  dominant_cluster:     ['analytical_reasoning', 'technical_aptitude'],
  emerging_cluster:     ['communication'],
  computed_at:          new Date().toISOString(),
  assessment_count:     3,
  disclaimer:           '',
}

async function main() {
  console.log('Loading careers with COS data...')
  const careers = await getAllCareersWithCOS()
  const withCOS = careers.filter(c => c.required_capabilities)
  console.log(`Total careers: ${careers.length}, with COS data: ${withCOS.length}\n`)

  const report = computeCapabilityMatches('test-student-id', stemProfile, careers)

  console.log(`=== PRIMARY MATCHES (${report.primary.length}) ===`)
  report.primary.forEach(m => {
    console.log(`  [${Math.round(m.alignment_score * 100)}%] ${m.career_title} (${m.career_category})`)
    console.log(`    → ${m.narrative}`)
    if (m.gaps.length > 0) console.log(`    GAPS: ${m.gaps.map(g => `${g.dimension}(${g.gap_severity})`).join(', ')}`)
  })

  console.log(`\n=== STRETCH MATCHES (${report.stretch.length}) ===`)
  report.stretch.forEach(m => {
    console.log(`  [${Math.round(m.alignment_score * 100)}%] ${m.career_title}`)
  })

  console.log(`\n=== ALTERNATIVE (${report.alternative.length}) ===`)
  report.alternative.forEach(m => {
    console.log(`  [${Math.round(m.alignment_score * 100)}%] ${m.career_title}`)
  })

  console.log(`\n=== ENTREPRENEURIAL (${report.entrepreneurial.length}) ===`)
  report.entrepreneurial.forEach(m => {
    console.log(`  ${m.career_title} → ${m.narrative}`)
  })

  console.log(`\nTotal scored: ${report.total_careers_scored}`)
  console.log(`Dominant cluster: ${report.dominant_cluster.join(', ')}`)
  console.log(`Assessment count: ${report.assessment_count}`)
}

main().then(() => process.exit(0)).catch(err => { console.error(err); process.exit(1) })
