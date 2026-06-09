// app/api/users/use-free-analysis/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { createServiceClient } from '@/utils/supabase/service';

const supabase = createServiceClient();

export async function POST(request: NextRequest) {
  try {
    const { userId } = await request.json();

    if (!userId) {
      return NextResponse.json(
        { success: false, error: 'User ID required' },
        { status: 400 }
      );
    }

    const { data, error } = await supabase
      .rpc('use_free_analysis', {
        p_user_id: userId,
      });

    if (error) {
      console.error('Free analysis error:', error);
      return NextResponse.json(
        { success: false, error: error.message },
        { status: 500 }
      );
    }

    if (!data) {
      return NextResponse.json(
        { 
          success: false, 
          error: 'No free analysis available or expired' 
        },
        { status: 403 }
      );
    }

    return NextResponse.json({
      success: true,
      message: 'Free analysis used successfully',
    });
  } catch (error: unknown) {
    console.error('Use free analysis API error:', error);
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : 'Internal error' },
      { status: 500 }
    );
  }
}

export const dynamic = 'force-dynamic';