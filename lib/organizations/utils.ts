// lib/organizations/utils.ts
import type { Environment } from '@/lib/environment/types'

/**
 * Convert a display name to a URL-safe slug.
 * "Nairobi County Schools" → "nairobi-county-schools"
 */
export function slugify(name: string): string {
  return name
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9\s-]/g, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '')
}

/**
 * Generate a unique slug by appending a random suffix if needed.
 * The caller should check isSlugAvailable() before persisting.
 */
export async function generateOrgSlug(name: string): Promise<string> {
  const base = slugify(name)
  const suffix = Math.random().toString(36).slice(2, 6)
  return `${base}-${suffix}`
}

/**
 * Generate a cryptographically-random API key.
 * Format: en_{env}_{40-char-hex}
 * Returns { rawKey, prefix, hash }
 */
export async function generateApiKey(env: Environment = 'live'): Promise<{
  rawKey: string
  prefix: string
  hash: string
}> {
  const randomBytes = crypto.getRandomValues(new Uint8Array(24))
  const hex = Array.from(randomBytes).map(b => b.toString(16).padStart(2, '0')).join('')
  const rawKey = `en_${env}_${hex}`
  const prefix = rawKey.slice(0, 12)

  // SHA-256 hash for storage
  const encoder = new TextEncoder()
  const data = encoder.encode(rawKey)
  const hashBuffer = await crypto.subtle.digest('SHA-256', data)
  const hashArray = Array.from(new Uint8Array(hashBuffer))
  const hash = hashArray.map(b => b.toString(16).padStart(2, '0')).join('')

  return { rawKey, prefix, hash }
}

/**
 * Hash an existing raw API key for lookup.
 */
export async function hashApiKey(rawKey: string): Promise<string> {
  const encoder = new TextEncoder()
  const data = encoder.encode(rawKey)
  const hashBuffer = await crypto.subtle.digest('SHA-256', data)
  const hashArray = Array.from(new Uint8Array(hashBuffer))
  return hashArray.map(b => b.toString(16).padStart(2, '0')).join('')
}
