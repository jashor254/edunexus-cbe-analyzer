// app/api/admin/trigger-cleanup/route.ts
//
// Founder-only manual run of the idle/unverified-account cleanup cron
// (app/api/cron/cleanup-users). Security audit 2026-10-30, F-08: this was
// gated by a shared ADMIN_SECRET bearer token with no attempt limit, so
// anyone who guessed it could trigger account deletion. It now requires the
// founder's own signed-in session (requireGrowthUser — the same server-side,
// fail-closed gate as every other founder surface), which is also what lets
// the /admin/cleanup dashboard call it at all: that page never had the
// secret to send. The cron itself is unchanged and still authenticates with
// CRON_SECRET only.
import { NextResponse } from 'next/server';
import { createClient } from '@/utils/supabase/server';
import { apiUnauthorized, apiForbidden } from '@/lib/api/response';
import { requireGrowthUser } from '@/lib/growth/auth';
import { UnauthorizedError, ForbiddenError } from '@/lib/core/errors';
import { logger } from '@/lib/observability/logger';

export async function POST() {
  let founderId: string;
  try {
    founderId = (await requireGrowthUser(await createClient())).id;
  } catch (error) {
    if (error instanceof UnauthorizedError) return apiUnauthorized();
    if (error instanceof ForbiddenError) return apiForbidden();
    throw error;
  }

  // Security-relevant administrative action: who triggered it, never the secret.
  logger.info('Account cleanup triggered manually', { operation: 'admin.trigger-cleanup', actor_id: founderId });

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
    logger.error('Manual account cleanup failed', { operation: 'admin.trigger-cleanup', actor_id: founderId }, error);
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : 'Internal error' },
      { status: 500 }
    );
  }
}

export const dynamic = 'force-dynamic';
