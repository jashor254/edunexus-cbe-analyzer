import { makeFinding } from '../../../core/finding.mjs'
import { SECRET_PATTERNS, redactLine } from '../../../core/redactor.mjs'

const CHECK = 'secret-patterns'
const REPRO = 'node cli.mjs run --config <targets.json> --target <id> --check secret-patterns'
const BINARY = /\.(png|jpe?g|gif|webp|ico|pdf|mp4|mp3|wav|woff2?|ttf|otf|zip|gz|tar|docx|pptx|xlsx|sqlite|db|ses)$/i

/**
 * Secret-shaped strings in tracked files (working-tree content). Patterns only:
 * liveness is never tested, so results are 'suspected' or 'unverified', never 'confirmed'.
 * Matched values are replaced before they enter any Finding.
 */
export const secretPatterns = {
  id: CHECK,
  title: 'Secret-shaped strings in tracked files',
  mode: 'passive',
  run(ctx) {
    const { ignorePrefixes, maxFileBytes } = ctx.adapterConfig.secretScan
    const findings = []
    for (const file of ctx.trackedFiles()) {
      if (BINARY.test(file) || ignorePrefixes.some((p) => file.startsWith(p))) continue
      let text
      try {
        if (!ctx.exists(file) || ctx.size(file) > maxFileBytes) continue
        text = ctx.read(file)
      } catch (err) {
        // A tracked symlink pointing outside the repo is itself noteworthy; it is never followed.
        if (!/escapes target root/.test(String(err?.message))) throw err
        findings.push(makeFinding({
          key: `symlink-escape:${file}`, checkId: CHECK, severity: 'low', classification: 'confirmed',
          title: 'Tracked symlink resolves outside the repository; not scanned',
          rationale: 'The scanner refuses to follow links outside the target root. The link target was not read.',
          evidence: [{ kind: 'file', location: file, detail: 'tracked path resolves outside target root' }],
          reproduce: 'git ls-files -s | grep ^120000', remediationHint: 'Review why a tracked link points outside the repo.', cwe: 'CWE-59',
        }))
        continue
      }
      if (text === null) continue
      text.split('\n').forEach((line, i) => {
        if (line.length > 5000) return
        const { redacted, hits } = redactLine(line, { file })
        for (const h of hits) {
          const p = SECRET_PATTERNS.find((x) => x.id === h.patternId)
          const likelyFp = h.triage.verdict === 'likely-false-positive'
          findings.push(makeFinding({
            key: `${file}:${i + 1}:${h.patternId}:${h.tag}`, checkId: CHECK,
            // A likely false positive is never dropped; it is demoted to info and labelled.
            severity: likelyFp ? 'info' : p.severity, classification: p.classification,
            title: `${p.label} pattern in tracked file${likelyFp ? ' (likely false positive)' : ''}`,
            rationale: likelyFp
              ? `Pattern match only; triage signals: ${h.triage.reasons.join(', ')}. Demoted, not suppressed. Original severity would be ${p.severity}.`
              : 'Pattern match only. Liveness not tested; may be a fixture, example or placeholder.',
            triage: h.triage,
            evidence: [{ kind: 'file-line', location: `${file}:${i + 1}`, detail: redacted.trim() }],
            reproduce: REPRO, remediationHint: 'If real: rotate first, then remove from history. If a fixture: add a narrow ignore with a reason.', cwe: 'CWE-798',
          }))
        }
      })
    }
    return findings
  },
}
