// lib/organizations/api-keys.ts
import { repos } from '@/lib/repositories'
import { generateApiKey, hashApiKey } from './utils'
import { writeAuditLog } from '@/lib/iam/audit'
import type { ApiKey, CreateApiKeyInput, CreateApiKeyResult } from './types'

/**
 * Create a new API key for an organization.
 * The raw key is returned ONCE and never stored — the caller must show it to the user.
 */
export async function createApiKey(input: CreateApiKeyInput): Promise<CreateApiKeyResult> {
  // Verify caller can manage API keys
  const member = await repos.developers.findMemberRole(input.organization_id, input.created_by)

  if (!member || !['owner', 'admin', 'developer'].includes(member.role)) {
    throw new Error('Access denied — owner, admin, or developer role required')
  }

  const env = input.environment ?? 'live'
  const { rawKey, prefix, hash } = await generateApiKey(env)

  const apiKey = await repos.developers.insertApiKey({
    organization_id: input.organization_id,
    created_by:      input.created_by,
    name:            input.name,
    description:     input.description ?? null,
    key_prefix:      prefix,
    key_hash:        hash,
    scopes:          input.scopes ?? ['api:use'],
    status:          'active',
    environment:     env,
    expires_at:      input.expires_at ?? null,
    rate_limit_rpm:  input.rate_limit_rpm ?? 60,
    rate_limit_rpd:  input.rate_limit_rpd ?? 1000,
  })

  await writeAuditLog({
    organization_id: input.organization_id,
    user_id:         input.created_by,
    action:          'api_key.created',
    resource_type:   'api_key',
    resource_id:     apiKey.id,
    new_values:      { name: input.name, scopes: input.scopes },
  })

  return { api_key: apiKey, raw_key: rawKey }
}

/**
 * Revoke an API key. The key_hash is zeroed, making lookups impossible.
 */
export async function revokeApiKey(
  apiKeyId: string,
  callerId: string
): Promise<void> {
  const key = await repos.developers.findApiKeyMeta(apiKeyId)

  if (!key) throw new Error('API key not found')
  if (key.status === 'revoked') throw new Error('API key is already revoked')

  const caller = await repos.developers.findMemberRole(key.organization_id, callerId)

  if (!caller || !['owner', 'admin', 'developer'].includes(caller.role)) {
    throw new Error('Access denied')
  }

  await repos.developers.revokeApiKey(apiKeyId)

  await writeAuditLog({
    organization_id: key.organization_id,
    user_id:         callerId,
    action:          'api_key.revoked',
    resource_type:   'api_key',
    resource_id:     apiKeyId,
  })
}

/**
 * Validate a raw API key and return the associated org + scopes.
 * Used by the API gateway on every inbound request.
 */
export async function validateApiKey(rawKey: string): Promise<{
  organization_id: string
  scopes: string[]
  rate_limit_rpm: number
  rate_limit_rpd: number
  api_key_id: string
  environment: import('@/lib/environment/types').Environment
} | null> {
  const hash = await hashApiKey(rawKey)

  const key = await repos.developers.findApiKeyByHash(hash)

  if (!key) return null
  if (key.status !== 'active') return null
  if (key.expires_at && new Date(key.expires_at) < new Date()) return null

  // Fire-and-forget: update last_used_at
  void repos.developers.touchLastUsed(key.id)

  return {
    organization_id: key.organization_id,
    scopes:          key.scopes as string[],
    rate_limit_rpm:  key.rate_limit_rpm,
    rate_limit_rpd:  key.rate_limit_rpd,
    api_key_id:      key.id,
    environment:     key.environment as import('@/lib/environment/types').Environment,
  }
}

/**
 * List API keys for an org (redacts key_hash).
 */
export async function listApiKeys(
  orgId: string,
  callerId: string
): Promise<Omit<ApiKey, 'key_hash'>[]> {
  const caller = await repos.developers.findMemberRole(orgId, callerId)

  if (!caller) throw new Error('Access denied')

  return repos.developers.listApiKeys(orgId)
}
