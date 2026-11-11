// lib/api/childDataAIResponse.ts
//
// The one response a route returns when a learner-data AI workflow is paused
// (lib/ai/childDataPolicy.ts). Honest about the reason, carries a stable code
// the UI can key off, and is never cached.
import { NextResponse } from 'next/server'
import {
  CHILD_DATA_AI_PAUSED_CODE,
  CHILD_DATA_AI_PAUSED_MESSAGE,
  CHILD_DATA_AI_PAUSED_STATUS,
} from '@/lib/ai/childDataPolicy'

export function apiChildDataAIPaused(): NextResponse {
  return NextResponse.json(
    {
      success: false,
      data: null,
      error: CHILD_DATA_AI_PAUSED_MESSAGE,
      code: CHILD_DATA_AI_PAUSED_CODE,
      meta: { timestamp: new Date().toISOString(), version: '1.0' },
    },
    { status: CHILD_DATA_AI_PAUSED_STATUS, headers: { 'Cache-Control': 'no-store' } },
  )
}
