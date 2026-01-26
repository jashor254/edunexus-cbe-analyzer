// app/api/auth/update-activity/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

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
  } catch (err: any) {
    return NextResponse.json(
      { success: false, error: err.message || 'Internal Error' },
      { status: 500 }
    );
  }
}

export const dynamic = 'force-dynamic';