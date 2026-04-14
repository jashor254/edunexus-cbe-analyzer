// lib/utils/cache.ts
// Uses Next.js unstable_cache for persistent caching across serverless invocations.
// Falls back to in-process SimpleCache for non-Next.js contexts (e.g. scripts).

import { unstable_cache, revalidateTag } from 'next/cache'

// ============================================================
// SIMPLE IN-PROCESS CACHE (scripts / non-Next.js contexts)
// ============================================================

interface CacheEntry<T> {
  data: T
  expiresAt: number
}

class SimpleCache {
  private store = new Map<string, CacheEntry<any>>()

  set<T>(key: string, data: T, ttlMinutes: number = 60): void {
    this.store.set(key, {
      data,
      expiresAt: Date.now() + ttlMinutes * 60 * 1000
    })
  }

  get<T>(key: string): T | null {
    const entry = this.store.get(key)
    if (!entry) return null
    if (Date.now() > entry.expiresAt) {
      this.store.delete(key)
      return null
    }
    return entry.data as T
  }

  has(key: string): boolean {
    return this.get(key) !== null
  }

  delete(key: string): void {
    this.store.delete(key)
  }

  clear(): void {
    this.store.clear()
  }

  size(): number {
    return this.store.size
  }
}

// Singleton — one cache per process (useful for deduplification within a request)
export const cache = new SimpleCache()

// ============================================================
// CAREER SUGGESTIONS — persistent, 24-hour TTL
// Wraps the caller's fetch function with unstable_cache so the
// result survives across serverless cold starts.
// Usage:
//   const career = await getCachedCareerSuggestions(
//     query,
//     () => callDeepSeekForCareers(query)
//   )
// ============================================================

export async function getCachedCareerSuggestions(
  query: string,
  fetchFn: () => Promise<any>
): Promise<any> {
  const key = `career_${query.toLowerCase().trim()}`
  const fn = unstable_cache(
    async () => fetchFn(),
    [key],
    { revalidate: 86400, tags: ['careers'] }
  )
  return fn()
}

// ============================================================
// PATHWAY RECOMMENDATIONS — persistent, 6-hour TTL per student
// Usage:
//   const pathway = await getCachedPathwayRecommendation(
//     studentId,
//     () => generatePathway(studentId)
//   )
// ============================================================

export async function getCachedPathwayRecommendation(
  studentId: string,
  fetchFn: () => Promise<any>
): Promise<any> {
  const fn = unstable_cache(
    async () => fetchFn(),
    [`pathway_${studentId}`],
    { revalidate: 21600, tags: [`pathway-${studentId}`] }
  )
  return fn()
}

// ============================================================
// INVALIDATION
// Call after a new assessment is saved to bust the per-student cache.
// ============================================================

export function invalidatePathwayCache(studentId: string): void {
  revalidateTag(`pathway-${studentId}`, 'default')
}
