// app/api/admin/trigger-cleanup/route.ts
import { NextRequest, NextResponse } from 'next/server';

export async function POST(request: NextRequest) {
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
  } catch (error: any) {
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 }
    );
  }
}

export const dynamic = 'force-dynamic';