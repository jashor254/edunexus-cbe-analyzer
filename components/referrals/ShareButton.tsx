// components/referrals/ShareButton.tsx
'use client';

import { useState } from 'react';
import { Share2, Copy, Check } from 'lucide-react';

interface ShareButtonProps {
  referralCode: string;
  className?: string;
}

export default function ShareButton({ referralCode, className = '' }: ShareButtonProps) {
  const [copied, setCopied] = useState(false);

  const getReferralLink = () => {
    const baseUrl = process.env.NEXT_PUBLIC_APP_URL || window.location.origin;
    return `${baseUrl}/signup?ref=${referralCode}`;
  };

  const handleShare = async () => {
    const link = getReferralLink();
    const text = `Join CBC Pathway Analyzer and get 1 FREE AI scheme analysis! Use my code: ${referralCode}`;

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
      const whatsappUrl = `https://wa.me/?text=${encodeURIComponent(text + '\n\n' + link)}`;
      window.open(whatsappUrl, '_blank');
    }
  };

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(getReferralLink());
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.error('Copy failed:', err);
    }
  };

  return (
    <div className={`flex gap-2 ${className}`}>
      <button
        onClick={handleShare}
        className="flex-1 flex items-center justify-center gap-2 px-4 py-2 bg-green-600 hover:bg-green-700 text-white rounded-lg transition-colors"
      >
        <Share2 className="w-4 h-4" />
        Share
      </button>
      <button
        onClick={handleCopy}
        className="flex items-center justify-center gap-2 px-4 py-2 border-2 border-blue-600 text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
      >
        {copied ? (
          <>
            <Check className="w-4 h-4" />
            Copied!
          </>
        ) : (
          <>
            <Copy className="w-4 h-4" />
            Copy
          </>
        )}
      </button>
    </div>
  );
}