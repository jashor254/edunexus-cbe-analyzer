// scripts/career-tier-distribution.ts
//
// Run: npx tsx --env-file=.env.local scripts/career-tier-distribution.ts [--by-grade] [--out <path.csv>]
//
// FIX 5 of the Career Intelligence corrective pass — an EQUITY CHECK, not a
// feature. Reads, writes nothing to the database, and is never an input to
// any learner's matching.
//
// The question it answers: are learners from some schools systematically
// pushed toward "Alternative Path" matches? Raw CBC levels mix learner ability
// with school quality, so a school with weaker teaching can push every one of
// its learners down the tiers. This report makes that visible per school.
//
// Definitions
// -----------
// Population   Every learner with a SAVED capability profile
//              (students.capability_profile). Projection is NOT recomputed —
//              recomputing writes projection rows, and this script must not
//              write. Saved profiles may predate the current extractor (e.g.
//              the FIX 1 resilience change); matching itself runs on the
//              current engine (FIX 2/3 included).
// School       The Core school: students.external_id → learners.school_id.
//              Learners with no Core school are reported as their own row,
//              never dropped.
// Best tier    Per learner, the highest tier any career reaches for them in
//              computeCapabilityMatches: primary ("Strong Match") > stretch
//              ("Stretch Goal") > alternative ("Alternative Path"). "None"
//              means no career could be scored (no observed evidence for any
//              career's required dimensions).
// Entrepreneurial
//              Counted separately: the learner qualifies for the
//              entrepreneurial tier (an extra promotion of one career, on top
//              of their best scored tier).
// Small sample Rows with fewer than COHORT_RELATIVE_MIN_LEARNERS (15) learners
//              are flagged — their percentages move a lot with one learner.
//
// Output: a table in the terminal and a CSV (default
// scripts/_tmp/career-tier-distribution-YYYY-MM-DD.csv, gitignored). Counts
// and school identifiers only — no learner names or ids.

import { mkdirSync, writeFileSync } from 'node:fs'
import { dirname } from 'node:path'
import { repos } from '@/lib/repositories'
import { computeCapabilityMatches } from '@/lib/career/capabilityMatchEngine'
import { COHORT_RELATIVE_MIN_LEARNERS } from '@/lib/config/careerCohort'

type BestTier = 'primary' | 'stretch' | 'alternative' | 'none'

type Row = {
  key: string
  schoolId: string
  schoolName: string
  grade: string
  learners: number
  primary: number
  stretch: number
  alternative: number
  none: number
  entrepreneurial: number
}

function argValue(flag: string): string | null {
  const i = process.argv.indexOf(flag)
  return i >= 0 && process.argv[i + 1] ? process.argv[i + 1] : null
}

function pct(n: number, d: number): string {
  return d === 0 ? '—' : `${Math.round((100 * n) / d)}%`
}

function csvCell(v: string | number): string {
  const s = String(v)
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s
}

