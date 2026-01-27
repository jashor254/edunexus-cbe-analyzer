// app/api/admin/cleanup-stats/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function GET(request: NextRequest) {
  try {
    // Get cleanup statistics
    const { data: stats, error } = await supabase
      .from('user_cleanup_stats')
      .select('*')
      .single();

    if (error) throw error;

    // Get recent deletions
    const { data: recentDeletions } = await supabase
      .from('users')
      .select('email, deleted_at, created_at, last_active_at')
      .not('deleted_at', 'is', null)
      .order('deleted_at', { ascending: false })
      .limit(10);

    // Get users pending deletion
    const { data: pendingDeletion } = await supabase
      .from('users')
      .select('email, deletion_scheduled_at, created_at, email_verified')
      .not('deletion_scheduled_at', 'is', null)
      .is('deleted_at', null)
      .order('deletion_scheduled_at', { ascending: true })
      .limit(10);

    return NextResponse.json({
      success: true,
      stats: stats || {},
      recent_deletions: recentDeletions || [],
      pending_deletion: pendingDeletion || [],
    });
  } catch (error: any) {
    console.error('Stats error:', error);
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 }
    );
  }
}

export const dynamic = 'force-dynamic';