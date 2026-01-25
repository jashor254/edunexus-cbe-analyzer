// components/referrals/ReferralDashboard.tsx
'use client';

import { useState } from 'react';
import { 
  Gift, 
  Users, 
  Copy, 
  Check, 
  Share2, 
  TrendingUp,
  Award,
  Clock
} from 'lucide-react';
import { useReferrals } from '@/hooks/useReferrals';

interface ReferralDashboardProps {
  userId: string;
}

export default function ReferralDashboard({ userId }: ReferralDashboardProps) {
  const { stats, isLoading, getReferralLink, copyReferralLink } = useReferrals(userId);
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    const success = await copyReferralLink();
    if (success) {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const handleShare = async () => {
    const link = getReferralLink();
    const text = `Join CBC Pathway Analyzer and get 1 FREE AI scheme analysis! Use my referral code: ${stats?.referralCode}`;

    if (navigator.share) {
      try {
        await navigator.share({
          title: 'CBC Pathway Analyzer',
          text: text,
          url: link,
        });
      } catch (err) {
        console.error('Share failed:', err);
      }
    } else {
      // Fallback to WhatsApp
      const whatsappUrl = `https://wa.me/?text=${encodeURIComponent(text + '\n' + link)}`;
      window.open(whatsappUrl, '_blank');
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center p-12">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  if (!stats) {
    return (
      <div className="text-center p-12">
        <p className="text-gray-600">Unable to load referral stats</p>
      </div>
    );
  }

  return (
    <div className="max-w-6xl mx-auto p-6 space-y-6">
      {/* Header */}
      <div className="text-center mb-8">
        <div className="inline-flex items-center justify-center w-16 h-16 bg-gradient-to-br from-blue-500 to-purple-600 rounded-full mb-4">
          <Gift className="w-8 h-8 text-white" />
        </div>
        <h2 className="text-3xl font-bold text-gray-900 mb-2">
          Refer & Earn Free Analyses
        </h2>
        <p className="text-gray-600">
          Share your link and earn 2 free analyses for each friend who joins!
        </p>
      </div>

      {/* Stats Cards */}
      <div className="grid md:grid-cols-3 gap-6">
        {/* Total Referrals */}
        <div className="bg-white rounded-xl border-2 border-gray-200 p-6 hover:shadow-lg transition-shadow">
          <div className="flex items-center justify-between mb-4">
            <div className="p-3 bg-blue-100 rounded-lg">
              <Users className="w-6 h-6 text-blue-600" />
            </div>
            <span className="text-3xl font-bold text-blue-600">
              {stats.totalReferrals}
            </span>
          </div>
          <h3 className="text-gray-900 font-semibold">Total Referrals</h3>
          <p className="text-sm text-gray-600">Friends who joined</p>
        </div>

        {/* Tokens Earned */}
        <div className="bg-white rounded-xl border-2 border-gray-200 p-6 hover:shadow-lg transition-shadow">
          <div className="flex items-center justify-between mb-4">
            <div className="p-3 bg-green-100 rounded-lg">
              <Award className="w-6 h-6 text-green-600" />
            </div>
            <span className="text-3xl font-bold text-green-600">
              {stats.tokensEarned}
            </span>
          </div>
          <h3 className="text-gray-900 font-semibold">Tokens Earned</h3>
          <p className="text-sm text-gray-600">Free analyses unlocked</p>
        </div>

        {/* Pending */}
        <div className="bg-white rounded-xl border-2 border-gray-200 p-6 hover:shadow-lg transition-shadow">
          <div className="flex items-center justify-between mb-4">
            <div className="p-3 bg-orange-100 rounded-lg">
              <Clock className="w-6 h-6 text-orange-600" />
            </div>
            <span className="text-3xl font-bold text-orange-600">
              {stats.pendingReferrals}
            </span>
          </div>
          <h3 className="text-gray-900 font-semibold">Pending</h3>
          <p className="text-sm text-gray-600">Awaiting signup</p>
        </div>
      </div>

      {/* Referral Link Section */}
      <div className="bg-gradient-to-br from-blue-50 to-purple-50 rounded-2xl border-2 border-blue-200 p-8">
        <div className="flex items-center gap-3 mb-6">
          <TrendingUp className="w-6 h-6 text-blue-600" />
          <h3 className="text-xl font-bold text-gray-900">Your Referral Link</h3>
        </div>

        <div className="bg-white rounded-lg border-2 border-gray-300 p-4 mb-4">
          <div className="flex items-center justify-between gap-4">
            <div className="flex-1 min-w-0">
              <p className="text-sm text-gray-600 mb-1">Your unique code:</p>
              <p className="text-2xl font-mono font-bold text-blue-600 truncate">
                {stats.referralCode}
              </p>
            </div>
            <button
              onClick={handleCopy}
              className="flex-shrink-0 flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors"
            >
              {copied ? (
                <>
                  <Check className="w-4 h-4" />
                  Copied!
                </>
              ) : (
                <>
                  <Copy className="w-4 h-4" />
                  Copy Link
                </>
              )}
            </button>
          </div>
        </div>

        <div className="text-sm text-gray-700 bg-white/50 rounded-lg p-4 mb-4">
          <p className="font-semibold mb-2">📱 Full Link:</p>
          <code className="text-xs break-all text-blue-600">
            {getReferralLink()}
          </code>
        </div>

        <div className="flex gap-3">
          <button
            onClick={handleShare}
            className="flex-1 flex items-center justify-center gap-2 px-6 py-3 bg-green-600 hover:bg-green-700 text-white font-semibold rounded-lg transition-colors"
          >
            <Share2 className="w-5 h-5" />
            Share via WhatsApp
          </button>
          <button
            onClick={handleCopy}
            className="flex items-center justify-center gap-2 px-6 py-3 border-2 border-blue-600 text-blue-600 hover:bg-blue-50 font-semibold rounded-lg transition-colors"
          >
            <Copy className="w-5 h-5" />
            Copy Link
          </button>
        </div>
      </div>

      {/* How It Works */}
      <div className="bg-white rounded-xl border-2 border-gray-200 p-8">
        <h3 className="text-xl font-bold text-gray-900 mb-6 text-center">
          How It Works
        </h3>
        <div className="grid md:grid-cols-3 gap-6">
          <div className="text-center">
            <div className="w-12 h-12 bg-blue-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <span className="text-2xl font-bold text-blue-600">1</span>
            </div>
            <h4 className="font-semibold text-gray-900 mb-2">Share Your Link</h4>
            <p className="text-sm text-gray-600">
              Send your referral link to fellow teachers
            </p>
          </div>
          <div className="text-center">
            <div className="w-12 h-12 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <span className="text-2xl font-bold text-green-600">2</span>
            </div>
            <h4 className="font-semibold text-gray-900 mb-2">They Sign Up</h4>
            <p className="text-sm text-gray-600">
              Your friend gets 1 free analysis
            </p>
          </div>
          <div className="text-center">
            <div className="w-12 h-12 bg-purple-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <span className="text-2xl font-bold text-purple-600">3</span>
            </div>
            <h4 className="font-semibold text-gray-900 mb-2">You Get Rewarded</h4>
            <p className="text-sm text-gray-600">
              Earn 2 free analyses instantly!
            </p>
          </div>
        </div>
      </div>

      {/* Recent Referrals */}
      {stats.recentReferrals && stats.recentReferrals.length > 0 && (
        <div className="bg-white rounded-xl border-2 border-gray-200 p-6">
          <h3 className="text-lg font-bold text-gray-900 mb-4">
            Recent Referrals
          </h3>
          <div className="space-y-3">
            {stats.recentReferrals.map((referral, index) => (
              <div
                key={index}
                className="flex items-center justify-between p-4 bg-gray-50 rounded-lg"
              >
                <div>
                  <p className="font-semibold text-gray-900">
                    {referral.email}
                  </p>
                  <p className="text-sm text-gray-600">
                    {new Date(referral.created_at).toLocaleDateString()}
                  </p>
                </div>
                <div className="flex items-center gap-2 text-green-600 font-semibold">
                  <Award className="w-5 h-5" />
                  +{referral.tokens_earned} tokens
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}