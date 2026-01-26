import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function POST(request: NextRequest) {
  try {
    const authHeader = request.headers.get('authorization');
    const cronSecret = process.env.CRON_SECRET;

    if (!cronSecret || authHeader !== `Bearer ${cronSecret}`) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // 1. Expire analyses
    const { data: expiredCount, error: expireError } = await supabase.rpc('expire_free_analyses');
    if (expireError) console.error(expireError);

    // 2. Mark users
    const { data: markedResults, error: markError } = await supabase.rpc('mark_users_for_deletion');
    if (markError) console.error(markError);

    // 3. Cleanup
    const { data: cleanupResults, error: cleanupError } = await supabase.rpc('cleanup_marked_users');
    if (cleanupError) throw cleanupError;

    const stats = cleanupResults?.[0] || { deleted_count: 0, idle_deleted: 0, unverified_deleted: 0 };

    return NextResponse.json({
      success: true,
      results: stats
    });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
} // <--- Hii hapa ndio mara nyingi inasahaulika!

export async function GET() {
  return NextResponse.json({ status: 'Active' });
}

export const dynamic = 'force-dynamic';