async function main(): Promise<void> {
  const byGrade = process.argv.includes('--by-grade')
  const today = new Date().toISOString().slice(0, 10)
  const out = argValue('--out') ?? `scripts/_tmp/career-tier-distribution-${today}.csv`

  const [careers, learners] = await Promise.all([
    repos.careers.getAllCareersWithCOS(),
    repos.careers.findSavedCapabilityProfilesWithSchool(),
  ])

  const rows = new Map<string, Row>()
  for (const l of learners) {
    const report = computeCapabilityMatches(l.studentId, l.profile, careers)
    const best: BestTier = report.primary.length ? 'primary'
      : report.stretch.length ? 'stretch'
      : report.alternative.length ? 'alternative'
      : 'none'

    const schoolId = l.schoolId ?? '(none)'
    const grade = byGrade ? String(l.grade ?? '(none)') : 'all'
    const key = `${schoolId}|${grade}`
    const row = rows.get(key) ?? {
      key, schoolId, grade,
      schoolName: l.schoolId ? (l.schoolName ?? '(unnamed school)') : '(no school on record)',
      learners: 0, primary: 0, stretch: 0, alternative: 0, none: 0, entrepreneurial: 0,
    }
    row.learners++
    row[best]++
    if (report.entrepreneurial.length > 0) row.entrepreneurial++
    rows.set(key, row)
  }

  const sorted = [...rows.values()].sort((a, b) => b.learners - a.learners || a.key.localeCompare(b.key))
  const total: Row = sorted.reduce<Row>((t, r) => ({
    ...t,
    learners: t.learners + r.learners, primary: t.primary + r.primary, stretch: t.stretch + r.stretch,
    alternative: t.alternative + r.alternative, none: t.none + r.none, entrepreneurial: t.entrepreneurial + r.entrepreneurial,
  }), { key: 'total', schoolId: '', schoolName: 'ALL SCHOOLS', grade: byGrade ? 'all' : 'all', learners: 0, primary: 0, stretch: 0, alternative: 0, none: 0, entrepreneurial: 0 })

  const header = ['School', ...(byGrade ? ['Grade'] : []), 'Learners', 'Primary', 'Stretch', 'Alternative', 'None', '% Alternative', 'Entrepreneurial', 'Note']
  const toCells = (r: Row): string[] => [
    r.schoolName.slice(0, 40), ...(byGrade ? [r.grade] : []), String(r.learners),
    `${r.primary} (${pct(r.primary, r.learners)})`, `${r.stretch} (${pct(r.stretch, r.learners)})`,
    `${r.alternative} (${pct(r.alternative, r.learners)})`, `${r.none} (${pct(r.none, r.learners)})`,
    pct(r.alternative, r.learners), `${r.entrepreneurial} (${pct(r.entrepreneurial, r.learners)})`,
    r.key !== 'total' && r.learners < COHORT_RELATIVE_MIN_LEARNERS ? 'small sample' : '',
  ]
  const table = [header, ...sorted.map(toCells), toCells(total)]
  const widths = header.map((_, c) => Math.max(...table.map(r => r[c].length)))
  const line = (cells: string[]): string => cells.map((v, c) => (c === 0 ? v.padEnd(widths[c]) : v.padStart(widths[c]))).join('  ')

  console.log(`\nCareer match tier distribution by school${byGrade ? ' and grade' : ''} — ${today}`)
  console.log(`Population: ${learners.length} learners with a saved capability profile; ${careers.length} careers in the corpus.\n`)
  console.log(line(table[0]))
  console.log(widths.map(w => '-'.repeat(w)).join('  '))
  for (const r of table.slice(1, -1)) console.log(line(r))
  console.log(widths.map(w => '-'.repeat(w)).join('  '))
  console.log(line(table[table.length - 1]))
  console.log('\nBest tier = highest tier any career reaches for the learner. "None" = no career scorable from observed evidence.')
  console.log(`Entrepreneurial is counted on top of the best tier. Rows under ${COHORT_RELATIVE_MIN_LEARNERS} learners are flagged "small sample".`)
  console.log('Read-only: saved profiles are used as-is; Projection is not recomputed. This is a result for this dataset, not a general rate.')

  const csvHeader = ['school_id', 'school_name', ...(byGrade ? ['grade'] : []), 'learners', 'primary', 'stretch', 'alternative', 'none', 'pct_alternative', 'entrepreneurial_eligible', 'small_sample']
  const csvRows = [...sorted, total].map(r => [
    r.schoolId, r.schoolName, ...(byGrade ? [r.grade] : []), r.learners, r.primary, r.stretch, r.alternative, r.none,
    r.learners ? Math.round((100 * r.alternative) / r.learners) : '', r.entrepreneurial,
    r.key !== 'total' && r.learners < COHORT_RELATIVE_MIN_LEARNERS ? 'yes' : 'no',
  ].map(csvCell).join(','))
  mkdirSync(dirname(out), { recursive: true })
  writeFileSync(out, [csvHeader.join(','), ...csvRows].join('\n') + '\n')
  console.log(`\nCSV written: ${out}`)
}

main().catch(err => {
  console.error('[career-tier-distribution] failed:', err instanceof Error ? err.message : err)
  process.exit(1)
})
