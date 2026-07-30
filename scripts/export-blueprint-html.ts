// scripts/export-blueprint-html.ts — ONE-OFF. Composes a learner's real
// Blueprint via the canonical composeBlueprint() engine and writes a plain,
// honest HTML rendering of every section straight to disk. Built because the
// live dev server wasn't reachable from this sandbox for a real
// screenshot/PDF export (see renderBlueprintPdf, which needs a running
// server + browser session). This is NOT the app's actual seven-page premium
// layout (components/blueprint/BlueprintView.tsx) — it's a faithful,
// unstyled dump of the same composed data for inspection purposes only.
//
// Run: npx tsx scripts/export-blueprint-html.ts <coreLearnerId> <schoolId> <actorUserId> <outPath>

import * as dotenv from 'dotenv'
import * as path from 'path'
import * as fs from 'fs'

dotenv.config({ path: path.resolve(__dirname, '../.env.local') })

function esc(v: unknown): string {
  return String(v ?? '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]!))
}

async function main() {
  const [coreLearnerId, schoolId, actorUserId, outPath] = process.argv.slice(2)
  if (!coreLearnerId || !schoolId || !actorUserId || !outPath) {
    throw new Error('Usage: export-blueprint-html.ts <coreLearnerId> <schoolId> <actorUserId> <outPath>')
  }

  const { composeBlueprint } = await import('../lib/learnerBlueprint/composeBlueprint')
  const { blueprint, validation, coherence } = await composeBlueprint({ actorUserId, coreLearnerId, schoolId })

  const sections = Object.entries(blueprint).filter(([key]) => key !== 'metadata') as Array<
    [string, { status: string; owner: string; freshness: string; data: unknown; unavailableReason?: string }]
  >

  const sectionHtml = sections
    .map(([key, s]) => {
      const badge = s.status === 'available' ? '#16a34a' : s.status === 'not_implemented' ? '#94a3b8' : '#dc2626'
      return `
        <section style="margin-bottom:24px;padding:16px;border:1px solid #e2e8f0;border-radius:12px;">
          <div style="display:flex;justify-content:space-between;align-items:center;gap:12px;">
            <h2 style="margin:0;font-size:16px;text-transform:capitalize;">${esc(key.replace(/([A-Z])/g, ' $1'))}</h2>
            <span style="background:${badge};color:white;font-size:11px;font-weight:700;padding:2px 8px;border-radius:999px;text-transform:uppercase;">${esc(s.status)}</span>
          </div>
          <p style="margin:4px 0 0;font-size:11px;color:#64748b;">owner: ${esc(s.owner)} · freshness: ${esc(s.freshness)}</p>
          ${s.unavailableReason ? `<p style="margin:8px 0 0;font-size:13px;color:#b91c1c;">${esc(s.unavailableReason)}</p>` : ''}
          ${s.data ? `<pre style="margin:8px 0 0;font-size:12px;white-space:pre-wrap;background:#f8fafc;padding:10px;border-radius:8px;overflow-x:auto;">${esc(JSON.stringify(s.data, null, 2))}</pre>` : ''}
        </section>`
    })
    .join('\n')

  const html = `<!doctype html>
<html><head><meta charset="utf-8"><title>Learner Blueprint — ${esc((blueprint.identity.data as { learnerName?: string } | null)?.learnerName ?? coreLearnerId)}</title>
<style>body{font-family:-apple-system,Segoe UI,Roboto,sans-serif;max-width:900px;margin:32px auto;padding:0 20px;color:#0f172a;}</style>
</head><body>
<h1 style="margin-bottom:0;">Learner Blueprint (raw composition export)</h1>
<p style="color:#64748b;font-size:13px;margin-top:4px;">coreLearnerId=${esc(coreLearnerId)} · generated ${esc(blueprint.metadata.generatedAt)} · freshness=${esc(blueprint.metadata.freshness)}</p>
<p style="font-size:13px;">validation.valid=<b>${validation.valid}</b>${validation.errors.length ? ' — ' + esc(JSON.stringify(validation.errors)) : ''} · coherence.result=<b>${esc(coherence.result)}</b></p>
<hr style="margin:20px 0;border:none;border-top:1px solid #e2e8f0;">
${sectionHtml}
</body></html>`

  fs.writeFileSync(outPath, html, 'utf-8')
  console.log(`Wrote ${outPath}`)
}

main().catch((err) => {
  console.error('Fatal:', err)
  process.exit(1)
})
