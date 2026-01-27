import { createClient } from '@/utils/supabase/server';
import ReferralsDashboard from '@/components/referrals/ReferralsDashboard';
import { redirect } from 'next/navigation';

export default async function ReferralsPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) redirect('/login');

  const { data: userData } = await supabase
    .from('users')
    .select('id, name')
    .eq('id', user.id)
    .single();

  return (
    <div className="min-h-screen bg-gray-50/50 p-4 md:p-8">
      <div className="max-w-5xl mx-auto">
        <header className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900">Refer & Earn</h1>
        </header>
        
        {/* Hapa tunaita ile component yako ya chini */}
        <ReferralsDashboard userId={userData?.id || user.id} userName={userData?.name} />
      </div>
    </div>
  );
}