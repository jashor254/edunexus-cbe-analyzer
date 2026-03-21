'use client';

import { useState } from 'react';
import { Check, Zap, Package, Crown, Sparkles } from 'lucide-react';
import { 
  PAYMENT_PLANS, 
  TOKEN_BUNDLES, 
  PlanType, 
  TokenBundleType,
  formatCurrency 
} from '@/lib/payments/config';
import PaymentModal from './PaymentModal';

interface SubscriptionPlansProps {
  userEmail: string;
  hasFreeAnalysis: boolean;
  currentPlanId?: string; // Mpya: Ili tujue kama tayari amelipa
}

export default function SubscriptionPlans({ 
  userEmail,
  hasFreeAnalysis,
  currentPlanId
}: SubscriptionPlansProps) {
  const [selectedPlan, setSelectedPlan] = useState<PlanType | null>(null);
  const [selectedBundle, setSelectedBundle] = useState<TokenBundleType | null>(null);
  const [showPaymentModal, setShowPaymentModal] = useState(false);

  const handleSelectPlan = (planType: PlanType) => {
    setSelectedPlan(planType);
    setSelectedBundle(null);
    setShowPaymentModal(true);
  };

  const handleSelectBundle = (bundleType: TokenBundleType) => {
    setSelectedBundle(bundleType);
    setSelectedPlan(null);
    setShowPaymentModal(true);
  };

  // Convert objects to arrays for easier mapping without TS errors
  const tokenBundlesList = Object.entries(TOKEN_BUNDLES) as [TokenBundleType, typeof TOKEN_BUNDLES['starter']][];

  return (
    <>
      <div className="py-12 px-4 bg-gray-50/50 rounded-3xl">
        <div className="max-w-7xl mx-auto">
          {/* Header */}
          <div className="text-center mb-12">
            <h2 className="text-4xl font-black text-gray-900 mb-4 tracking-tight">
              Ready to Upgrade?
            </h2>
            <p className="text-lg text-gray-600 font-medium">
              Join 500+ CBC teachers using EduNexus to save 10+ hours weekly.
            </p>
            {hasFreeAnalysis && (
              <div className="mt-6 inline-flex items-center gap-2 bg-green-100 text-green-700 px-6 py-2 rounded-full text-sm font-bold animate-bounce">
                <Sparkles className="w-4 h-4" />
                You have 1 FREE analysis left!
              </div>
            )}
          </div>

          {/* Termly Subscription (The Hero) */}
          <div className="max-w-3xl mx-auto mb-16">
            <div className={`relative rounded-[2.5rem] border-4 p-10 shadow-2xl transition-all ${
              currentPlanId === 'termly' ? 'border-green-500 bg-white' : 'border-blue-600 bg-white'
            }`}>
              <div className="absolute -top-5 left-1/2 transform -translate-x-1/2">
                <span className="bg-blue-600 text-white px-8 py-2 rounded-full text-sm font-black uppercase tracking-tighter flex items-center gap-2 shadow-lg">
                  <Crown className="w-4 h-4" />
                  Recommended for Teachers
                </span>
              </div>

              <div className="flex flex-col md:flex-row items-center justify-between mb-8 gap-6">
                <div className="flex items-center gap-5">
                  <div className="p-4 rounded-3xl bg-blue-50">
                    <Zap className="w-10 h-10 text-blue-600" />
                  </div>
                  <div>
                    <h3 className="text-3xl font-black text-gray-900 leading-none">
                      {PAYMENT_PLANS.termly.name}
                    </h3>
                    <p className="text-gray-500 font-bold mt-2 uppercase text-xs tracking-widest">Unlimited potential</p>
                  </div>
                </div>
                <div className="text-center md:text-right">
                  <div className="text-5xl font-black text-gray-900">
                    {formatCurrency(PAYMENT_PLANS.termly.price)}
                  </div>
                  <div className="text-sm font-bold text-gray-400 uppercase tracking-widest">per school term</div>
                </div>
              </div>

              <div className="grid md:grid-cols-2 gap-y-4 gap-x-8 mb-10 border-y py-8 border-gray-100">
                {PAYMENT_PLANS.termly.features.map((feature, index) => (
                  <div key={index} className="flex items-center gap-3">
                    <div className="bg-green-100 p-1 rounded-full">
                      <Check className="w-4 h-4 text-green-600" />
                    </div>
                    <span className="text-gray-700 font-bold text-sm">{feature}</span>
                  </div>
                ))}
              </div>

              <button
                onClick={() => handleSelectPlan('termly')}
                disabled={currentPlanId === 'termly'}
                className="w-full py-6 bg-gray-900 text-white text-xl font-black rounded-2xl hover:bg-blue-700 hover:scale-[1.02] active:scale-95 transition-all shadow-xl shadow-blue-100 disabled:bg-green-500"
              >
                {currentPlanId === 'termly' ? '✓ YOUR CURRENT PLAN' : `GET STARTED NOW`}
              </button>
            </div>
          </div>

          {/* Token Bundles */}
          <div className="text-center mb-10">
            <h3 className="text-2xl font-black text-gray-900 mb-2 uppercase tracking-tighter">
              Short on cash? Buy Tokens
            </h3>
            <p className="text-gray-500 font-bold">Pay as you go. No expiry. No pressure.</p>
          </div>

          <div className="grid md:grid-cols-3 gap-8 max-w-6xl mx-auto">
            {tokenBundlesList.map(([id, bundle]) => (
              <div
                key={id}
                className={`group relative rounded-[2rem] border-2 p-8 shadow-sm transition-all hover:shadow-xl hover:-translate-y-2 ${
                  bundle.popular ? 'border-orange-400 bg-orange-50/50' : 'border-gray-100 bg-white'
                }`}
              >
                <div className="flex flex-col items-center text-center">
                  <div className={`p-4 rounded-2xl mb-6 transition-colors ${
                    bundle.popular ? 'bg-orange-100' : 'bg-gray-50 group-hover:bg-blue-50'
                  }`}>
                    <Package className={`w-8 h-8 ${bundle.popular ? 'text-orange-600' : 'text-gray-400'}`} />
                  </div>

                  <h4 className="text-xl font-black text-gray-900 mb-2">{bundle.name}</h4>
                  <div className="text-4xl font-black text-gray-900 mb-1">
                    {formatCurrency(bundle.price)}
                  </div>
                  <p className="text-sm font-bold text-gray-500 uppercase tracking-widest mb-6">
                    {bundle.tokens} ANALYSES
                  </p>

                  <button
                    onClick={() => handleSelectBundle(id)}
                    className={`w-full py-4 rounded-xl font-black transition-all shadow-lg ${
                      bundle.popular
                        ? 'bg-orange-600 text-white hover:bg-orange-700'
                        : 'bg-white border-2 border-gray-900 text-gray-900 hover:bg-gray-900 hover:text-white'
                    }`}
                  >
                    SELECT
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {showPaymentModal && (selectedPlan || selectedBundle) && (
        <PaymentModal
          planType={selectedPlan}
          bundleType={selectedBundle}
          userEmail={userEmail}
          onClose={() => {
            setShowPaymentModal(false);
            setSelectedPlan(null);
            setSelectedBundle(null);
          }}
        />
      )}
    </>
  );
}