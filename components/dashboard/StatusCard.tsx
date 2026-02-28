import { canAccessPremiumFeatures } from '@/lib/access';

export default function StatusCard({ profile, subscription }: any) {
  const hasAccess = canAccessPremiumFeatures({
    email: profile?.email,
    role: profile?.role,
    planType: subscription?.plan_type,
    tokens: subscription?.tokens_remaining
  });

  const isUnlimited = subscription?.plan_type === 'term' || profile?.role === 'school_admin';

  return (
    <div className="bg-white border-2 border-slate-200 rounded-2xl p-6 shadow-sm">
      <div className="flex justify-between items-start">
        <div>
          <p className="text-xs font-black text-slate-400 uppercase tracking-widest mb-1">
            Membership Status
          </p>
          <h3 className="text-2xl font-black text-slate-900 italic">
            {isUnlimited ? 'FOUNDER ACCESS' : 'STANDARD PLAN'}
          </h3>
        </div>
        <div className={`px-3 py-1 rounded-full text-[10px] font-black uppercase ${hasAccess ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>
          {hasAccess ? '● Active' : '● Inactive'}
        </div>
      </div>

      <div className="mt-6 flex items-center gap-4">
        <div className="flex-1 bg-slate-100 h-2 rounded-full overflow-hidden">
          <div 
            className="bg-blue-600 h-full transition-all" 
            style={{ width: isUnlimited ? '100%' : `${(subscription?.tokens_remaining / 100) * 100}%` }}
          />
        </div>
        <span className="text-sm font-bold text-slate-600">
          {isUnlimited ? '∞ Tokens' : `${subscription?.tokens_remaining} left`}
        </span>
      </div>
    </div>
  );
}