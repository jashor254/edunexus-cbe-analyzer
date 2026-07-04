import { createServiceClient } from '@/utils/supabase/service'
import type { SupabaseClient } from '@supabase/supabase-js'

export abstract class BaseRepository {
  protected readonly db: SupabaseClient

  constructor() {
    this.db = createServiceClient()
  }
}
