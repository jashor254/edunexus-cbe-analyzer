// lib/api-protection.ts
import { createClient } from '@/utils/supabase/server';
import { canAccessPremiumFeatures } from './access';
import { ADMIN_CONFIG } from '@/lib/config/api';

export async function validateUserAccess() {
  // MUHIMU: Await hapa kurekebisha ile error
  const supabase = await createClient(); 
  
  // Get current session
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { allowed: false, error: 'Unauthorized', user: null };

  // Get profile data
  const { data: profile } = await supabase
    .from('profiles')
    .select('role, email')
    .eq('id', user.id)
    .single();

  // Get subscription data
  const { data: subscription } = await supabase
    .from('subscriptions')
    .select('plan_type, tokens_remaining')
    .eq('user_id', user.id)
    .single();

  const allowed = canAccessPremiumFeatures({
    email: user.email,
    role: profile?.role,
    planType: subscription?.plan_type,
    tokens: subscription?.tokens_remaining || 0
  });

  return {
    allowed,
    user,
    subscription,
    // Hii inatusaidia kujua kama tukate token au la
    isUnlimited: profile?.role === 'school_admin' || (!!user.email && ADMIN_CONFIG.isAdmin(user.email))
  };
}