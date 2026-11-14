import { makeFinding } from '../../../core/finding.mjs'

const CHECK = 'actions-pinning'
const REPRO = 'node cli.mjs run --config <targets.json> --target <id> --check actions-pinning'

/** Unpinned GitHub Actions and workflows lacking explicit token permissions. Static only. */
export const actionsPinning = {
  id: CHECK,
  title: 'GitHub Actions pinning and token permissions',
  mode: 'passive',
  run(ctx) {
    const findings = []
    for (const file of ctx.trackedFiles().filter((f) => /^\.github\/workflows\/[^/]+\.ya?ml$/.test(f))) {
      const text = ctx.read(file) ?? ''
      const lines = text.split('\n')
      if (!/^permissions\s*:/m.test(text)) {
        findings.push(makeFinding({
          key: `no-permissions:${file}`, checkId: CHECK, kind: 'control-failure', severity: 'low', classification: 'suspected',
          title: 'Workflow has no top-level permissions block',
          rationale: 'GITHUB_TOKEN then inherits the repository default, which may be broader than needed. Job-level blocks or the repo setting could still restrict it, so impact is unconfirmed.',
          evidence: [{ kind: 'file', location: file, detail: 'no top-level "permissions:" key' }],
          reproduce: REPRO, remediationHint: 'Add `permissions: contents: read` at top level and widen per job.', cwe: 'CWE-250',
        }))
      }
      lines.forEach((raw, i) => {
        const m = /^\s*-?\s*uses\s*:\s*['"]?([^\s'"#]+)/.exec(raw)
        if (!m) return
        const ref = m[1]
        if (ref.startsWith('./') || ref.startsWith('docker://')) return
        if (/@[0-9a-f]{40}$/.test(ref)) return
        const firstParty = ref.startsWith('actions/') || ref.startsWith('github/')
        findings.push(makeFinding({
          key: `unpinned:${file}:${ref}`, checkId: CHECK, kind: 'control-failure', severity: firstParty ? 'low' : 'medium', classification: 'confirmed',
          title: `${firstParty ? 'First-party' : 'Third-party'} action not pinned to a commit SHA`,
          rationale: 'A mutable tag or branch can be re-pointed, so the code that runs in CI can change without a repo change.',
          evidence: [{ kind: 'file-line', location: `${file}:${i + 1}`, detail: `uses: ${ref}` }],
          reproduce: REPRO, remediationHint: 'Pin to the full 40-character commit SHA, keeping the tag in a comment.', cwe: 'CWE-829',
        }))
      })
    }
    return findings
  },
}
