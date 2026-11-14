// Runs INSIDE the sandbox (bubblewrap + node --permission read-only). First-party code only.
// Inputs: argv (adapter id, clock, selected checks) and the read-only snapshot at /target with /meta/files.txt.
// Output: ONE JSON document on stdout. The host treats it as untrusted and re-validates every field.
import { readFileSync } from 'node:fs'
import { parseArgs } from 'node:util'
import { ADAPTERS } from '../adapters/registry.mjs'
import { createContext } from '../core/context.mjs'
import { executeChecks, prepareAdapter } from '../core/runner.mjs'

const { values } = parseArgs({ options: { adapter: { type: 'string' }, now: { type: 'string' }, check: { type: 'string', multiple: true } } })
const now = new Date(values.now ?? '')
if (Number.isNaN(now.getTime())) throw new Error('worker needs --now <ISO timestamp>')

const manifest = readFileSync('/meta/files.txt', 'utf8')
// There is no git binary and no .git in the sandbox: serve the one query checks need from the host-made manifest.
const git = (args) => (args[0] === 'ls-files' ? manifest : null)

const { adapterConfig, checks } = prepareAdapter({ adapters: ADAPTERS, adapterId: values.adapter, rootDir: '/target', only: values.check })
const ctx = createContext('/target', Object.freeze(structuredClone(adapterConfig)), { now, git })
const out = await executeChecks(ctx, checks)
process.stdout.write(JSON.stringify(out))
