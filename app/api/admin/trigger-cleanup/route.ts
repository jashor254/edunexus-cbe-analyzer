// app/api/admin/trigger-cleanup/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { apiUnauthorized } from '@/lib/api/response';
import { ADMIN_CONFIG } from '@/lib/config/api';
import { timingSafeEqualString } from '@/lib/api/secretCompare';

export async function POST(request: NextRequest) {
  const authHeader = request.headers.get('authorization');
  const secret = ADMIN_CONFIG.adminSecret;
  if (!secret || !timingSafeEqualString(authHeader, `Bearer ${secret}`)) return apiUnauthorized();

  try {
    // Call the cron endpoint manually
    const response = await fetch(
      `${process.env.NEXT_PUBLIC_APP_URL}/api/cron/cleanup-users`,
      {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${process.env.CRON_SECRET}`,
        },
      }
    );

    const data = await response.json();

    return NextResponse.json({
      success: true,
      message: 'Cleanup triggered manually',
      results: data,
    });
  } catch (error: unknown) {
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : 'Internal error' },
      { status: 500 }
    );
  }
}

export const dynamic = 'force-dynamic';