// app/api/admin/cleanup-stats/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { createServiceClient } from '@/utils/supabase/service';

const supabase = createServiceClient();

export async function GET(request: NextRequest) {
  try {
    // Get cleanup statistics
    const { data: stats, error } = await supabase
      .from('user_cleanup_stats')
      .select('id, run_at, deleted_count, idle_deleted, unverified_deleted, details, created_at, updated_at')
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
  } catch (error: unknown) {
    console.error('Stats error:', error);
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : 'Internal error' },
      { status: 500 }
    );
  }
}

export const dynamic = 'force-dynamic';