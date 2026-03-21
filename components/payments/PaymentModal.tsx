// components/PaymentModal.tsx
'use client';

import { useState, useEffect } from 'react';
import { 
  X, 
  Smartphone, 
  CreditCard, 
  Loader2, 
  CheckCircle, 
  AlertCircle,
  Zap,
  Sparkles,
  Package,
  Crown
} from 'lucide-react';
import {
  PlanType,
  TokenBundleType,
  PaymentMethod,
  getPlanDetails,
  getTokenBundleDetails,
  formatCurrency,
  formatPhoneNumber,
  PAYMENT_PLANS,
  TOKEN_BUNDLES
} from '@/lib/payments/config';

interface PaymentModalProps {
  planType?: PlanType | null;
  bundleType?: TokenBundleType | null;
  userEmail: string;
  onClose: () => void;
  onSuccess?: () => void;
}

export default function PaymentModal({
  planType,
  bundleType,
  userEmail,
  onClose,
  onSuccess,
}: PaymentModalProps) {
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>('mpesa_stk');
  const [phoneNumber, setPhoneNumber] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);
  const [step, setStep] = useState<'form' | 'processing' | 'success'>('form');

  const isBundle = !!bundleType;
  
  // ✅ FIXED: Proper type guarding
  const plan = !isBundle && planType ? PAYMENT_PLANS[planType] : null;
  const bundle = isBundle && bundleType ? TOKEN_BUNDLES[bundleType] : null;

  // Safety check
  if (!plan && !bundle) {
    return (
      <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-[1000] p-4 backdrop-blur-sm">
        <div className="bg-white rounded-[2rem] max-w-md w-full p-8 text-center">
          <AlertCircle className="w-16 h-16 text-red-500 mx-auto mb-4" />
          <h3 className="text-xl font-black mb-2">Invalid Selection</h3>
          <p className="text-gray-500 mb-6">No product selected for payment.</p>
          <button onClick={onClose} className="px-6 py-3 bg-gray-900 text-white rounded-xl font-bold">
            Close
          </button>
        </div>
      </div>
    );
  }

  // ✅ FIXED: Safe property access with type guards
  const productName = isBundle 
    ? bundle!.name 
    : plan!.name;
  
  const productIcon = isBundle 
    ? <Package className="w-5 h-5" /> 
    : <Crown className="w-5 h-5" />;
  
  const price = isBundle ? bundle!.price : plan!.price;
  
  // Bundle-specific details
  const tokenCount = isBundle ? bundle!.tokens : null;
  
  // Plan-specific details
  const period = !isBundle ? plan!.period : null;
  const features = isBundle ? bundle!.features : plan!.features;

  // Auto-detect best payment method
  useEffect(() => {
    // Check if user is in Kenya (you can detect from email or IP)
    const isKenyan = userEmail?.endsWith('.ke') || userEmail?.includes('kenya');
    setPaymentMethod(isKenyan ? 'mpesa_stk' : 'card');
  }, [userEmail]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setIsProcessing(true);
    setStep('processing');

    try {
      // For M-PESA, we need phone number
      if (paymentMethod === 'mpesa_stk' && !phoneNumber) {
        throw new Error('Tafadhali weka nambari ya simu');
      }

      const response = await fetch('/api/payments/initialize', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          type: isBundle ? 'bundle' : 'subscription',
          productId: isBundle ? bundleType : planType,
          email: userEmail,
          paymentMethod,
          phoneNumber: paymentMethod === 'mpesa_stk' ? formatPhoneNumber(phoneNumber) : undefined,
          amount: price,
          metadata: {
            productName,
            userEmail,
            ...(isBundle ? { tokens: tokenCount } : { period })
          }
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Payment failed');
      }

      // Handle different payment methods
      if (paymentMethod === 'mpesa_stk') {
        // STK Push sent - wait for confirmation
        setStep('processing');
        
        // Poll for payment status
        const checkPayment = setInterval(async () => {
          const statusRes = await fetch(`/api/payments/status?reference=${data.reference}`);
          const statusData = await statusRes.json();
          
          if (statusData.status === 'completed') {
            clearInterval(checkPayment);
            setStep('success');
            setSuccess(true);
            
            // Give user time to see success, then close
            setTimeout(() => {
              onSuccess?.();
              onClose();
            }, 2000);
          } else if (statusData.status === 'failed') {
            clearInterval(checkPayment);
            setError('Malipo yameshindwa. Tafadhali jaribu tena.');
            setStep('form');
          }
        }, 3000);

        // Stop polling after 2 minutes
        setTimeout(() => clearInterval(checkPayment), 120000);
      } 
      else if (paymentMethod === 'card' && data.authorization_url) {
        // Redirect to payment gateway
        window.location.href = data.authorization_url;
      }
      else {
        // Assume success for other methods
        setStep('success');
        setSuccess(true);
        setTimeout(() => {
          onSuccess?.();
          onClose();
        }, 1500);
      }

    } catch (err: any) {
      setError(err.message || 'Payment failed');
      setStep('form');
      setIsProcessing(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-[1000] p-4 backdrop-blur-sm">
      <div className="bg-white rounded-[2rem] max-w-md w-full shadow-2xl relative overflow-hidden">
        
        {/* Header with gradient */}
        <div className="bg-gradient-to-r from-blue-600 to-indigo-600 p-6 text-white">
          <button 
            onClick={onClose} 
            className="absolute top-4 right-4 text-white/80 hover:text-white transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
          <h3 className="text-2xl font-black mb-1">Complete Payment</h3>
          <p className="text-blue-100 text-sm flex items-center gap-1">
            {productIcon}
            {productName}
            {isBundle && tokenCount && (
              <span className="ml-2 bg-white/20 px-2 py-0.5 rounded-full text-xs">
                {tokenCount} tokens
              </span>
            )}
          </p>
        </div>

        {step === 'form' && (
          <form onSubmit={handleSubmit} className="p-6 space-y-6">
            
            {/* Price Display with Product Summary */}
            <div className="bg-gray-50 p-4 rounded-xl">
              <div className="flex items-center justify-between mb-2">
                <span className="text-gray-600 font-bold">Product:</span>
                <span className="font-black text-gray-900">{productName}</span>
              </div>
              
              {isBundle && tokenCount && (
                <div className="flex items-center justify-between mb-2 text-sm">
                  <span className="text-gray-500">Tokens:</span>
                  <span className="font-bold text-blue-600">{tokenCount} analyses</span>
                </div>
              )}
              
              {!isBundle && period && (
                <div className="flex items-center justify-between mb-2 text-sm">
                  <span className="text-gray-500">Billing period:</span>
                  <span className="font-bold text-purple-600">per {period}</span>
                </div>
              )}
              
              <div className="flex items-center justify-between pt-2 border-t border-gray-200 mt-2">
                <span className="text-gray-600 font-bold">Total Amount:</span>
                <span className="text-3xl font-black text-gray-900">{formatCurrency(price)}</span>
              </div>
            </div>

            {/* Payment Method Selection */}
            <div className="space-y-3">
              <label className="block text-sm font-bold text-gray-700 mb-2">
                Chagua Njia ya Malipo
              </label>
              
              <button
                type="button"
                onClick={() => setPaymentMethod('mpesa_stk')}
                className={`w-full p-4 rounded-xl border-2 flex items-center gap-4 transition-all ${
                  paymentMethod === 'mpesa_stk'
                    ? 'border-green-500 bg-green-50'
                    : 'border-gray-200 hover:border-gray-300'
                }`}
              >
                <div className={`p-2 rounded-lg ${
                  paymentMethod === 'mpesa_stk' ? 'bg-green-500' : 'bg-gray-100'
                }`}>
                  <Smartphone className={`w-5 h-5 ${
                    paymentMethod === 'mpesa_stk' ? 'text-white' : 'text-gray-500'
                  }`} />
                </div>
                <div className="flex-1 text-left">
                  <div className="font-bold">M-PESA (STK Push)</div>
                  <div className="text-xs text-gray-500">Pata STK Push kwenye simu yako</div>
                </div>
                {paymentMethod === 'mpesa_stk' && (
                  <CheckCircle className="w-5 h-5 text-green-500" />
                )}
              </button>

              <button
                type="button"
                onClick={() => setPaymentMethod('card')}
                className={`w-full p-4 rounded-xl border-2 flex items-center gap-4 transition-all ${
                  paymentMethod === 'card'
                    ? 'border-blue-500 bg-blue-50'
                    : 'border-gray-200 hover:border-gray-300'
                }`}
              >
                <div className={`p-2 rounded-lg ${
                  paymentMethod === 'card' ? 'bg-blue-500' : 'bg-gray-100'
                }`}>
                  <CreditCard className={`w-5 h-5 ${
                    paymentMethod === 'card' ? 'text-white' : 'text-gray-500'
                  }`} />
                </div>
                <div className="flex-1 text-left">
                  <div className="font-bold">Card / Visa / Mastercard</div>
                  <div className="text-xs text-gray-500">Lipa kwa kadi ya benki</div>
                </div>
                {paymentMethod === 'card' && (
                  <CheckCircle className="w-5 h-5 text-blue-500" />
                )}
              </button>
            </div>

            {/* M-PESA Phone Number */}
            {paymentMethod === 'mpesa_stk' && (
              <div className="space-y-2">
                <label className="block text-sm font-bold text-gray-700">
                  Nambari ya M-PESA
                </label>
                <input
                  type="tel"
                  value={phoneNumber}
                  onChange={(e) => setPhoneNumber(e.target.value)}
                  placeholder="e.g., 0712345678"
                  className="w-full p-4 border-2 border-gray-200 rounded-xl font-medium focus:border-green-500 focus:outline-none"
                  required
                />
                <p className="text-xs text-gray-500">
                  Utapewa STK Push kwenye nambari hii. Ingiza PIN yako kukamilisha.
                </p>
              </div>
            )}

            {/* Error Message */}
            {error && (
              <div className="bg-red-50 border-2 border-red-200 rounded-xl p-4 flex items-start gap-3">
                <AlertCircle className="w-5 h-5 text-red-500 flex-shrink-0 mt-0.5" />
                <span className="text-sm text-red-700">{error}</span>
              </div>
            )}

            {/* Submit Button */}
            <button
              type="submit"
              disabled={isProcessing || (paymentMethod === 'mpesa_stk' && !phoneNumber)}
              className="w-full py-5 bg-gradient-to-r from-blue-600 to-indigo-600 text-white rounded-xl font-black text-lg hover:scale-[1.02] active:scale-95 transition-all disabled:opacity-50 disabled:cursor-not-allowed shadow-xl flex items-center justify-center gap-2"
            >
              {isProcessing ? (
                <>
                  <Loader2 className="w-5 h-5 animate-spin" />
                  Inachakata...
                </>
              ) : (
                <>
                  <Zap className="w-5 h-5" />
                  Lipa {formatCurrency(price)} Sasa
                </>
              )}
            </button>

            {/* Features Preview */}
            <div className="border-t border-gray-100 pt-4">
              <p className="text-xs font-bold text-gray-400 mb-2">UTAPATA:</p>
              <ul className="space-y-1">
                {features.slice(0, 3).map((feature, idx) => (
                  <li key={idx} className="text-xs text-gray-600 flex items-start gap-1">
                    <CheckCircle className="w-3 h-3 text-green-500 flex-shrink-0 mt-0.5" />
                    <span>{feature}</span>
                  </li>
                ))}
                {features.length > 3 && (
                  <li className="text-xs text-gray-400">+ {features.length - 3} zaidi...</li>
                )}
              </ul>
            </div>

            {/* Secure Payment Note */}
            <p className="text-xs text-center text-gray-400">
              🔒 Malipo yako yanalindwa kwa SSL encryption
            </p>
          </form>
        )}

        {/* Processing State */}
        {step === 'processing' && (
          <div className="p-12 text-center">
            <Loader2 className="w-16 h-16 animate-spin text-blue-600 mx-auto mb-6" />
            <h4 className="text-xl font-black mb-2">Inachakata Malipo</h4>
            <p className="text-gray-500 mb-6">
              {paymentMethod === 'mpesa_stk' 
                ? 'Tafadhali angalia simu yako na ingiza PIN ya M-PESA' 
                : 'Tafadhali subiri...'}
            </p>
            <div className="bg-blue-50 p-4 rounded-xl">
              <p className="text-sm text-blue-700">
                Usifunge ukurasa huu. Tunasubiri uthibitisho wa malipo...
              </p>
            </div>
          </div>
        )}

        {/* Success State */}
        {step === 'success' && (
          <div className="p-12 text-center">
            <div className="w-20 h-20 bg-green-500 rounded-full flex items-center justify-center mx-auto mb-6 animate-bounce">
              <CheckCircle className="w-12 h-12 text-white" />
            </div>
            <h4 className="text-xl font-black mb-2 text-green-700">Malipo Yamekamilika!</h4>
            <p className="text-gray-500 mb-4">
              {isBundle && tokenCount
                ? `${tokenCount} tokens zimeongezwa kwenye akaunti yako` 
                : 'Subscription yako imeanzishwa'}
            </p>
            <div className="bg-green-50 p-4 rounded-xl">
              <p className="text-sm text-green-700">
                Utaelekezwa kwenye dashibodi...
              </p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}