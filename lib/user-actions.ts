// lib/user-actions.ts
'use server'

import { createClient } from '@/utils/supabase/server'
import { revalidatePath } from 'next/cache'

/**
 * Mark onboarding as complete for a user
 */
export async function markOnboardingComplete(userId: string): Promise<{ success: boolean; error?: string }> {
  try {
    const supabase = await createClient()

    const { error } = await supabase
      .from('users')
      .update({ 
        has_seen_onboarding: true,
        onboarding_completed_at: new Date().toISOString()
      })
      .eq('id', userId)

    if (error) {
      console.error('Failed to mark onboarding complete:', error)
      return { success: false, error: error.message }
    }

    // Revalidate the dashboard to reflect changes
    revalidatePath('/dashboard')
    
    return { success: true }
  } catch (error) {
    console.error('Error in markOnboardingComplete:', error)
    return { success: false, error: 'Failed to update onboarding status' }
  }
}

/**
 * Check if user has seen onboarding
 */
export async function hasSeenOnboarding(userId: string): Promise<boolean> {
  try {
    const supabase = await createClient()

    const { data, error } = await supabase
      .from('users')
      .select('has_seen_onboarding')
      .eq('id', userId)
      .single()

    if (error) {
      console.error('Failed to check onboarding status:', error)
      return false
    }

    return data?.has_seen_onboarding ?? false
  } catch (error) {
    console.error('Error in hasSeenOnboarding:', error)
    return false
  }
}

/**
 * Log tutorial replay (optional analytics)
 */
export async function logTutorialReplay(userId: string): Promise<void> {
  try {
    const supabase = await createClient()

    await supabase
      .from('user_activity_log')
      .insert({
        user_id: userId,
        activity_type: 'tutorial_replay',
        created_at: new Date().toISOString()
      })
  } catch (error) {
    console.error('Failed to log tutorial replay:', error)
    // Silent fail - not critical
  }
}