'use client';

import { useRouter } from 'next/navigation';
import { Ban, ArrowLeft, ShoppingCart, MessageCircle } from 'lucide-react';

export default function PaymentCancelledPage() {
  const router = useRouter();

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
      <div className="max-w-md w-full bg-white rounded-2xl shadow-xl p-8 text-center border-t-8 border-yellow-500">
        <div className="flex justify-center mb-6">
          <div className="bg-yellow-50 p-4 rounded-full">
            <Ban className="w-16 h-16 text-yellow-600" />
          </div>
        </div>
        
        <h1 className="text-3xl font-bold text-gray-900 mb-4">
          Payment Cancelled
        </h1>
        
        <p className="text-gray-600 mb-8">
          You have successfully cancelled the transaction. No funds have been deducted from your account.
        </p>

        <div className="bg-blue-50 border border-blue-100 rounded-xl p-4 mb-8">
          <p className="text-sm text-blue-800 italic">
            💡 <strong>Pro Tip:</strong> Most parents start with the <strong>Basic Plan</strong> to see the first AI report for Grade 7 pathways!
          </p>
        </div>

        <div className="space-y-3">
          <button
            onClick={() => router.push('/pricing')}
            className="w-full py-4 bg-gray-900 text-white font-bold rounded-xl hover:bg-black transition-all flex items-center justify-center gap-2"
          >
            <ShoppingCart className="w-5 h-5" />
            View Pricing Plans
          </button>
          
          <button
            onClick={() => router.push('/dashboard')}
            className="w-full py-3 border-2 border-gray-200 text-gray-600 font-semibold rounded-xl hover:bg-gray-50 flex items-center justify-center gap-2"
          >
            <ArrowLeft className="w-5 h-5" />
            Back to Dashboard
          </button>
        </div>

        <button 
          className="mt-8 flex items-center justify-center gap-2 text-green-600 text-sm font-medium mx-auto hover:underline"
          onClick={() => window.open('https://wa.me/2547XXXXXXXX', '_blank')}
        >
          <MessageCircle className="w-4 h-4" />
          Talk to us on WhatsApp
        </button>
      </div>
    </div>
  );
}