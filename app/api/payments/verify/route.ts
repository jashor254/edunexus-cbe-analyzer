// app/api/payments/verify/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { paystackClient } from '@/lib/payments/paystack';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const transactionId = body.transactionId;

    if (!transactionId) {
      return NextResponse.json(
        { success: false, error: 'Transaction ID required' },
        { status: 400 }
      );
    }

    const { data: payment, error: paymentError } = await supabase
      .from('payments')
      .select('*')
      .eq('transaction_id', transactionId)
      .single();

    if (paymentError || !payment) {
      return NextResponse.json(
        { success: false, error: 'Payment not found' },
        { status: 404 }
      );
    }

    if (payment.status === 'successful') {
      const { data: subscription } = await supabase
        .from('subscriptions')
        .select('*')
        .eq('user_id', payment.user_id)
        .eq('status', 'active')
        .single();

      return NextResponse.json({
        success: true,
        status: 'successful',
        payment: payment,
        subscription: subscription || undefined,
        message: 'Payment already verified',
      });
    }

    const verifyResult = await paystackClient.verifyPayment(transactionId);

    if (!verifyResult.status) {
      return NextResponse.json(
        { success: false, status: 'failed', error: verifyResult.message },
        { status: 400 }
      );
    }

    const paystackData = verifyResult.data;
    const isSuccessful =
      paystackData.status === 'success' &&
      paystackData.amount >= paystackClient.toKobo(payment.amount) &&
      paystackData.currency === 'KES';

    if (isSuccessful) {
      await supabase
        .from('payments')
        .update({
          status: 'successful',
          metadata: {
            ...payment.metadata,
            paystack_response: paystackData,
            verified_at: new Date().toISOString(),
          },
        })
        .eq('id', payment.id);

      await supabase.rpc('upgrade_subscription', {
        p_user_id: payment.user_id,
        p_plan_type: payment.plan_type,
        p_term_year: payment.metadata?.term_year || null,
        p_term_number: payment.metadata?.term_number || null,
      });

      const { data: subscription } = await supabase
        .from('subscriptions')
        .select('*')
        .eq('user_id', payment.user_id)
        .eq('status', 'active')
        .order('created_at', { ascending: false })
        .limit(1)
        .single();

      return NextResponse.json({
        success: true,
        status: 'successful',
        payment: { ...payment, status: 'successful' },
        subscription: subscription || undefined,
        message: 'Payment verified successfully',
      });
    } else {
      const newStatus = paystackData.status === 'failed' ? 'failed' : 'pending';

      await supabase
        .from('payments')
        .update({
          status: newStatus,
          metadata: {
            ...payment.metadata,
            paystack_response: paystackData,
          },
        })
        .eq('id', payment.id);

      return NextResponse.json({
        success: false,
        status: newStatus,
        payment: { ...payment, status: newStatus },
        message: newStatus === 'failed' ? 'Payment failed' : 'Payment pending',
      });
    }
  } catch (error: any) {
    console.error('Verification error:', error);
    return NextResponse.json(
      { success: false, status: 'pending', error: error.message },
      { status: 500 }
    );
  }
}

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const transactionId = searchParams.get('transactionId');

  if (!transactionId) {
    return NextResponse.json(
      { success: false, error: 'Transaction ID required' },
      { status: 400 }
    );
  }

  return POST(
    new NextRequest(request.url, {
      method: 'POST',
      body: JSON.stringify({ transactionId }),
    })
  );
}

export const dynamic = 'force-dynamic';