// scripts/kicd/load-kicd-data.ts
//
// Loads parsed KICD curriculum-design entries into `sow_strands.kicd_data`,
// the grounding source for SOW generation (lib/sow/kicdGrounding.ts).
//
// For every design in scripts/kicd/designs.json:
//   1. parse the PDF (scripts/kicd/parse_kicd_design.py)
//   2. find the subject's learning areas (all duplicate seed rows for the
//      grade) and their strands + sub-strand rows
//   3. map each DB strand to the parsed KICD strand whose sub-strands best
//      explain its rows — using the SAME matcher the generator uses
//      (matchKicdEntry), so "mapped" here means "will ground lessons"
//   4. mode "replace": write the entries to strands whose kicd_data is empty
//      (or all strands with --force); mode "merge-attributes": keep existing
//      entries and add core_competencies / values / pcis by sub-strand number
//
// Dry run by default — prints coverage and writes nothing. `--apply` writes,
// after saving the touched strands' previous kicd_data to a backup file.
//
//   npx tsx -r dotenv/config scripts/kicd/load-kicd-data.ts [--apply] [--force] [--verbose] [--only=<substring>] dotenv_config_path=.env.local
//
// .env.local points at the LOCAL database; production needs
// dotenv_config_path=.env.local.kangai.bak.

import { execFileSync } from 'node:child_process'
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs'
import { join } from 'node:path'
import { createServiceClient } from '../../utils/supabase/service'
import { parseKicdEntries, matchKicdEntry } from '../../lib/curriculum/kicdEntries'

type Design = { file: string; grades: string[]; areas: string[]; mode: 'replace' | 'merge-attributes' }

type ParsedSubStrand = {
  title: string
  number: string
  suggested_lessons: number | null
  content: string[]
  learning_outcomes: string[]
  learning_experiences: string[]
  key_inquiry_questions: string[]
  core_competencies: string[]
  values: string[]
  pcis: string[]
}
type ParsedDesign = { source: string; strands: Array<{ number: string; title: string; sub_strands: ParsedSubStrand[] }> }

type KicdDataEntry = {
  title: string
  suggested_lessons: number | null
  content: string[]
  learning_outcomes: string[]
  learning_experiences: string[]
  key_inquiry_questions: string[]
  core_competencies: string[]
  values: string[]
  pcis: string[]
}

type DbStrand = { id: string; title: string; learning_area_id: string; order_index: number; kicd_data: unknown; rows: string[] }

const ROOT = join(__dirname, '..', '..')
const args = process.argv.slice(2)
const APPLY = args.includes('--apply')
const FORCE = args.includes('--force')
const ONLY = args.find(a => a.startsWith('--only='))?.slice('--only='.length)
const VERBOSE = args.includes('--verbose')

function toEntry(s: ParsedSubStrand): KicdDataEntry {
  return {
    title: s.title,
    suggested_lessons: s.suggested_lessons,
    content: s.content,
    learning_outcomes: s.learning_outcomes,
    learning_experiences: s.learning_experiences,
    key_inquiry_questions: s.key_inquiry_questions,
    core_competencies: s.core_competencies,
    values: s.values,
    pcis: s.pcis,
  }
}

function parseDesign(file: string): ParsedDesign {
  const out = execFileSync('python3', [join(ROOT, 'scripts/kicd/parse_kicd_design.py'), join(ROOT, file)], {
    encoding: 'utf8',
    maxBuffer: 64 * 1024 * 1024,
  })
  return JSON.parse(out) as ParsedDesign
}

function titleOverlap(a: string, b: string): number {
  const tok = (s: string) => new Set(s.toLowerCase().split(/[^a-zÀ-ɏ]+/).filter(t => t.length > 3))
  const ta = tok(a), tb = tok(b)
  let shared = 0
  for (const t of ta) if (tb.has(t)) shared++
  return ta.size && tb.size ? shared / Math.min(ta.size, tb.size) : 0
}

function numberOf(title: string): string | null {
  const m = title.match(/^\s*(\d+(?:\.\d+)+)/)
  return m ? m[1] : null
}

