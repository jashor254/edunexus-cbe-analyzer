// ============================================
// PAYMENT INITIALIZATION - UPDATED
// Replace: app/api/payments/initialize/route.ts
// ============================================

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { paystackClient } from '@/lib/payments/paystack';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

interface InitiatePaymentRequest {
  planType: 'free' | 'termly' | 'lifetime' | 'tokens_5' | 'tokens_15' | 'tokens_30';
  paymentMethod: 'mpesa_stk' | 'card' | 'mpesa_paybill';
  phoneNumber?: string;
  email: string;
  termYear?: number;
  termNumber?: number;
}

const PAYMENT_PLANS = {
  free: { name: 'Free Plan', price: 0, tokens: 3 },
  termly: { name: 'Termly Plan (3 Months)', price: 300, tokens: 50 },
  lifetime: { name: 'Lifetime Access', price: 1500, tokens: 999999 },
  tokens_5: { name: '5 Tokens Starter', price: 200, tokens: 5 },
  tokens_15: { name: '15 Tokens Basic', price: 500, tokens: 15 },
  tokens_30: { name: '30 Tokens Premium', price: 800, tokens: 30 },
};

function formatPhoneNumber(phone: string): string {
  let cleaned = phone.replace(/\s+/g, '').replace(/[^0-9+]/g, '');
  if (cleaned.startsWith('+')) cleaned = cleaned.substring(1);
  if (cleaned.startsWith('0')) cleaned = '254' + cleaned.substring(1);
  if (!cleaned.startsWith('254')) cleaned = '254' + cleaned;
  return cleaned;
}

function getCurrentTerm(): number {
  const month = new Date().getMonth() + 1;
  if (month >= 1 && month <= 4) return 1;
  if (month >= 5 && month <= 8) return 2;
  return 3;
}

export async function POST(request: NextRequest) {
  try {
    const body: InitiatePaymentRequest = await request.json();
    const { planType, paymentMethod, phoneNumber, email, termYear, termNumber } = body;

    if (!planType || !paymentMethod || !email) {
      return NextResponse.json(
        { success: false, error: 'Missing required fields' },
        { status: 400 }
      );
    }

    const plan = PAYMENT_PLANS[planType];
    if (!plan) {
      return NextResponse.json(
        { success: false, error: 'Invalid plan' },
        { status: 400 }
      );
    }

    if (planType === 'free') {
      return NextResponse.json(
        { success: false, error: 'Free plan does not require payment' },
        { status: 400 }
      );
    }

    // Get user (use email as fallback for guests)
    const { data: { user } } = await supabase.auth.getUser();
    const userId = user?.id || email;

    const reference = paystackClient.generateReference();

    // Create payment record
    const { data: paymentRecord, error: paymentError } = await supabase
      .from('payments')
      .insert({
        user_id: userId,
        transaction_id: reference,
        amount: plan.price,
        currency: 'KES',
        payment_method: paymentMethod,
        status: 'pending',
        plan_type: planType,
        metadata: {
          plan_name: plan.name,
          tokens: plan.tokens,
          phone_number: phoneNumber ? formatPhoneNumber(phoneNumber) : null,
          term_year: termYear || new Date().getFullYear(),
          term_number: termNumber || getCurrentTerm(),
          initiated_at: new Date().toISOString()
        },
      })
      .select()
      .single();

    if (paymentError) {
      console.error('❌ Payment record error:', paymentError);
      return NextResponse.json(
        { success: false, error: 'Failed to create payment' },
        { status: 500 }
      );
    }

    console.log(`📝 Payment record created: ${paymentRecord.id}`);

    // Initialize Paystack
    const callbackUrl = `${process.env.NEXT_PUBLIC_APP_URL}/payment/success?reference=${reference}`;
    const channels = paymentMethod === 'mpesa_stk' ? ['mobile_money'] : ['card', 'mobile_money', 'bank'];

    const initResult = await paystackClient.initializePayment({
      email: email,
      amount: paystackClient.toKobo(plan.price),
      reference: reference,
      callback_url: callbackUrl,
      channels: channels,
      metadata: {
        user_id: userId,
        plan_type: planType,
        payment_id: paymentRecord.id,
      },
    });

    if (!initResult.status) {
      await supabase.from('payments').update({ status: 'failed' }).eq('id', paymentRecord.id);
      return NextResponse.json({ success: false, error: initResult.message }, { status: 400 });
    }

    console.log(`✅ Payment initialized: ${reference} (${plan.name} - KES ${plan.price})`);

    return NextResponse.json({
      success: true,
      transactionId: reference,
      paymentLink: initResult.data.authorization_url,
      amount: plan.price,
      planName: plan.name,
      message: 'Payment initialized successfully',
    });
  } catch (error: any) {
    console.error('❌ Payment error:', error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

export const dynamic = 'force-dynamic';