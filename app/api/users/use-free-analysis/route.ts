// app/api/users/use-free-analysis/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/utils/supabase/server';
import { createServiceClient } from '@/utils/supabase/service';

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    }

    const service = createServiceClient();
    const { data, error } = await service.rpc('use_free_analysis', {
      p_user_id: user.id,
    });

    if (error) {
      console.error('Free analysis error:', error);
      return NextResponse.json({ success: false, error: 'Failed to use free analysis' }, { status: 500 });
    }

    if (!data) {
      return NextResponse.json(
        { success: false, error: 'No free analysis available or expired' },
        { status: 403 }
      );
    }

    return NextResponse.json({ success: true, message: 'Free analysis used successfully' });
  } catch (error: unknown) {
    console.error('Use free analysis API error:', error);
    return NextResponse.json(
      { success: false, error: 'Internal error' },
      { status: 500 }
    );
  }
}

export const dynamic = 'force-dynamic';
