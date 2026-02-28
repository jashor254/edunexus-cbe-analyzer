// lib/utils/cache.ts
// ✅ Simple in-memory cache - no Redis needed
// ✅ Reduces AI API costs for repeated queries
// ✅ Auto-expires after set time

// ============================================================
// SIMPLE CACHE
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

    // Expired? Delete and return null
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

// ✅ Singleton - one cache for whole app
export const cache = new SimpleCache()

// ============================================================
// CAREER SEARCH CACHE
// ============================================================

// Cache career suggestions for 24 hours
// Same query = no API call = saves money!
export async function getCachedCareerSuggestions(
  query: string,
  fetchFn: () => Promise<any>
): Promise<any> {
  const cacheKey = `career_${query.toLowerCase().trim()}`

  // Cache hit?
  const cached = cache.get(cacheKey)
  if (cached) {
    console.log('✅ Cache hit for:', query)
    return cached
  }

  // Cache miss - fetch fresh
  console.log('🔄 Cache miss, fetching:', query)
  const result = await fetchFn()

  // Cache for 24 hours
  cache.set(cacheKey, result, 24 * 60)

  return result
}

// ============================================================
// PATHWAY CACHE
// ============================================================

// Cache pathway recommendations per student
// These don't change often
export async function getCachedPathwayRecommendation(
  studentId: string,
  fetchFn: () => Promise<any>
): Promise<any> {
  const cacheKey = `pathway_${studentId}`

  const cached = cache.get(cacheKey)
  if (cached) return cached

  const result = await fetchFn()
  cache.set(cacheKey, result, 6 * 60) // 6 hours

  return result
}

// Invalidate pathway cache when new assessment added
export function invalidatePathwayCache(studentId: string): void {
  cache.delete(`pathway_${studentId}`)
}

// ============================================================
// HOW TO USE IN YOUR ROUTES:
// ============================================================

/*
// In app/api/careers/search/route.ts:

import { getCachedCareerSuggestions } from '@/lib/utils/cache'

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)
  const query = searchParams.get('q') || ''

  const results = await getCachedCareerSuggestions(
    query,
    () => callDeepSeekForCareers(query) // Your existing AI call
  )

  return NextResponse.json(results)
}
*/

/*
// In your assessment service - invalidate when new assessment:

import { invalidatePathwayCache } from '@/lib/utils/cache'

async function addAssessment(studentId: string, data: any) {
  // Save assessment...
  await supabase.from('assessments').insert(data)

  // ✅ Clear old pathway cache so fresh recommendation generated
  invalidatePathwayCache(studentId)
}
*/