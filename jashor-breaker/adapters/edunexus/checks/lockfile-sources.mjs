import { makeFinding } from '../../../core/finding.mjs'

const CHECK = 'lockfile-sources'
const REPRO = 'node cli.mjs run --config <targets.json> --target <id> --check lockfile-sources'
const REGISTRY = 'https://registry.npmjs.org/'

/** package-lock.json: non-registry sources and missing integrity hashes. Offline. */
export const lockfileSources = {
  id: CHECK,
  title: 'npm lockfile source and integrity',
  mode: 'passive',
  run(ctx) {
    const text = ctx.read('package-lock.json')
    if (!text) return []
    const packages = JSON.parse(text).packages ?? {}
    const offRegistry = []
    const noIntegrity = []
    for (const [path, p] of Object.entries(packages)) {
      if (!path || p.link) continue
      const name = path.replace(/^.*node_modules\//, '')
      if (p.resolved && !p.resolved.startsWith(REGISTRY)) offRegistry.push(`${name} -> ${new URL(p.resolved.replace(/^git\+/, '')).host}`)
      if (p.resolved && !p.integrity) noIntegrity.push(name)
    }
    const findings = []
    const sample = (arr) => `${arr.length} total; first: ${arr.slice(0, 8).join(', ')}`
    if (offRegistry.length) {
      findings.push(makeFinding({
        key: 'off-registry', checkId: CHECK, severity: 'medium', classification: 'confirmed',
        title: 'Lockfile contains packages resolved outside the public npm registry',
        rationale: 'Git, tarball-URL or alternate-registry sources bypass registry provenance and are mutable more easily.',
        evidence: [{ kind: 'file', location: 'package-lock.json', detail: sample(offRegistry) }],
        reproduce: REPRO, remediationHint: 'Review each source; prefer registry releases or pin git deps to a commit.', cwe: 'CWE-829',
      }))
    }
    if (noIntegrity.length) {
      findings.push(makeFinding({
        key: 'no-integrity', checkId: CHECK, severity: 'low', classification: 'confirmed',
        title: 'Lockfile entries lack integrity hashes',
        rationale: 'Without an integrity field npm cannot verify the downloaded tarball.',
        evidence: [{ kind: 'file', location: 'package-lock.json', detail: sample(noIntegrity) }],
        reproduce: REPRO, remediationHint: 'Regenerate the lockfile with a current npm after approval.', cwe: 'CWE-353',
      }))
    }
    return findings
  },
}