async function main(): Promise<void> {
  const designs = (JSON.parse(readFileSync(join(ROOT, 'scripts/kicd/designs.json'), 'utf8')) as Design[])
    .filter(d => !ONLY || d.file.includes(ONLY))
  const db = createServiceClient()
  const updates: Array<{ id: string; kicd_data: unknown; previous: unknown; label: string }> = []
  let totalRows = 0, groundedBefore = 0, groundedAfter = 0

  for (const design of designs) {
    const parsed = parseDesign(design.file)
    const kicdStrands = parsed.strands
      .map(s => ({ ...s, entries: s.sub_strands.map(toEntry) }))
      .filter(s => s.entries.length > 0)

    const { data: grades, error: gErr } = await db.from('sow_grades').select('id, name').in('name', design.grades)
    if (gErr) throw new Error(`grades: ${gErr.message}`)
    const { data: areas, error: aErr } = await db
      .from('sow_learning_areas')
      .select('id, name, grade_id')
      .in('grade_id', (grades ?? []).map(g => g.id))
      .in('name', design.areas)
    if (aErr) throw new Error(`areas: ${aErr.message}`)
    if (!areas?.length) {
      console.log(`\n${design.file}: no learning area named ${design.areas.join(' / ')} under ${design.grades.join(' / ')} — skipped`)
      continue
    }
    const { data: strands, error: sErr } = await db
      .from('sow_strands')
      .select('id, title, learning_area_id, order_index, kicd_data')
      .in('learning_area_id', areas.map(a => a.id))
    if (sErr) throw new Error(`strands: ${sErr.message}`)
    const { data: subs, error: ssErr } = await db
      .from('sow_substrands')
      .select('strand_id, title, order_index')
      .in('strand_id', (strands ?? []).map(s => s.id))
      .order('order_index')
    if (ssErr) throw new Error(`substrands: ${ssErr.message}`)

    const dbStrands: DbStrand[] = (strands ?? []).map(s => ({
      ...s,
      rows: (subs ?? []).filter(r => r.strand_id === s.id).map(r => r.title),
    }))

    let areaRows = 0, areaBefore = 0, areaAfter = 0, mapped = 0
    const unmatchedSamples: string[] = []

    // Which parsed KICD strand is each DB strand? Evidence, strongest first:
    //  - the strand titles agree ("POLLUTION" ↔ "3. POLLUTION")
    //  - rows match entry TITLES (strict: no skill-position / content
    //    fallback — every English theme has a listening entry, so a fallback
    //    match says nothing about the theme)
    //  - same position in the design (DB strands are seeded in KICD order)
    // Within one learning area each KICD strand is claimed by at most one DB
    // strand (greedy, best score first): without this, Literature in English
    // strands 2–9 all claimed "1. Oral Literature" because every row
    // mentions oral literature and most theme titles are blank.
    type Candidate = { strandId: string; idx: number; score: number; strict: number; overlap: number }
    const assignment = new Map<string, Candidate>()
    for (const areaId of new Set(dbStrands.map(d => d.learning_area_id))) {
      const inArea = dbStrands.filter(d => d.learning_area_id === areaId).sort((a, b) => a.order_index - b.order_index)
      const candidates: Candidate[] = []
      inArea.forEach((strand, rank) => {
        kicdStrands.forEach((k, idx) => {
          const entries = parseKicdEntries(k.entries)
          const strict = strand.rows.filter(r => matchKicdEntry(r, entries, { strict: true }) !== null).length / Math.max(1, strand.rows.length)
          const overlap = titleOverlap(strand.title, k.title)
          candidates.push({ strandId: strand.id, idx, strict, overlap, score: strict + (overlap >= 0.6 ? 1 : overlap * 0.5) + (idx === rank ? 0.25 : 0) })
        })
      })
      const taken = new Set<number>()
      for (const c of candidates.sort((a, b) => b.score - a.score)) {
        if (assignment.has(c.strandId) || taken.has(c.idx)) continue
        assignment.set(c.strandId, c)
        taken.add(c.idx)
      }
    }

    for (const strand of dbStrands) {
      areaRows += strand.rows.length
      const existing = parseKicdEntries(strand.kicd_data)
      areaBefore += strand.rows.filter(r => matchKicdEntry(r, existing) !== null).length

      const chosen = assignment.get(strand.id) ?? null
      const chosenEntries = chosen ? parseKicdEntries(kicdStrands[chosen.idx].entries) : []
      const fullMatched = strand.rows.filter(r => matchKicdEntry(r, chosenEntries) !== null).length
      // Writing a strand's entries is safe whenever the strand identity is
      // certain: rows the entries do not cover still get no match (the
      // per-row matcher returns null), so they stay honestly ungrounded.
      const credible = !!chosen && (
        chosen.overlap >= 0.6
        || (fullMatched / Math.max(1, strand.rows.length) >= 0.5 && chosen.strict >= 0.3)
      )

      let next: unknown = strand.kicd_data
      if (design.mode === 'merge-attributes') {
        if (existing.length && chosen) {
          const parsedByNumber = new Map(kicdStrands.flatMap(k => k.entries).map(e => [numberOf(e.title), e]))
          const raw = Array.isArray(strand.kicd_data) ? (strand.kicd_data as Array<Record<string, unknown>>) : []
          next = raw.map(e => {
            const p = parsedByNumber.get(numberOf(String(e.title ?? '')))
            return p ? { ...e, core_competencies: p.core_competencies, values: p.values, pcis: p.pcis } : e
          })
          mapped++
        }
      } else if (credible && (existing.length === 0 || FORCE)) {
        next = kicdStrands[chosen.idx].entries
        mapped++
      }

      if (VERBOSE && chosen) {
        const k = kicdStrands[chosen.idx]
        console.log(`    ${strand.title.slice(0, 40).padEnd(40)} -> ${k.number}. ${k.title.slice(0, 40).padEnd(40)} strict ${Math.round(chosen.strict * 100)}% title ${chosen.overlap.toFixed(2)} grounded ${fullMatched}/${strand.rows.length}${credible ? '' : '  (not credible)'}`)
      }
      const after = parseKicdEntries(next)
      const groundedRows = strand.rows.filter(r => matchKicdEntry(r, after) !== null)
      areaAfter += groundedRows.length
      for (const r of strand.rows) if (!groundedRows.includes(r) && unmatchedSamples.length < 4) unmatchedSamples.push(`${strand.title} :: ${r}`)

      if (next !== strand.kicd_data) {
        updates.push({ id: strand.id, kicd_data: next, previous: strand.kicd_data, label: design.file })
      }
    }

    totalRows += areaRows; groundedBefore += areaBefore; groundedAfter += areaAfter
    const pct = (n: number) => (areaRows ? Math.round((100 * n) / areaRows) : 0)
    console.log(`\n${design.file} → ${design.areas.join(' / ')} (${areas.length} area rows, ${dbStrands.length} strands, ${kicdStrands.length} KICD strands)`)
    console.log(`  strands updated: ${mapped}/${dbStrands.length}   rows grounded: ${areaBefore} → ${areaAfter} of ${areaRows} (${pct(areaBefore)}% → ${pct(areaAfter)}%)`)
    for (const u of unmatchedSamples) console.log(`    ungrounded: ${u}`)
  }

  const pctAll = (n: number) => (totalRows ? Math.round((100 * n) / totalRows) : 0)
  console.log(`\nTOTAL rows grounded: ${groundedBefore} → ${groundedAfter} of ${totalRows} (${pctAll(groundedBefore)}% → ${pctAll(groundedAfter)}%); strands to update: ${updates.length}`)

  if (!APPLY) {
    console.log('\nDry run — nothing written. Re-run with --apply to write.')
    return
  }
  const backupDir = join(ROOT, 'scripts/kicd/backups')
  mkdirSync(backupDir, { recursive: true })
  const backupFile = join(backupDir, `kicd_data-${new Date().toISOString().replace(/[:.]/g, '-')}.json`)
  writeFileSync(backupFile, JSON.stringify(updates.map(u => ({ id: u.id, kicd_data: u.previous })), null, 1))
  console.log(`Backup of previous kicd_data: ${backupFile}`)

  // Targeted UPDATE of kicd_data only. An upsert carrying a partial row is
  // rejected by NOT NULL columns it does not send (order_index), and could
  // overwrite columns it does — this touches nothing else.
  const CONCURRENCY = 5
  let written = 0
  for (let i = 0; i < updates.length; i += CONCURRENCY) {
    const batch = updates.slice(i, i + CONCURRENCY)
    const results = await Promise.all(batch.map(u =>
      db.from('sow_strands').update({ kicd_data: u.kicd_data, updated_at: new Date().toISOString() }).eq('id', u.id).select('id'),
    ))
    for (const [k, r] of results.entries()) {
      if (r.error || !r.data?.length) {
        throw new Error(`write failed for strand ${batch[k].id} (${written} written so far): ${r.error?.message ?? 'no row updated'} — restore from ${backupFile}`)
      }
      written++
    }
  }
  console.log(`Wrote kicd_data for ${updates.length} strands.`)
}

main().catch(err => {
  console.error(err instanceof Error ? err.message : err)
  process.exit(1)
})
