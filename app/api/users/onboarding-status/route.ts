// app/api/users/onboarding-status/route.ts

import { NextRequest } from 'next/server'
import { apiSuccess, apiError, apiUnauthorized } from '@/lib/api/response'
import { createClient } from '@/utils/supabase/server'

// GET — check if the current user has completed onboarding
export async function GET(_req: NextRequest) {
  try {
    const supabase = await createClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser()

    if (authError || !user) {
      return apiUnauthorized()
    }

    const { data, error } = await supabase
      .from('profiles')
      .select('onboarding_completed')
      .eq('user_id', user.id)
      .single()

    if (error) {
      // Profile might not exist yet — treat as not completed
      return apiSuccess({ completed: false })
    }

    return apiSuccess({ completed: Boolean(data?.onboarding_completed) })
  } catch (err) {
    console.error('onboarding-status GET error:', err)
    return apiError('Failed to fetch onboarding status')
  }
}

// POST — mark onboarding as completed for the current user
export async function POST(_req: NextRequest) {
  try {
    const supabase = await createClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser()

    if (authError || !user) {
      return apiUnauthorized()
    }

    const { error } = await supabase
      .from('profiles')
      .upsert(
        {
          user_id: user.id,
          onboarding_completed: true,
          onboarding_completed_at: new Date().toISOString(),
        },
        { onConflict: 'user_id' }
      )

    if (error) {
      console.error('onboarding-status POST error:', error)
      return apiError('Failed to update onboarding status')
    }

    return apiSuccess({ completed: true })
  } catch (err) {
    console.error('onboarding-status POST error:', err)
    return apiError('Failed to update onboarding status')
  }
}
