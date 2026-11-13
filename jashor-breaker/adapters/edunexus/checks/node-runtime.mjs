import { makeFinding } from '../../../core/finding.mjs'
import { compareExact, parseExact, rangeLowerMajor } from '../../../core/semver.mjs'

const CHECK = 'node-runtime'
const REPRO = 'node cli.mjs run --config <targets.json> --target <id> --check node-runtime'

/** Declared Node versions in .nvmrc, package.json engines, and workflow files. Static only. */
export const nodeRuntime = {
  id: CHECK,
  title: 'Node.js runtime declarations vs patch floor',
  mode: 'passive',
  run(ctx) {
    const { line, minimumPatch, source } = ctx.adapterConfig.nodePolicy
    const findings = []
    /** @type {{where:string, value:string, kind:'file-line'|'config'}[]} */
    const declared = []

    const nvmrc = ctx.read('.nvmrc')
    if (nvmrc) declared.push({ where: '.nvmrc:1', value: nvmrc.split('\n')[0].trim(), kind: 'file-line' })

    const pkgText = ctx.read('package.json')
    const pkg = pkgText ? JSON.parse(pkgText) : {}
    const enginesNode = pkg.engines?.node
    for (const file of ctx.trackedFiles().filter((f) => /^\.github\/workflows\/[^/]+\.ya?ml$/.test(f))) {
      ctx.read(file)?.split('\n').forEach((text, i) => {
        const m = /(?:node-version|NODE_VERSION)\s*:\s*['"]?([^'"\s#]+)['"]?/.exec(text)
        if (m && !m[1].includes('${{')) declared.push({ where: `${file}:${i + 1}`, value: m[1], kind: 'file-line' })
      })
    }

    for (const d of declared) {
      const exact = parseExact(d.value)
      if (!exact) {
        findings.push(makeFinding({
          key: `floating:${d.where}`, checkId: CHECK, severity: 'low', classification: 'confirmed',
          title: 'Node version is a floating range, not pinned to a patch',
          rationale: `"${d.value}" resolves at install time, so the patched floor ${minimumPatch} is neither guaranteed nor auditable from the repo.`,
          evidence: [{ kind: d.kind, location: d.where, detail: `declared "${d.value}"; policy floor ${minimumPatch} (${source})` }],
          reproduce: REPRO, remediationHint: `Pin to an exact patch >= ${minimumPatch} in a single shared place.`, cwe: 'CWE-1104',
        }))
      } else if (compareExact(d.value, minimumPatch) < 0) {
        findings.push(makeFinding({
          key: `below-floor:${d.where}`, checkId: CHECK, severity: 'medium', classification: 'confirmed',
          title: 'Declared Node version is below the security patch floor',
          rationale: `Exact version ${d.value} is older than ${minimumPatch}.`,
          evidence: [{ kind: d.kind, location: d.where, detail: `declared ${d.value} < ${minimumPatch}` }],
          reproduce: REPRO, remediationHint: `Raise to >= ${minimumPatch}.`, cwe: 'CWE-1104',
        }))
      }
    }

    const lowerMajor = enginesNode ? rangeLowerMajor(enginesNode) : null
    if (enginesNode && lowerMajor !== null && lowerMajor < line) {
      findings.push(makeFinding({
        key: 'engines-permits-older-line', checkId: CHECK, severity: 'low', classification: 'confirmed',
        title: 'package.json engines permits an older Node line than policy',
        rationale: `engines.node "${enginesNode}" admits Node ${lowerMajor}.x; policy line is ${line}.x.`,
        evidence: [{ kind: 'config', location: 'package.json#engines.node', detail: `"${enginesNode}"` }],
        reproduce: REPRO, remediationHint: `Consider ">=${minimumPatch}" once the upgrade is approved.`,
      }))
    }

    const typesNode = pkg.devDependencies?.['@types/node'] ?? pkg.dependencies?.['@types/node']
    const typesMajor = typesNode ? rangeLowerMajor(typesNode) : null
    if (typesMajor !== null && typesMajor !== line) {
      findings.push(makeFinding({
        key: 'types-node-major-mismatch', checkId: CHECK, severity: 'info', classification: 'confirmed',
        title: '@types/node major differs from the Node policy line',
        rationale: `Type definitions target Node ${typesMajor}.x while the policy line is ${line}.x; new APIs may not be typed and removed ones may be.`,
        evidence: [{ kind: 'config', location: 'package.json#devDependencies.@types/node', detail: `"${typesNode}"` }],
        reproduce: REPRO, remediationHint: `Align @types/node to ^${line}.`,
      }))
    }

    // The runtime executing this tool: a fact about the runner, recorded for reproducibility.
    if (compareExact(process.version, minimumPatch) < 0 && parseExact(process.version)?.major === line) {
      findings.push(makeFinding({
        key: 'runner-below-floor', checkId: CHECK, severity: 'info', classification: 'confirmed',
        title: 'The Node runtime executing this scan is below the patch floor',
        rationale: 'Informational: results are unaffected, but the machine running scans is unpatched.',
        evidence: [{ kind: 'runtime', location: 'process.version', detail: `${process.version} < ${minimumPatch}` }],
        reproduce: 'node --version', remediationHint: 'Install the patched runtime after approval.',
      }))
    }

    // What the repo cannot tell us: the deployment platform's own runtime setting.
    findings.push(makeFinding({
      key: 'platform-runtime-not-visible', checkId: CHECK, severity: 'info', classification: 'unverified',
      title: 'Hosting-platform Node runtime is not declared in the repository',
      rationale: 'No vercel.json "functions" runtime or engines pin determines the production Node version; it is a project setting that this passive check cannot see.',
      evidence: [{ kind: 'external-gap', location: 'vercel project settings', detail: 'Read it via an authorised read-only connector or the dashboard.' }],
      reproduce: 'vercel project inspect <project> (read-only) or dashboard Settings > Node.js Version',
      remediationHint: 'Record the observed value in the upgrade procedure before changing anything.',
    }))
    return findings
  },
}
