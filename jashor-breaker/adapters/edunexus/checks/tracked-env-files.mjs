import { makeFinding } from '../../../core/finding.mjs'

const CHECK = 'tracked-env-files'
const REPRO = 'git ls-files | grep -E "(^|/)\\.env"'

/** Environment/key files that are committed. Names only; contents are never read. */
export const trackedEnvFiles = {
  id: CHECK,
  title: 'Committed environment and key files',
  mode: 'passive',
  run(ctx) {
    const findings = []
    for (const f of ctx.trackedFiles()) {
      const base = f.split('/').pop() ?? f
      const isEnv = /^\.env(\..+)?$/.test(base) && !/\.(example|sample|template)$/.test(base)
      const isKey = /\.(pem|p12|pfx|key)$/i.test(base)
      if (!isEnv && !isKey) continue
      findings.push(makeFinding({
        key: `tracked:${f}`, checkId: CHECK,
        severity: isEnv ? 'high' : 'medium', classification: isEnv ? 'confirmed' : 'suspected',
        title: isEnv ? 'Environment file is tracked in git' : 'Key or certificate file is tracked in git',
        rationale: isEnv
          ? 'Tracked env files persist in history even if later deleted. Contents were NOT read by this check.'
          : 'Extension suggests key material; contents were NOT read, so this is unconfirmed.',
        evidence: [{ kind: 'file', location: f, detail: 'path is tracked by git' }],
        reproduce: REPRO, remediationHint: 'Untrack, rotate anything it held, and review history. Do not paste values into reports.', cwe: 'CWE-540',
      }))
    }
    return findings
  },
}
