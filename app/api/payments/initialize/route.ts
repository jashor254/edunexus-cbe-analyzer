// app/api/payments/initialize/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { paystackClient } from '@/lib/payments/paystack';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

interface InitiatePaymentRequest {
  planType: 'free' | 'termly' | 'lifetime';
  paymentMethod: 'mpesa_stk' | 'card' | 'mpesa_paybill';
  phoneNumber?: string;
  email: string;
  termYear?: number;
  termNumber?: number;
}

const PAYMENT_PLANS = {
  free: { name: 'Free Plan', price: 0, currency: 'KES', tokens: 3 },
  termly: { name: 'Termly Plan', price: 300, currency: 'KES', tokens: 50 },
  lifetime: { name: 'Lifetime Plan', price: 1500, currency: 'KES', tokens: 999999 },
};

function formatPhoneNumber(phone: string): string {
  let cleaned = phone.replace(/\s+/g, '').replace(/[^0-9+]/g, '');
  if (cleaned.startsWith('+')) cleaned = cleaned.substring(1);
  if (cleaned.startsWith('0')) cleaned = '254' + cleaned.substring(1);
  if (!cleaned.startsWith('254')) cleaned = '254' + cleaned;
  return cleaned;
}

export async function POST(request: NextRequest) {
  try {
    const body: InitiatePaymentRequest = await request.json();
    const { planType, paymentMethod, phoneNumber, email } = body;

    if (!planType || !paymentMethod || !email) {
      return NextResponse.json(
        { success: false, error: 'Missing required fields' },
        { status: 400 }
      );
    }

    const plan = PAYMENT_PLANS[planType];
    if (!plan || planType === 'free') {
      return NextResponse.json(
        { success: false, error: 'Invalid plan' },
        { status: 400 }
      );
    }

    const reference = paystackClient.generateReference();
    const userId = email;

    const { data: paymentRecord, error: paymentError } = await supabase
      .from('payments')
      .insert({
        user_id: userId,
        transaction_id: reference,
        amount: plan.price,
        currency: 'KES',
        payment_method: paymentMethod,
        phone_number: phoneNumber ? formatPhoneNumber(phoneNumber) : null,
        status: 'pending',
        plan_type: planType,
        metadata: { plan_name: plan.name },
      })
      .select()
      .single();

    if (paymentError) {
      console.error('Payment record error:', paymentError);
      return NextResponse.json(
        { success: false, error: 'Failed to create payment' },
        { status: 500 }
      );
    }

    const callbackUrl = `${process.env.NEXT_PUBLIC_APP_URL}/api/payments/callback`;
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

    return NextResponse.json({
      success: true,
      transactionId: reference,
      paymentLink: initResult.data.authorization_url,
      message: 'Payment initialized successfully',
    });
  } catch (error: any) {
    console.error('Payment initialization error:', error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

export const dynamic = 'force-dynamic';