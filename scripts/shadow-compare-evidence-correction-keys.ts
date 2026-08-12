/**
 * Phase E3 — shadow supersession measurement (READ ONLY).
 *
 * Compares, for every evidence row, what the LEGACY six-field claim key
 * decided against what the NEW correction-key rule WOULD decide. Executes
 * nothing: no evidence write, no lifecycle transition, no correction-key
 * write, no projection event, no audit entry.
 *
 * The E4 gate is a single number: OLD_COEXISTS_NEW_SUPERSEDES must be 0.
 * Anything else means the new rule WIDENS supersession, which is a stop
 * signal — investigate the producer and the key, do not explain it away.
 *
 * Usage:
 *   npx tsx --env-file=.env.local scripts/shadow-compare-evidence-correction-keys.ts
 *   npx tsx --env-file=.env.local scripts/shadow-compare-evidence-correction-keys.ts --keyed-only
 */

import { runShadowComparison, type ShadowVerdict } from '@/lib/intelligence/shadowSupersession'

const VERDICTS: ShadowVerdict[] = [
  'BOTH_COEXIST', 'BOTH_SUPERSEDE', 'OLD_SUPERSEDES_NEW_COEXISTS', 'OLD_COEXISTS_NEW_SUPERSEDES',
]

function pct(n: number, total: number): string {
  return total === 0 ? '0.0%' : `${((n / total) * 100).toFixed(1)}%`
}

async function main() {
  const keyedOnly = process.argv.includes('--keyed-only')
  const report = await runShadowComparison({ keyedOnly })

  console.log('')
  console.log('════════════════════════════════════════════════════════════════')
  console.log('  EVIDENCE SUPERSESSION — SHADOW COMPARISON (read-only)')
  console.log(`  scope: ${keyedOnly ? 'keyed rows only' : 'all evidence rows'}`)
  console.log('════════════════════════════════════════════════════════════════')
  console.log('')
  console.log(`Rows evaluated: ${report.evaluated}`)
  console.log(`  with a correction_key:    ${report.keyed} (${pct(report.keyed, report.evaluated)})`)
  console.log(`  without (independent):    ${report.unkeyed} (${pct(report.unkeyed, report.evaluated)})`)
  console.log(`  malformed/unknown keys:   ${report.malformedKeys}`)
  console.log('')

  console.log('── VERDICT DISTRIBUTION ────────────────────────────────────────')
  for (const v of VERDICTS) {
    const n = report.byVerdict[v]
    const flag = v === 'OLD_COEXISTS_NEW_SUPERSEDES' && n > 0 ? '   ← ⛔ STOP' : ''
    console.log(`  ${v.padEnd(30)} ${String(n).padStart(6)}  ${pct(n, report.evaluated)}${flag}`)
  }
  console.log('')

  console.log('── BY PRODUCER ─────────────────────────────────────────────────')
  for (const [producer, counts] of Object.entries(report.byProducer).sort()) {
    const total = VERDICTS.reduce((s, v) => s + counts[v], 0)
    console.log(`  ${producer} (${total})`)
    for (const v of VERDICTS) {
      if (counts[v] > 0) console.log(`      ${v.padEnd(30)} ${counts[v]}`)
    }
  }
  console.log('')

  console.log('── DISAGREEMENT DETAIL ─────────────────────────────────────────')
  console.log(`  both supersede but target a DIFFERENT prior row: ${report.differentPrior}`)
  console.log('')

  if (report.stopCases.length > 0) {
    console.log('⛔ OLD_COEXISTS_NEW_SUPERSEDES — E4 IS BLOCKED')
    console.log('   The new rule would create supersession the old rule considered')
    console.log('   independent. Investigate each producer and key below.')
    console.log('')
    for (const c of report.stopCases) {
      console.log(`   evidence=${c.evidenceId} source=${c.evidenceSource} key=${c.correctionKey}`)
      console.log(`     legacy: ${c.legacy.kind} (${c.legacy.reason})`)
      console.log(`     new:    ${c.next.kind} (${c.next.reason})`)
    }
    console.log('')
  } else {
    console.log('✓ OLD_COEXISTS_NEW_SUPERSEDES = 0 — the new rule never widens supersession.')
    console.log('')
  }

  console.log('── GATE D OBSERVATIONS (recorded, NOT decided) ─────────────────')
  console.log(`  pending corrections targeting a standing CONFIRMED row: ${report.gateDCases.length}`)
  console.log('  E4 changes WHICH row is targeted, never WHEN supersession executes.')
  console.log('')
  console.log('════════════════════════════════════════════════════════════════')
  console.log('READ-ONLY: nothing was written. Supersession is still governed by')
  console.log('the legacy claim key.')
  console.log('════════════════════════════════════════════════════════════════')
}

main().catch(err => {
  console.error('[shadow-compare] failed:', err instanceof Error ? err.message : String(err))
  process.exit(1)
})
