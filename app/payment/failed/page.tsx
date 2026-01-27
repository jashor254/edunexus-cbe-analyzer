'use client';

import { Suspense } from 'react'; // Muhimu kwa Next.js 14/15
import { useSearchParams, useRouter } from 'next/navigation';
import { XCircle, ArrowLeft, RefreshCw, MessageSquare } from 'lucide-react';

function FailedContent() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const transactionId = searchParams.get('transactionId') || searchParams.get('reference');

  return (
    <div className="max-w-md w-full bg-white rounded-2xl shadow-xl p-8 text-center border-t-8 border-red-500">
      <div className="flex justify-center mb-6">
        <XCircle className="w-20 h-20 text-red-600 animate-pulse" />
      </div>
      
      <h1 className="text-3xl font-bold text-gray-900 mb-4">
        Payment Failed
      </h1>
      
      <p className="text-gray-600 mb-4 font-medium">
        Don't worry, your money is safe.
      </p>
      
      <div className="bg-red-50 rounded-xl p-4 text-left text-sm text-red-800 mb-8">
        <p className="font-bold mb-2">Common reasons for failure:</p>
        <ul className="space-y-1">
          <li>• Insufficient M-Pesa balance</li>
          <li>• Incorrect PIN or canceled prompt</li>
          <li>• Network timeout (Slow internet)</li>
          <li>• Bank/Provider downtime</li>
        </ul>
      </div>
      
      {transactionId && (
        <p className="text-[10px] uppercase tracking-widest text-gray-400 mb-6 bg-gray-50 py-1 rounded">
          Ref ID: {transactionId}
        </p>
      )}

      <div className="space-y-3">
        <button
          onClick={() => router.push('/pricing')}
          className="w-full py-4 bg-red-600 text-white font-bold rounded-xl hover:bg-red-700 transition-all flex items-center justify-center gap-2 shadow-lg shadow-red-200"
        >
          <RefreshCw className="w-5 h-5" />
          Try Again
        </button>
        
        <button
          onClick={() => router.push('/dashboard')}
          className="w-full py-3 border-2 border-gray-200 text-gray-600 font-semibold rounded-xl hover:bg-gray-50 flex items-center justify-center gap-2"
        >
          <ArrowLeft className="w-5 h-5" />
          Back to Dashboard
        </button>
      </div>

      <div className="mt-8 pt-6 border-t border-gray-100 flex items-center justify-center gap-2 text-blue-600 font-medium cursor-pointer">
        <MessageSquare className="w-4 h-4" />
        <span className="text-sm">Chat with Support via WhatsApp</span>
      </div>
    </div>
  );
}

export default function PaymentFailedPage() {
  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
      <Suspense fallback={<div className="animate-spin h-8 w-8 border-4 border-blue-500 border-t-transparent rounded-full" />}>
        <FailedContent />
      </Suspense>
    </div>
  );
}