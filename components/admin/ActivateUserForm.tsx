'use client';

import { useState } from 'react';
import { CheckCircle, UserCheck, AlertTriangle } from 'lucide-react';

type Plan = 'starter' | 'term' | 'family';

type ActivateResult = {
  message: string;
  email: string;
  plan: Plan;
  expiresAt: string | null;
};

export default function ActivateUserForm() {
  const [email, setEmail] = useState('');
  const [plan, setPlan] = useState<Plan>('term');
  const [leadId, setLeadId] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [result, setResult] = useState<ActivateResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!confirm(`Activate "${plan}" plan for ${email}? This grants access without a Paystack payment.`)) {
      return;
    }

    setIsSubmitting(true);
    setError(null);
    setResult(null);

    try {
      const response = await fetch('/api/admin/activate-user', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email,
          plan,
          leadId: leadId.trim() || undefined,
        }),
      });

      const data = await response.json();

      if (!response.ok || !data.success) {
        throw new Error(data.error ?? `Failed: ${response.status}`);
      }

      setResult(data.data);
      setEmail('');
      setLeadId('');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Activation failed');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="max-w-2xl mx-auto p-6 space-y-6">

      <div className="flex items-center gap-3 mb-2">
        <UserCheck className="w-6 h-6 text-blue-600" />
        <h2 className="text-2xl font-bold text-gray-900">Manual Activation</h2>
      </div>
      <p className="text-gray-600 text-sm">
        Grants a plan directly, bypassing Paystack. Use this after confirming payment
        was received another way (M-Pesa till, bank transfer, cash) — for example while
        the Paystack merchant account is still under review.
      </p>

      <form onSubmit={handleSubmit} className="bg-white rounded-xl border-2 border-gray-200 p-6 space-y-4">
        <div>
          <label htmlFor="email" className="block text-sm font-semibold text-gray-900 mb-1">
            User email
          </label>
          <input
            id="email"
            type="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="teacher@school.ac.ke"
            className="w-full px-3 py-2 border-2 border-gray-300 rounded-lg focus:outline-none focus:border-blue-500"
          />
        </div>

        <div>
          <label htmlFor="plan" className="block text-sm font-semibold text-gray-900 mb-1">
            Plan
          </label>
          <select
            id="plan"
            value={plan}
            onChange={(e) => setPlan(e.target.value as Plan)}
            className="w-full px-3 py-2 border-2 border-gray-300 rounded-lg focus:outline-none focus:border-blue-500"
          >
            <option value="starter">Starter — token pack (10 tokens)</option>
            <option value="term">Term Plan — 1 child, 120 days</option>
            <option value="family">Family Plan — 3 children, 120 days</option>
          </select>
        </div>

        <div>
          <label htmlFor="leadId" className="block text-sm font-semibold text-gray-900 mb-1">
            Lead ID <span className="font-normal text-gray-500">(optional)</span>
          </label>
          <input
            id="leadId"
            type="text"
            value={leadId}
            onChange={(e) => setLeadId(e.target.value)}
            placeholder="early_access_leads.id, if this came from a lead"
            className="w-full px-3 py-2 border-2 border-gray-300 rounded-lg focus:outline-none focus:border-blue-500"
          />
        </div>

        <button
          type="submit"
          disabled={isSubmitting || !email}
          className="w-full flex items-center justify-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 font-semibold"
        >
          <UserCheck className="w-4 h-4" />
          {isSubmitting ? 'Activating...' : 'Activate User'}
        </button>
      </form>

      {result && (
        <div className="bg-green-50 border-2 border-green-200 rounded-xl p-4 flex items-start gap-3">
          <CheckCircle className="w-5 h-5 text-green-600 flex-shrink-0 mt-0.5" />
          <div className="text-green-800 text-sm">
            <p className="font-semibold">Activated {result.email} on the {result.plan} plan.</p>
            {result.expiresAt && (
              <p>Subscription expires {new Date(result.expiresAt).toLocaleDateString()}.</p>
            )}
          </div>
        </div>
      )}

      {error && (
        <div className="bg-red-50 border-2 border-red-200 rounded-xl p-4 flex items-start gap-3">
          <AlertTriangle className="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5" />
          <p className="text-red-800 text-sm font-semibold">{error}</p>
        </div>
      )}

    </div>
  );
}
