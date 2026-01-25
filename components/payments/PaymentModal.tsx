// components/payments/PaymentModal.tsx
'use client';

import { useState } from 'react';
import { X, CreditCard, Smartphone, Loader2, CheckCircle, XCircle } from 'lucide-react';
import {
  PlanType,
  TokenBundleType,
  PaymentMethod,
  getPlanDetails,
  getTokenBundleDetails,
  formatCurrency,
  formatPhoneNumber,
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

  // Get details based on type
  const isBundle = !!bundleType;
  const details = isBundle 
    ? getTokenBundleDetails(bundleType!)
    : getPlanDetails(planType!);

  const productName = isBundle 
    ? `${details.tokens} Tokens` 
    : details.name;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setIsProcessing(true);

    try {
      if (paymentMethod === 'mpesa_stk') {
        if (!phoneNumber) {
          setError('Please enter your phone number');
          setIsProcessing(false);
          return;
        }

        const formatted = formatPhoneNumber(phoneNumber);
        if (formatted.length !== 12) {
          setError('Please enter a valid Kenyan phone number (e.g., 0712345678)');
          setIsProcessing(false);
          return;
        }
      }

      const response = await fetch('/api/payments/initialize', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          planType: isBundle ? 'token_bundle' : planType,
          bundleType: bundleType,
          paymentMethod,
          phoneNumber: phoneNumber || undefined,
          email: userEmail,
        }),
      });

      const data = await response.json();

      if (!data.success) {
        throw new Error(data.error || 'Payment initialization failed');
      }

      if (data.paymentLink) {
        window.location.href = data.paymentLink;
      } else {
        setSuccess(true);
        setTimeout(() => {
          onSuccess?.();
          onClose();
        }, 2000);
      }
    } catch (err: any) {
      setError(err.message || 'Failed to initiate payment');
      setIsProcessing(false);
    }
  };

  if (success) {
    return (
      <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
        <div className="bg-white rounded-2xl max-w-md w-full p-8 text-center">
          <div className="flex justify-center mb-4">
            <CheckCircle className="w-16 h-16 text-green-600" />
          </div>
          <h3 className="text-2xl font-bold text-gray-900 mb-2">
            Payment Successful! 🎉
          </h3>
          <p className="text-gray-600">
            Your {productName} has been activated!
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl max-w-md w-full max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between p-6 border-b">
          <div>
            <h3 className="text-xl font-bold text-gray-900">
              Complete Payment
            </h3>
            <p className="text-sm text-gray-600 mt-1">
              {productName} - {formatCurrency(details.price)}
            </p>
          </div>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 transition-colors"
            disabled={isProcessing}
          >
            <X className="w-6 h-6" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-6">
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-3">
              Payment Method
            </label>
            <div className="space-y-3">
              <button
                type="button"
                onClick={() => setPaymentMethod('mpesa_stk')}
                className={`w-full flex items-center gap-3 p-4 border-2 rounded-lg transition-all ${
                  paymentMethod === 'mpesa_stk'
                    ? 'border-green-600 bg-green-50'
                    : 'border-gray-200 hover:border-gray-300'
                }`}
              >
                <Smartphone className="w-6 h-6 text-green-600" />
                <div className="text-left flex-1">
                  <div className="font-semibold text-gray-900">M-Pesa</div>
                  <div className="text-xs text-gray-600">Pay with M-Pesa</div>
                </div>
                {paymentMethod === 'mpesa_stk' && (
                  <CheckCircle className="w-5 h-5 text-green-600" />
                )}
              </button>

              <button
                type="button"
                onClick={() => setPaymentMethod('card')}
                className={`w-full flex items-center gap-3 p-4 border-2 rounded-lg transition-all ${
                  paymentMethod === 'card'
                    ? 'border-blue-600 bg-blue-50'
                    : 'border-gray-200 hover:border-gray-300'
                }`}
              >
                <CreditCard className="w-6 h-6 text-blue-600" />
                <div className="text-left flex-1">
                  <div className="font-semibold text-gray-900">Card / Other</div>
                  <div className="text-xs text-gray-600">Visa, Mastercard, Bank</div>
                </div>
                {paymentMethod === 'card' && (
                  <CheckCircle className="w-5 h-5 text-blue-600" />
                )}
              </button>
            </div>
          </div>

          {paymentMethod === 'mpesa_stk' && (
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-2">
                M-Pesa Phone Number
              </label>
              <input
                type="tel"
                value={phoneNumber}
                onChange={(e) => setPhoneNumber(e.target.value)}
                placeholder="0712345678"
                className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent"
                required
                disabled={isProcessing}
              />
              <p className="text-xs text-gray-600 mt-1">
                Enter your M-Pesa number
              </p>
            </div>
          )}

          {error && (
            <div className="flex items-start gap-2 p-4 bg-red-50 border border-red-200 rounded-lg">
              <XCircle className="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5" />
              <p className="text-sm text-red-800">{error}</p>
            </div>
          )}

          {isProcessing && !error && (
            <div className="flex items-start gap-3 p-4 bg-blue-50 border border-blue-200 rounded-lg">
              <Loader2 className="w-5 h-5 text-blue-600 animate-spin flex-shrink-0 mt-0.5" />
              <div className="text-sm text-blue-800">
                <p className="font-semibold mb-1">Processing payment...</p>
                <p>Please wait</p>
              </div>
            </div>
          )}

          <button
            type="submit"
            disabled={isProcessing}
            className="w-full py-4 bg-gradient-to-r from-green-600 to-blue-600 text-white font-semibold rounded-lg hover:from-green-700 hover:to-blue-700 transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
          >
            {isProcessing ? (
              <>
                <Loader2 className="w-5 h-5 animate-spin" />
                Processing...
              </>
            ) : (
              <>Pay {formatCurrency(details.price)}</>
            )}
          </button>

          <p className="text-xs text-center text-gray-600">
            🔒 Secure payment powered by Paystack
          </p>
        </form>
      </div>
    </div>
  );
}