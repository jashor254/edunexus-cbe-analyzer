import { SEVERITIES } from './finding.mjs'
import { CATEGORIES, CATEGORY_LABEL, categorise, countByCategory } from './categories.mjs'

/** @param {any} r run result */
export function toMarkdown(r) {
  const by = (c) => r.findings.filter((f) => f.classification === c)
  const lines = [
    `# Jashor Breaker report — ${r.target.id}`,
    '',
    `- Mode: **${r.target.mode}** (read-only; no network; no mutations)`,
    `- Tool: ${r.tool.name} ${r.tool.version} on Node ${r.tool.node}`,
    `- Subject: git \`${r.subject.gitHead ?? 'unknown'}\`${r.subject.workingTreeDirty ? ' (working tree dirty)' : ''}`,
    `- Checks run: ${r.checksRun.join(', ') || 'none'}`,
    `- Evidence digest: \`${r.evidenceDigest}\``,
    `- Findings: ${by('confirmed').length} confirmed, ${by('suspected').length} suspected, ${by('unverified').length} unverified (${r.findings.filter((f) => f.triage?.verdict === 'likely-false-positive').length} of them likely false positives)`,
    `- Categories: ${CATEGORIES.map((c) => `${countByCategory(r.findings)[c]} ${CATEGORY_LABEL[c].toLowerCase()}`).join(' · ')}`,
    '',
    'Evidence is redacted. Secret-shaped values appear only as `[REDACTED:<pattern>:<fingerprint>]`.',
    '',
  ]
  if (r.checkErrors.length) {
    lines.push('## Check errors', '', ...r.checkErrors.map((e) => `- **${e.checkId}**: ${e.message}`), '')
  }
  const fp = r.findings.filter((f) => f.triage?.verdict === 'likely-false-positive')
  for (const cat of CATEGORIES) {
    const list = r.findings.filter((f) => categorise(f) === cat && !fp.includes(f)).sort((x, y) => SEVERITIES.indexOf(y.severity) - SEVERITIES.indexOf(x.severity) || x.id.localeCompare(y.id))
    if (!list.length) continue
    lines.push(`## ${CATEGORY_LABEL[cat]} (${list.length})`, '')
    for (const f of list) {
      lines.push(`### ${f.id} — ${f.title}`, '', `Severity: **${f.severity}** · Classification: ${f.classification} · Check: \`${f.checkId}\``, '', f.rationale, '')
      for (const e of f.evidence) lines.push(`- \`${e.location}\` (${e.kind}): ${e.detail}`)
      lines.push('', `Reproduce: \`${f.reproduce}\``, `Hint (advice only): ${f.remediationHint}`, '')
    }
  }
  if (fp.length) {
    lines.push(`## Likely false positives (${fp.length}) — demoted, not suppressed`, '')
    for (const f of fp) lines.push(`- ${f.id} \`${f.evidence[0]?.location}\` — ${f.triage.reasons.join(', ')}`)
    lines.push('')
  }
  return lines.join('\n')
}
