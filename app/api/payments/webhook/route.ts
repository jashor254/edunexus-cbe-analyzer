// ============================================
// WEBHOOK HANDLER - UPDATED
// Replace: app/api/payments/webhook/route.ts
// ============================================

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { paystackClient } from '@/lib/payments/paystack';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function POST(request: NextRequest) {
  try {
    const signature = request.headers.get('x-paystack-signature');
    
    if (!signature) {
      console.error('❌ No signature');
      return NextResponse.json({ error: 'No signature' }, { status: 401 });
    }

    const body = await request.text();
    
    if (!paystackClient.verifyWebhookSignature(signature, body)) {
      console.error('❌ Invalid signature');
      return NextResponse.json({ error: 'Invalid signature' }, { status: 401 });
    }

    const event = JSON.parse(body);
    const eventType = event.event;
    const data = event.data;

    console.log(`📨 Webhook: ${eventType} - ${data.reference}`);

    if (eventType !== 'charge.success') {
      return NextResponse.json({ status: 'ignored' });
    }

    const reference = data.reference;

    // Find payment
    const { data: payment, error: paymentError } = await supabase
      .from('payments')
      .select('*')
      .eq('transaction_id', reference)
      .single();

    if (paymentError || !payment) {
      console.error('❌ Payment not found:', reference);
      return NextResponse.json({ error: 'Payment not found' }, { status: 404 });
    }

    if (payment.status === 'successful') {
      console.log('✅ Already processed:', reference);
      return NextResponse.json({ status: 'already_processed' });
    }

    // Verify with Paystack
    const verifyResult = await paystackClient.verifyPayment(reference);
    
    if (!verifyResult.status) {
      console.error('❌ Verification failed:', verifyResult.message);
      return NextResponse.json({ error: 'Verification failed' }, { status: 400 });
    }

    const paystackData = verifyResult.data;
    
    // Validate
    const isValid =
      paystackData.status === 'success' &&
      paystackData.amount >= paystackClient.toKobo(payment.amount) &&
      paystackData.currency === 'KES' &&
      paystackData.reference === reference;

    if (!isValid) {
      console.error('❌ Invalid transaction');
      
      await supabase
        .from('payments')
        .update({
          status: 'failed',
          metadata: {
            ...payment.metadata,
            webhook_data: data,
            verification_failed: true,
          },
        })
        .eq('id', payment.id);

      return NextResponse.json({ status: 'invalid_transaction' });
    }

    // Mark as successful
    await supabase
      .from('payments')
      .update({
        status: 'successful',
        metadata: {
          ...payment.metadata,
          webhook_data: data,
          verified_at: new Date().toISOString(),
        },
      })
      .eq('id', payment.id);

    console.log(`✅ Payment successful: ${reference}`);

    // Process based on plan type
    const planType = payment.plan_type;
    const isTokenPurchase = planType.startsWith('tokens_');

    if (isTokenPurchase) {
      // Add tokens
      const tokens = payment.metadata?.tokens || parseInt(planType.split('_')[1]);
      
      const { error } = await supabase.rpc('add_tokens', {
        p_user_id: payment.user_id,
        p_tokens: tokens,
        p_amount: payment.amount
      });

      if (error) {
        console.error('❌ Token add error:', error);
        return NextResponse.json({ error: 'Token add failed' }, { status: 500 });
      }

      console.log(`✅ Added ${tokens} tokens`);

    } else if (planType === 'termly' || planType === 'lifetime') {
      // Add tokens for these plans
      const tokens = payment.metadata?.tokens || 0;
      
      if (tokens > 0) {
        await supabase.rpc('add_tokens', {
          p_user_id: payment.user_id,
          p_tokens: tokens,
          p_amount: payment.amount
        });
      }

      // For lifetime, create permanent subscription
      if (planType === 'lifetime') {
        await supabase.from('subscriptions').insert({
          user_id: payment.user_id,
          plan_type: 'lifetime',
          billing_cycle: 'lifetime',
          amount_paid: payment.amount,
          start_date: new Date().toISOString(),
          end_date: new Date('2099-12-31').toISOString(),
          status: 'active',
          payment_reference: reference
        });
      } else {
        // Termly subscription (3 months)
        await supabase.from('subscriptions').insert({
          user_id: payment.user_id,
          plan_type: 'termly',
          billing_cycle: 'termly',
          amount_paid: payment.amount,
          start_date: new Date().toISOString(),
          end_date: new Date(Date.now() + 90 * 24 * 60 * 60 * 1000).toISOString(), // +90 days
          status: 'active',
          payment_reference: reference
        });
      }

      console.log(`✅ ${planType} plan activated`);
    }

    return NextResponse.json({
      status: 'success',
      message: 'Payment processed',
    });

  } catch (error: any) {
    console.error('❌ Webhook error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function GET() {
  return NextResponse.json({
    message: 'Paystack webhook endpoint',
    timestamp: new Date().toISOString(),
  });
}

export const dynamic = 'force-dynamic';