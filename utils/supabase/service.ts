import { createClient } from '@supabase/supabase-js'

export function createServiceClient() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const serviceKey  = process.env.SUPABASE_SERVICE_ROLE_KEY

  if (!supabaseUrl || !serviceKey) {
    throw new Error(
      'Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY'
    )
  }

  // Node.js < 22 has no native WebSocket — inject ws so scripts work
  // Next.js server runtime polyfills WebSocket, so this branch is skipped in prod
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const transport = typeof WebSocket === 'undefined' ? require('ws') : undefined

  return createClient(supabaseUrl, serviceKey, {
    auth: { autoRefreshToken: false, persistSession: false },
    ...(transport ? { realtime: { transport } } : {}),
  })
}
