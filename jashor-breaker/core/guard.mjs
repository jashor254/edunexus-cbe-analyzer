import { existsSync, readFileSync, statSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { validate } from './schema.mjs'

const targetsSchema = JSON.parse(readFileSync(new URL('../schemas/targets.schema.json', import.meta.url), 'utf8'))

export class GuardRefusal extends Error {
  constructor(message) {
    super(message)
    this.name = 'GuardRefusal'
  }
}

/** Substrings that always indicate a production or credential-bearing target. */
const BUILTIN_DENY = [/\bprod(uction)?\b/i, /\.env(\.|$)/, /service[_-]?role/i, /^[a-z]+:\/\//i]

/**
 * Default-deny: a run proceeds only if the target is explicitly listed, in an
 * allowed environment, authorised for the requested mode, unexpired, and its
 * path exists locally. Everything else throws GuardRefusal.
 *
 * @param {{configPath:string, targetId:string|undefined, mode:string, now?:Date}} req
 * @returns {{target:any, rootDir:string, configDir:string}}
 */
export function authorise({ configPath, targetId, mode, now = new Date() }) {
  if (!configPath || !existsSync(configPath)) {
    throw new GuardRefusal('No target config found. Default policy is deny; supply --config with an explicit, authorised target.')
  }
  let config
  try {
    if (!statSync(configPath).isFile()) throw new Error('not a regular file')
    config = JSON.parse(readFileSync(configPath, 'utf8'))
  } catch {
    // Deliberately no parser message: it can echo file content into logs.
    throw new GuardRefusal('Target config is unreadable or not valid JSON.')
  }
  const errors = validate(config, targetsSchema)
  if (errors.length) throw new GuardRefusal(`Target config invalid: ${errors.join('; ')}`)
  if (!targetId) throw new GuardRefusal('No --target given. Targets are never inferred.')
  const target = config.targets.find((t) => t.id === targetId)
  if (!target) throw new GuardRefusal(`Target "${targetId}" is not listed in the config (default-deny).`)

  if (mode !== 'passive') throw new GuardRefusal(`Mode "${mode}" is not implemented. v0 is passive-only.`)
  if (!target.allowedModes.includes(mode)) throw new GuardRefusal(`Target "${targetId}" is not authorised for mode "${mode}".`)

  const { approvedBy, approvedAt, expiresAt, scope } = target.authorisation
  const placeholder = /^(replace|todo|tbd|changeme)/i
  if ([approvedBy, scope].some((s) => placeholder.test(s)) || approvedAt === '0000-00-00') {
    throw new GuardRefusal('Authorisation block contains placeholders. A human must fill it in.')
  }
  if (now > new Date(`${expiresAt}T23:59:59Z`)) throw new GuardRefusal(`Authorisation for "${targetId}" expired on ${expiresAt}.`)
  if (now < new Date(`${approvedAt}T00:00:00Z`)) throw new GuardRefusal('Authorisation is not yet effective.')

  const denyList = (config.denyList ?? []).map((s) => s.toLowerCase())
  for (const field of [target.id, target.path]) {
    if (BUILTIN_DENY.some((re) => re.test(field))) throw new GuardRefusal(`Target field "${field}" matches a built-in deny pattern (production/credential/network).`)
    if (denyList.some((d) => field.toLowerCase().includes(d))) throw new GuardRefusal(`Target field "${field}" matches the configured denyList.`)
  }

  const configDir = dirname(resolve(configPath))
  const rootDir = resolve(configDir, target.path)
  if (!existsSync(rootDir) || !statSync(rootDir).isDirectory()) throw new GuardRefusal(`Target path does not exist: ${target.path}`)
  return { target, rootDir, configDir }
}
