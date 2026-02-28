// app/api/careers/search/route.ts
// ✅ Exact same logic as original
// ✅ Added server-side caching (saves AI costs)
// ✅ Added rate limiting (prevents abuse)
// ✅ Added request logging

import { NextRequest, NextResponse } from 'next/server';
import { findCareerByName, getAllCareerNames } from '@/lib/academicClinic/careerDatabase';
import { generateDynamicCareer } from '@/lib/academicClinic/dynamicCareerGenerator';

// ============================================================
// SERVER-SIDE CACHE
// ✅ Caches AI-generated careers for 24 hours
// ✅ Same query = no API call = saves money
// ✅ Resets on server restart (that's fine)
// ============================================================

interface CacheEntry {
  data: any;
  expiresAt: number;
}

const careerCache = new Map<string, CacheEntry>();
const CACHE_TTL_MS = 24 * 60 * 60 * 1000; // 24 hours

function getCached(key: string): any | null {
  const entry = careerCache.get(key);
  if (!entry) return null;
  if (Date.now() > entry.expiresAt) {
    careerCache.delete(key);
    return null;
  }
  return entry.data;
}

function setCache(key: string, data: any): void {
  careerCache.set(key, {
    data,
    expiresAt: Date.now() + CACHE_TTL_MS,
  });
}

// ============================================================
// RATE LIMITING
// ✅ Per-IP: max 20 searches per hour
// ✅ In-memory (no Redis needed)
// ============================================================

interface RateLimitEntry {
  count: number;
  resetAt: number;
}

const rateLimitStore = new Map<string, RateLimitEntry>();
const RATE_LIMIT_MAX = 20;         // max requests
const RATE_LIMIT_WINDOW = 60 * 60 * 1000; // per hour

function checkRateLimit(ip: string): { allowed: boolean; remaining: number } {
  const now = Date.now();
  const entry = rateLimitStore.get(ip);

  // New IP or window expired → reset
  if (!entry || now > entry.resetAt) {
    rateLimitStore.set(ip, { count: 1, resetAt: now + RATE_LIMIT_WINDOW });
    return { allowed: true, remaining: RATE_LIMIT_MAX - 1 };
  }

  // Over limit
  if (entry.count >= RATE_LIMIT_MAX) {
    return { allowed: false, remaining: 0 };
  }

  // Increment
  entry.count++;
  return { allowed: true, remaining: RATE_LIMIT_MAX - entry.count };
}

// ============================================================
// MAIN HANDLER
// ============================================================

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const careerName = searchParams.get('name');
  const autocomplete = searchParams.get('autocomplete');

  try {

    // --------------------------------------------------------
    // AUTOCOMPLETE - no rate limit, no cache needed
    // Fast lookup from static database
    // --------------------------------------------------------
    if (autocomplete === 'true') {
      const allCareers = getAllCareerNames();
      return NextResponse.json({ careers: allCareers });
    }

    // --------------------------------------------------------
    // VALIDATE
    // --------------------------------------------------------
    if (!careerName || !careerName.trim()) {
      return NextResponse.json(
        { error: 'Career name is required' },
        { status: 400 }
      );
    }

    const normalizedName = careerName.trim().toLowerCase();

    // --------------------------------------------------------
    // RATE LIMIT CHECK
    // --------------------------------------------------------
    const ip =
      request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ||
      request.headers.get('x-real-ip') ||
      'unknown';

    const { allowed, remaining } = checkRateLimit(ip);

    if (!allowed) {
      return NextResponse.json(
        {
          error: 'Too many searches. Please wait before trying again.',
          retryAfter: '1 hour',
        },
        {
          status: 429,
          headers: {
            'X-RateLimit-Remaining': '0',
            'Retry-After': '3600',
          },
        }
      );
    }

    // --------------------------------------------------------
    // 1. TRY STATIC DATABASE FIRST (free, instant)
    // --------------------------------------------------------
    const staticCareer = findCareerByName(careerName);

    if (staticCareer) {
      return NextResponse.json(
        {
          career: staticCareer,
          source: 'static',
          message: 'Career from our curated database',
        },
        {
          headers: {
            'X-RateLimit-Remaining': String(remaining),
            'X-Cache': 'STATIC',
          },
        }
      );
    }

    // --------------------------------------------------------
    // 2. CHECK SERVER CACHE (free, fast)
    // --------------------------------------------------------
    const cacheKey = `career_${normalizedName}`;
    const cachedResult = getCached(cacheKey);

    if (cachedResult) {
      console.log(`✅ Cache hit: "${careerName}"`);
      return NextResponse.json(
        {
          ...cachedResult,
          cached: true,
        },
        {
          headers: {
            'X-RateLimit-Remaining': String(remaining),
            'X-Cache': 'HIT',
          },
        }
      );
    }

    // --------------------------------------------------------
    // 3. GENERATE WITH AI (costs money - last resort)
    // --------------------------------------------------------
    console.log(`🤖 AI generating: "${careerName}"`);

    try {
      const dynamicCareer = await generateDynamicCareer(careerName);

      const responseData = {
        career: dynamicCareer,
        source: 'dynamic',
        message: 'Career generated by AI. Data will be reviewed by our team.',
      };

      // Cache the AI result so next person asking same career = free
      setCache(cacheKey, responseData);

      return NextResponse.json(responseData, {
        headers: {
          'X-RateLimit-Remaining': String(remaining),
          'X-Cache': 'MISS',
        },
      });

    } catch (aiError) {
      console.error('❌ AI generation failed:', aiError);

      return NextResponse.json(
        {
          error: 'Failed to generate career information',
          details: aiError instanceof Error ? aiError.message : 'AI generation error',
        },
        { status: 500 }
      );
    }

  } catch (error) {
    console.error('❌ Career search error:', error);

    return NextResponse.json(
      {
        error: 'Search failed',
        details: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';