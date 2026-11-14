import { createServiceClient } from '@/utils/supabase/service'
import type { SupabaseClient } from '@supabase/supabase-js'

export abstract class BaseRepository {
  private cachedDb: SupabaseClient | undefined

  /**
   * Service-role client, created on FIRST USE rather than in the constructor.
   *
   * lib/repositories/index.ts builds one singleton of every repository at module
   * evaluation, and ~300 routes import it. Constructing the client eagerly meant
   * that merely importing `repos` — which `next build` does while collecting page
   * data — threw "Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SECRET_KEY" in any
   * environment without the production secret (e.g. an isolated Preview build),
   * although a build performs no database call.
   *
   * Credential validation is NOT weakened: createServiceClient() still throws the
   * same error, at the first database operation, and there is deliberately no
   * fallback credential. A misconfigured runtime still fails on its first request
   * and /api/health (which uses this client) reports it.
   */
  protected get db(): SupabaseClient {
    if (!this.cachedDb) this.cachedDb = createServiceClient()
    return this.cachedDb
  }
}
