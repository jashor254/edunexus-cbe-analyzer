import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { nodeRuntime } from './checks/node-runtime.mjs'
import { actionsPinning } from './checks/actions-pinning.mjs'
import { trackedEnvFiles } from './checks/tracked-env-files.mjs'
import { lockfileSources } from './checks/lockfile-sources.mjs'
import { secretPatterns } from './checks/secret-patterns.mjs'

const configPath = fileURLToPath(new URL('./adapter.config.json', import.meta.url))

/** EduNexus adapter: the only place that knows EduNexus file layout and policy. */
export const edunexus = {
  id: 'edunexus',
  configSchemaPath: fileURLToPath(new URL('../../schemas/edunexus-adapter.schema.json', import.meta.url)),
  loadConfig: () => JSON.parse(readFileSync(configPath, 'utf8')),
  checks: [nodeRuntime, actionsPinning, trackedEnvFiles, lockfileSources, secretPatterns],
}
