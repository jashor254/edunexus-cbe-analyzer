import SubscriptionPlans from '@/components/payments/SubscriptionPlans';
import { createClient } from '@/utils/supabase/server'; // Tumia hii badala ya lib

export default async function PricingPage() {
  const supabase = await createClient();
  
  // Pata user data moja kwa moja kutoka kwa session
  const { data: { user } } = await supabase.auth.getUser();

  // Hapa unaweza ku-fetch data ya user kutoka database kuona kama ametumia Free Analysis
  let hasUsedFree = false;
  if (user) {
    const { data: profile } = await supabase
      .from('profiles') // tuseme una table ya profiles
      .select('has_free_analysis_used')
      .eq('id', user.id)
      .single();
    
    hasUsedFree = profile?.has_free_analysis_used || false;
  }

  return (
    <div className="min-h-screen bg-gray-50 py-20 px-4">
      <div className="max-w-4xl mx-auto text-center mb-12">
        <h1 className="text-4xl font-extrabold text-gray-900 mb-4">
          Investment in your Child's Future
        </h1>
        <p className="text-xl text-gray-600">
          Choose a plan that fits your family's needs.
        </p>
      </div>

      <SubscriptionPlans 
        userEmail={user?.email || ""} 
        hasFreeAnalysis={hasUsedFree}
      />
    </div>
  );
}