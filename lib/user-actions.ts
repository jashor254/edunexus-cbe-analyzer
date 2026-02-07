// lib/user-actions.ts
import { createClient } from '@/utils/supabase/client'

/**
 * Mark onboarding as complete for a specific user.
 * This handles the UUID update in the 'profiles' table.
 */
export async function markOnboardingComplete(userId: string) {
  // 1. Initialize the client-side Supabase client
  const supabase = createClient()

  try {
    // 2. Update the profile. 
    // user_id hapa inakuja kama UUID, na DB yetu sasa hivi ni UUID. Match!
    const { error } = await supabase
      .from('profiles')
      .update({ has_seen_onboarding: true })
      .eq('id', userId)

    if (error) {
      console.error('Database update error:', error.message)
      return false
    }

    return true
  } catch (err) {
    console.error('Unexpected error marking onboarding complete:', err)
    return false
  }
}

/**
 * Update user credits or tokens after payment (Example for later)
 */
export async function updateUserTokens(userId: string, tokens: number) {
  const supabase = createClient()
  
  const { error } = await supabase
    .from('profiles')
    .update({ tokens_remaining: tokens })
    .eq('id', userId)

  return !error
}