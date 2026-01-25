// components/payments/SubscriptionPlans.tsx
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
}

export default function SubscriptionPlans({ 
  userEmail,
  hasFreeAnalysis
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

  return (
    <>
      <div className="py-12 px-4">
        <div className="max-w-7xl mx-auto">
          {/* Header */}
          <div className="text-center mb-12">
            <h2 className="text-3xl font-bold text-gray-900 mb-4">
              Choose Your Plan
            </h2>
            <p className="text-lg text-gray-600 mb-2">
              Unlock powerful AI tools for CBC teaching
            </p>
            {hasFreeAnalysis && (
              <div className="inline-flex items-center gap-2 bg-green-50 text-green-700 px-4 py-2 rounded-full text-sm font-semibold">
                <Sparkles className="w-4 h-4" />
                You have 1 FREE analysis available!
              </div>
            )}
          </div>

          {/* Termly Subscription */}
          <div className="max-w-2xl mx-auto mb-12">
            <div className="relative rounded-2xl border-2 border-blue-500 bg-blue-50 p-8 shadow-lg ring-2 ring-blue-500">
              <div className="absolute -top-4 left-1/2 transform -translate-x-1/2">
                <span className="bg-blue-600 text-white px-6 py-2 rounded-full text-sm font-semibold flex items-center gap-2">
                  <Crown className="w-4 h-4" />
                  Best Value - Most Popular
                </span>
              </div>

              <div className="flex items-start justify-between mb-6 mt-4">
                <div className="flex-1">
                  <div className="flex items-center gap-3 mb-2">
                    <div className="p-3 rounded-full bg-blue-100">
                      <Zap className="w-8 h-8 text-blue-600" />
                    </div>
                    <div>
                      <h3 className="text-2xl font-bold text-gray-900">
                        Termly Subscription
                      </h3>
                      <p className="text-gray-600 text-sm">Best for regular users</p>
                    </div>
                  </div>
                </div>
                <div className="text-right">
                  <div className="text-4xl font-bold text-gray-900">
                    {formatCurrency(PAYMENT_PLANS.termly.price)}
                  </div>
                  <div className="text-sm text-gray-600">per term</div>
                  <div className="text-xs text-green-600 font-semibold mt-1">
                    Save {formatCurrency(PAYMENT_PLANS.termly.savings)}!
                  </div>
                </div>
              </div>

              <div className="grid md:grid-cols-2 gap-4 mb-6">
                {PAYMENT_PLANS.termly.features.map((feature, index) => (
                  <div key={index} className="flex items-start gap-2">
                    <Check className="w-5 h-5 text-green-600 flex-shrink-0 mt-0.5" />
                    <span className="text-gray-700 text-sm">{feature}</span>
                  </div>
                ))}
              </div>

              <button
                onClick={() => handleSelectPlan('termly')}
                className="w-full py-4 bg-gradient-to-r from-blue-600 to-purple-600 text-white font-bold rounded-lg hover:from-blue-700 hover:to-purple-700 transition-all shadow-lg"
              >
                Subscribe Now - {formatCurrency(PAYMENT_PLANS.termly.price)}
              </button>
            </div>
          </div>

          {/* Token Bundles */}
          <div className="mb-8">
            <h3 className="text-2xl font-bold text-center text-gray-900 mb-2">
              Or Buy Token Bundles
            </h3>
            <p className="text-center text-gray-600 mb-8">
              Pay only for what you need - tokens never expire
            </p>
          </div>

          <div className="grid md:grid-cols-3 gap-6 max-w-5xl mx-auto">
            {(Object.keys(TOKEN_BUNDLES) as TokenBundleType[]).map((bundleType) => {
              const bundle = TOKEN_BUNDLES[bundleType];

              return (
                <div
                  key={bundleType}
                  className={`relative rounded-xl border-2 p-6 shadow-md transition-transform hover:scale-105 ${
                    bundle.popular
                      ? 'border-orange-500 bg-orange-50'
                      : 'border-gray-300 bg-white'
                  }`}
                >
                  {bundle.popular && (
                    <div className="absolute -top-3 left-1/2 transform -translate-x-1/2">
                      <span className="bg-orange-600 text-white px-3 py-1 rounded-full text-xs font-semibold">
                        Most Popular
                      </span>
                    </div>
                  )}

                  <div className="flex justify-center mb-4">
                    <div className={`p-3 rounded-full ${
                      bundle.popular 
                        ? 'bg-orange-100' 
                        : 'bg-gray-100'
                    }`}>
                      <Package className={`w-6 h-6 ${
                        bundle.popular 
                          ? 'text-orange-600' 
                          : 'text-gray-600'
                      }`} />
                    </div>
                  </div>

                  <h4 className="text-xl font-bold text-center mb-2">
                    {bundle.name}
                  </h4>

                  <div className="text-center mb-4">
                    <div className="text-3xl font-bold text-gray-900">
                      {formatCurrency(bundle.price)}
                    </div>
                    <div className="text-sm text-gray-600">
                      {bundle.tokens} AI Analyses
                    </div>
                    <div className="text-xs text-gray-500 mt-1">
                      {formatCurrency(bundle.pricePerToken)} per analysis
                    </div>
                    {bundle.savings > 0 && (
                      <div className="text-xs text-green-600 font-semibold mt-1">
                        Save {formatCurrency(bundle.savings)}!
                      </div>
                    )}
                  </div>

                  <ul className="space-y-2 mb-6">
                    <li className="flex items-center gap-2 text-sm text-gray-700">
                      <Check className="w-4 h-4 text-green-600" />
                      {bundle.tokens} scheme analyses
                    </li>
                    <li className="flex items-center gap-2 text-sm text-gray-700">
                      <Check className="w-4 h-4 text-green-600" />
                      Never expires
                    </li>
                    <li className="flex items-center gap-2 text-sm text-gray-700">
                      <Check className="w-4 h-4 text-green-600" />
                      Full access to all features
                    </li>
                  </ul>

                  <button
                    onClick={() => handleSelectBundle(bundleType)}
                    className={`w-full py-3 rounded-lg font-semibold transition-colors ${
                      bundle.popular
                        ? 'bg-orange-600 hover:bg-orange-700 text-white'
                        : 'bg-gray-600 hover:bg-gray-700 text-white'
                    }`}
                  >
                    Buy Now
                  </button>
                </div>
              );
            })}
          </div>

          {/* Trust Signals */}
          <div className="mt-12 text-center">
            <p className="text-sm text-gray-600 mb-4">
              Trusted by CBC teachers across Kenya
            </p>
            <div className="flex justify-center items-center gap-6 text-xs text-gray-500">
              <div className="flex items-center gap-2">
                <Check className="w-4 h-4 text-green-600" />
                <span>Secure Payments</span>
              </div>
              <div className="flex items-center gap-2">
                <Check className="w-4 h-4 text-green-600" />
                <span>Instant Access</span>
              </div>
              <div className="flex items-center gap-2">
                <Check className="w-4 h-4 text-green-600" />
                <span>Money Back Guarantee</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Payment Modal */}
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