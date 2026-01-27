'use client';

import { useEffect, useState, Suspense } from 'react'; // Ongeza Suspense
import { useSearchParams, useRouter } from 'next/navigation';
import { CheckCircle, ArrowRight } from 'lucide-react';

// Tenganisha logic ya content
function SuccessContent() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const [verifying, setVerifying] = useState(true);

  useEffect(() => {
    // ... ile kodi yako ya fetch hapa ...
    const transactionId = searchParams.get('transactionId') || searchParams.get('reference'); // Paystack hutumia 'reference'
    
    if (transactionId) {
      fetch('/api/payments/verify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ transactionId }),
      })
      .then(res => res.json())
      .then(() => setVerifying(false))
      .catch(() => setVerifying(false));
    } else {
       setVerifying(false);
    }
  }, [searchParams]);

  if (verifying) {
    return (
      <div className="text-center">
        <div className="animate-spin rounded-full h-16 w-16 border-b-4 border-green-600 mx-auto mb-4"></div>
        <p className="text-lg text-gray-600 font-medium">Inathibitisha malipo yako...</p>
      </div>
    );
  }

  return (
    <div className="max-w-md w-full bg-white rounded-2xl shadow-xl p-8 text-center">
        <div className="flex justify-center mb-6">
          <CheckCircle className="w-20 h-20 text-green-600" />
        </div>
        <h1 className="text-3xl font-bold text-gray-900 mb-4 font-heading">
          Malipo Yamefanikiwa! 🎉
        </h1>
        <p className="text-gray-600 mb-8">
          Usajili wako umekamilika. Sasa unaweza kuanza kupata ripoti za AI kwa mwanao.
        </p>
        <button
          onClick={() => router.push('/dashboard')}
          className="w-full py-4 bg-gradient-to-r from-green-600 to-blue-600 text-white font-bold rounded-lg hover:from-green-700 hover:to-blue-700 flex items-center justify-center gap-2 transition-all shadow-lg shadow-green-200"
        >
          Nenda Kwenye Dashboard
          <ArrowRight className="w-5 h-5" />
        </button>
    </div>
  );
}

// Wrapper Page inayotumia Suspense
export default function PaymentSuccessPage() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-green-50 to-blue-50 flex items-center justify-center p-4">
      <Suspense fallback={<p>Loading...</p>}>
        <SuccessContent />
      </Suspense>
    </div>
  );
}