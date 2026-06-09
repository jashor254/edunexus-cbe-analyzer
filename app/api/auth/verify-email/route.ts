// app/api/auth/verify-email/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { createServiceClient } from '@/utils/supabase/service';

const supabase = createServiceClient();

export async function POST(request: NextRequest) {
  try {
    const { email } = await request.json();

    if (!email) {
      return NextResponse.json(
        { success: false, error: 'Email required' },
        { status: 400 }
      );
    }

    // Mark user as verified
    const { error } = await supabase
      .from('users')
      .update({ 
        email_verified: true,
        last_active_at: new Date().toISOString(),
      })
      .eq('email', email);

    if (error) {
      console.error('Verify email error:', error);
      return NextResponse.json(
        { success: false, error: error.message },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      message: 'Email verified successfully',
    });
  } catch (error: unknown) {
    console.error('Email verification error:', error);
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : 'Internal error' },
      { status: 500 }
    );
  }
}

export const dynamic = 'force-dynamic';