// lib/repositories/developer.repository.ts
// All DB queries for API keys and usage event tracking.
//
// NAMING NOTE: this repository is named `DeveloperRepository` (accessed as
// `repos.developers`), but it queries `api_keys` / `usage_events` — the
// ORGANIZATION-scoped API key system (Phase 8 platform foundation), keyed
// by organization_id, created via lib/organizations/api-keys.ts.
//
// This is a DIFFERENT system from `developer_api_keys` / `developer_profiles`
// / `developer_projects` (the Developer Portal's own API key system, keyed
// by developer_id/project_id, added by the devportal_* migrations). Neither
// system references or depends on the other. If you're looking for the
// Developer Portal's API keys, they are not queried anywhere in this
// repository — check the separate devportal application instead.
//
// The name `DeveloperRepository` predates this distinction becoming clear;
// it was not renamed here to avoid an unrelated refactor across its call
// sites, but new code should not assume it relates to the Developer Portal.

import { BaseRepository } from './base'
import type { ApiKey } from '@/lib/organizations/types'

// ── Column constants ──────────────────────────────────────────────────────────

const API_KEY_FULL_COLS =
  'id, organization_id, created_by, name, description, key_prefix, key_hash, scopes, status, environment, last_used_at, expires_at, rate_limit_rpm, rate_limit_rpd, created_at, updated_at'

const API_KEY_REDACTED_COLS =
  'id, organization_id, created_by, name, description, key_prefix, scopes, status, environment, last_used_at, expires_at, rate_limit_rpm, rate_limit_rpd, created_at, updated_at'

// ── Repository ────────────────────────────────────────────────────────────────

export class DeveloperRepository extends BaseRepository {
  /**
   * Find an API key record by its hash.
   * Used by the gateway to validate inbound requests.
   */
  async findApiKeyByHash(hash: string): Promise<Pick<ApiKey, 'id' | 'organization_id' | 'scopes' | 'rate_limit_rpm' | 'rate_limit_rpd' | 'status' | 'environment' | 'expires_at'> | null> {
    const { data } = await this.db
      .from('api_keys')
      .select('id, organization_id, scopes, rate_limit_rpm, rate_limit_rpd, status, environment, expires_at')
      .eq('key_hash', hash)
      .maybeSingle()

    return data ?? null
  }

  /**
   * Touch the last_used_at timestamp for a key.
   * Fire-and-forget — do not await at call site.
   */
  async touchLastUsed(apiKeyId: string): Promise<void> {
    await this.db
      .from('api_keys')
      .update({ last_used_at: new Date().toISOString() })
      .eq('id', apiKeyId)
  }

  /**
   * Insert a new API key row and return the full record.
   */
  async insertApiKey(row: {
    organization_id: string
    created_by: string
    name: string
    description: string | null
    key_prefix: string
    key_hash: string
    scopes: string[]
    status: string
    environment: string
    expires_at: string | null
    rate_limit_rpm: number
    rate_limit_rpd: number
  }): Promise<ApiKey> {
    const { data, error } = await this.db
      .from('api_keys')
      .insert(row)
      .select(API_KEY_FULL_COLS)
      .single()

    if (error) throw new Error(`Failed to create API key: ${error.message}`)
    return data as ApiKey
  }

  /**
   * Find a key's organization_id and status by key id.
   * Used by revoke to verify ownership and current state.
   */
  async findApiKeyMeta(apiKeyId: string): Promise<Pick<ApiKey, 'organization_id' | 'status'> | null> {
    const { data } = await this.db
      .from('api_keys')
      .select('organization_id, status')
      .eq('id', apiKeyId)
      .maybeSingle()

    return data ?? null
  }

  /**
   * Revoke an API key by zeroing its hash.
   */
  async revokeApiKey(apiKeyId: string): Promise<void> {
    const { error } = await this.db
      .from('api_keys')
      .update({ status: 'revoked', key_hash: 'revoked' })
      .eq('id', apiKeyId)

    if (error) throw new Error(`Failed to revoke API key: ${error.message}`)
  }

  /**
   * Find a caller's membership role in an organization.
   * Used to enforce owner/admin/developer requirement.
   */
  async findMemberRole(
    organizationId: string,
    userId: string
  ): Promise<{ role: string } | null> {
    const { data } = await this.db
      .from('organization_members')
      .select('role')
      .eq('organization_id', organizationId)
      .eq('user_id', userId)
      .eq('status', 'active')
      .maybeSingle()

    return data ?? null
  }

  /**
   * List active API keys for an organization (key_hash excluded).
   */
  async listApiKeys(orgId: string): Promise<Omit<ApiKey, 'key_hash'>[]> {
    const { data, error } = await this.db
      .from('api_keys')
      .select(API_KEY_REDACTED_COLS)
      .eq('organization_id', orgId)
      .neq('status', 'revoked')
      .order('created_at', { ascending: false })

    if (error) throw new Error(`Failed to fetch API keys: ${error.message}`)
    return (data ?? []) as Omit<ApiKey, 'key_hash'>[]
  }

  /**
   * Insert a usage event row.
   */
  async insertUsageEvent(row: {
    organization_id: string
    api_key_id: string | null
    event_type: string
    quantity: number
    metadata?: Record<string, unknown>
  }): Promise<void> {
    const { error } = await this.db
      .from('usage_events')
      .insert(row)

    if (error) throw new Error(`Failed to record usage event: ${error.message}`)
  }

  /**
   * Fetch usage event totals for an organization within a date range.
   */
  async findUsageEvents(
    orgId: string,
    start: Date,
    end: Date
  ): Promise<Array<{ event_type: string; quantity: number }>> {
    const { data, error } = await this.db
      .from('usage_events')
      .select('event_type, quantity')
      .eq('organization_id', orgId)
      .gte('recorded_at', start.toISOString())
      .lte('recorded_at', end.toISOString())

    if (error) throw new Error(`Failed to fetch usage events: ${error.message}`)
    return (data ?? []) as Array<{ event_type: string; quantity: number }>
  }

  async insertAICostEvent(row: {
    organization_id: string
    user_id?: string | null
    event_type: string
    resource?: string | null
    quantity: number
    cost_tokens?: number | null
    cost_units?: number | null
    metadata?: Record<string, unknown>
  }): Promise<void> {
    const { error } = await this.db.from('usage_events').insert(row)
    if (error) throw new Error(`Failed to record AI cost event: ${error.message}`)
  }

  async findAICostEvents(
    orgId:     string,
    eventType: string,
    since:     string
  ): Promise<Array<{ resource: string | null; quantity: number; cost_tokens: number | null; cost_units: number | null }>> {
    const { data, error } = await this.db
      .from('usage_events')
      .select('resource, quantity, cost_tokens, cost_units')
      .eq('organization_id', orgId)
      .eq('event_type', eventType)
      .gte('recorded_at', since)

    if (error) throw new Error(`Failed to fetch AI cost events: ${error.message}`)
    return (data ?? []) as Array<{ resource: string | null; quantity: number; cost_tokens: number | null; cost_units: number | null }>
  }
}
