// app/api/payments/webhook/route.ts
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
      console.error('No signature in webhook');
      return NextResponse.json({ error: 'No signature' }, { status: 401 });
    }

    const body = await request.text();
    
    if (!paystackClient.verifyWebhookSignature(signature, body)) {
      console.error('Invalid webhook signature');
      return NextResponse.json({ error: 'Invalid signature' }, { status: 401 });
    }

    const event = JSON.parse(body);
    const eventType = event.event;
    const data = event.data;

    console.log('Paystack webhook received:', eventType, data.reference);

    if (eventType !== 'charge.success') {
      return NextResponse.json({ status: 'ignored' });
    }

    const reference = data.reference;

    const { data: payment, error: paymentError } = await supabase
      .from('payments')
      .select('*')
      .eq('transaction_id', reference)
      .single();

    if (paymentError || !payment) {
      console.error('Payment not found:', reference);
      return NextResponse.json({ error: 'Payment not found' }, { status: 404 });
    }

    if (payment.status === 'successful') {
      return NextResponse.json({ status: 'already_processed' });
    }

    const verifyResult = await paystackClient.verifyPayment(reference);
    
    if (!verifyResult.status) {
      console.error('Verification failed:', verifyResult.message);
      return NextResponse.json({ error: 'Verification failed' }, { status: 400 });
    }

    const paystackData = verifyResult.data;
    const isValid =
      paystackData.status === 'success' &&
      paystackData.amount >= paystackClient.toKobo(payment.amount) &&
      paystackData.currency === 'KES' &&
      paystackData.reference === reference;

    if (!isValid) {
      console.error('Invalid transaction:', paystackData);
      
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

    const { error: subscriptionError } = await supabase.rpc('upgrade_subscription', {
      p_user_id: payment.user_id,
      p_plan_type: payment.plan_type,
      p_term_year: payment.metadata?.term_year || null,
      p_term_number: payment.metadata?.term_number || null,
    });

    if (subscriptionError) {
      console.error('Subscription upgrade error:', subscriptionError);
      return NextResponse.json({ error: 'Upgrade failed' }, { status: 500 });
    }

    console.log('Payment processed successfully:', reference);

    return NextResponse.json({
      status: 'success',
      message: 'Payment processed',
    });
  } catch (error: any) {
    console.error('Webhook error:', error);
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