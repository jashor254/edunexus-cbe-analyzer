// app/api/auth/update-activity/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { createServiceClient } from '@/utils/supabase/service';

const supabase = createServiceClient();

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const email = body?.email;

    if (!email) {
      return NextResponse.json(
        { success: false, error: 'Email required' },
        { status: 400 }
      );
    }

    const { error } = await supabase
      .from('users')
      .update({ 
        last_active_at: new Date().toISOString(),
        last_login_at: new Date().toISOString(),
      })
      .eq('email', email);

    if (error) throw error;

    return NextResponse.json({ success: true });
  } catch (err: unknown) {
    return NextResponse.json(
      { success: false, error: err instanceof Error ? err.message : 'Internal Error' },
      { status: 500 }
    );
  }
}

export const dynamic = 'force-dynamic';