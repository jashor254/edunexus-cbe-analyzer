import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/utils/supabase/server';
import { paystackClient } from '@/lib/payments/paystack';

export const dynamic = 'force-dynamic';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const transactionId = body.transactionId || body.reference;

    if (!transactionId) {
      return NextResponse.json({ 
        success: false, 
        error: 'Transaction ID required' 
      }, { status: 400 });
    }

    const supabase = await createClient();

    // ============================================
    // 1. FIND PAYMENT RECORD
    // ============================================
    const { data: payment, error: paymentError } = await supabase
      .from('payments')
      .select('id, status, amount, user_id, transaction_id, plan, created_at, product_id, payment_type, metadata')
      .eq('transaction_id', transactionId)
      .single();

    if (paymentError || !payment) {
      return NextResponse.json({ 
        success: false, 
        error: 'Payment record not found in DB' 
      }, { status: 404 });
    }

    // ============================================
    // 2. CHECK IF ALREADY PROCESSED
    // ============================================
    if (payment.status === 'completed' || payment.status === 'successful') {
      return NextResponse.json({
        success: true,
        status: 'completed',
        message: 'Payment already verified and active.',
      });
    }

    // ============================================
    // 3. VERIFY WITH PAYSTACK
    // ============================================
    let verifyResult;
    try {
      verifyResult = await paystackClient.verifyPayment(transactionId);
    } catch (verifyError: any) {
      console.error('Paystack verification error:', verifyError);
      
      // Update payment record to failed
      await supabase
        .from('payments')
        .update({ 
          status: 'failed', 
          error_message: 'Paystack verification failed',
          updated_at: new Date().toISOString()
        })
        .eq('id', payment.id);
      
      return NextResponse.json({ 
        success: false, 
        error: 'Payment verification failed with Paystack' 
      }, { status: 502 });
    }

    // Check Paystack response
    if (!verifyResult.status || verifyResult.data.status !== 'success') {
      // Payment failed or still pending
      const newStatus = verifyResult.data.status === 'pending' ? 'pending' : 'failed';
      
      await supabase
        .from('payments')
        .update({ 
          status: newStatus,
          paystack_data: verifyResult.data,
          updated_at: new Date().toISOString()
        })
        .eq('id', payment.id);
      
      return NextResponse.json({
        success: false,
        status: newStatus,
        error: `Payment ${newStatus}`
      }, { status: 400 });
    }

    const paystackData = verifyResult.data;

    // ============================================
    // 4. VALIDATE AMOUNT
    // ============================================
    const expectedKobo = paystackClient.toKobo(payment.amount);
    if (paystackData.amount < expectedKobo) {
      await supabase
        .from('payments')
        .update({ 
          status: 'failed', 
          error_message: 'Amount mismatch',
          paystack_data: paystackData,
          updated_at: new Date().toISOString()
        })
        .eq('id', payment.id);
      
      return NextResponse.json({ 
        success: false, 
        error: 'Amount mismatch - possible fraud' 
      }, { status: 400 });
    }

    // ============================================
    // 5. ATOMIC UPDATE WITH RPC
    // ============================================
    const { error: rpcError } = await supabase.rpc('handle_successful_payment', {
      p_payment_id: payment.id,
      p_user_id: payment.user_id,
      p_product_id: payment.product_id,
      p_payment_type: payment.payment_type,
      p_tokens_to_add: payment.metadata?.tokens_to_add || 0,
      p_paystack_data: paystackData
    });

    if (rpcError) {
      console.error('RPC Error:', rpcError);
      
      // Fallback: Update payment status manually
      await supabase
        .from('payments')
        .update({ 
          status: 'completed',
          verified_at: new Date().toISOString(),
          paystack_data: paystackData,
          updated_at: new Date().toISOString()
        })
        .eq('id', payment.id);
      
      // For tokens, try to add them directly
      if (payment.payment_type === 'bundle' && payment.metadata?.tokens_to_add) {
        await supabase.rpc('add_tokens_to_user', {
          p_user_id: payment.user_id,
          p_tokens: payment.metadata.tokens_to_add,
          p_source: 'payment',
          p_reference: transactionId
        });
      }
      
      // For subscription, create one
      if (payment.payment_type === 'subscription') {
        const startDate = new Date();
        const endDate = new Date();
        endDate.setMonth(endDate.getMonth() + 3); // Termly = 3 months
        
        await supabase
          .from('subscriptions')
          .insert({
            user_id: payment.user_id,
            plan_type: payment.product_id,
            status: 'active',
            start_date: startDate.toISOString(),
            end_date: endDate.toISOString(),
            payment_id: payment.id
          });
      }
    }

    return NextResponse.json({
      success: true,
      status: 'completed',
      message: 'Payment verified and account upgraded successfully! 🎉',
      data: {
        payment_type: payment.payment_type,
        product_id: payment.product_id,
        amount: payment.amount
      }
    });

  } catch (error: unknown) {
    console.error('Verification System Error:', error instanceof Error ? error.message : String(error));
    return NextResponse.json({ 
      success: false, 
      error: 'Internal server error during verification' 
    }, { status: 500 });
  }
}

// ============================================
// GET HANDLER FOR CALLBACK REDIRECTS
// ============================================
export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const reference = searchParams.get('reference') || searchParams.get('trxref');
  const transactionId = searchParams.get('transactionId');

  const txRef = reference || transactionId;

  if (!txRef) {
    return NextResponse.redirect(
      `${process.env.NEXT_PUBLIC_SITE_URL}/payments/failed?error=no_reference`
    );
  }

  try {
    // Call verification
    const verifyResponse = await POST(new NextRequest(request.url, {
      method: 'POST',
      body: JSON.stringify({ transactionId: txRef })
    }));

    const result = await verifyResponse.json();

    if (result.success) {
      return NextResponse.redirect(
        `${process.env.NEXT_PUBLIC_SITE_URL}/payments/success?reference=${txRef}`
      );
    } else {
      return NextResponse.redirect(
        `${process.env.NEXT_PUBLIC_SITE_URL}/payments/failed?reference=${txRef}&error=${result.error}`
      );
    }
  } catch (error) {
    return NextResponse.redirect(
      `${process.env.NEXT_PUBLIC_SITE_URL}/payments/failed?reference=${txRef}&error=verification_failed`
    );
  }
}