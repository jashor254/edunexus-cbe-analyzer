import { SEVERITIES } from './finding.mjs'

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
    '',
    'Evidence is redacted. Secret-shaped values appear only as `[REDACTED:<pattern>:<fingerprint>]`.',
    '',
  ]
  if (r.checkErrors.length) {
    lines.push('## Check errors', '', ...r.checkErrors.map((e) => `- **${e.checkId}**: ${e.message}`), '')
  }
  const fp = r.findings.filter((f) => f.triage?.verdict === 'likely-false-positive')
  for (const cls of ['confirmed', 'suspected', 'unverified']) {
    const list = by(cls).filter((f) => !fp.includes(f)).sort((a, b) => SEVERITIES.indexOf(b.severity) - SEVERITIES.indexOf(a.severity))
    if (!list.length) continue
    lines.push(`## ${cls[0].toUpperCase()}${cls.slice(1)}`, '')
    for (const f of list) {
      lines.push(`### ${f.id} — ${f.title}`, '', `Severity: **${f.severity}** · Check: \`${f.checkId}\``, '', f.rationale, '')
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
