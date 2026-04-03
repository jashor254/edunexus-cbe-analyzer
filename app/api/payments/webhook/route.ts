import { NextRequest } from 'next/server';
import { apiSuccess, apiError, apiUnauthorized, apiBadRequest } from '@/lib/api/response';
import { createClient } from '@supabase/supabase-js';
import { paystackClient } from '@/lib/payments/paystack';

// Service Role for bypassing RLS
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function POST(request: NextRequest) {
  try {
    // ============================================
    // 1. SECURITY: Verify Paystack Signature
    // ============================================
    const signature = request.headers.get('x-paystack-signature');
    const body = await request.text(); // Raw body for signature verification
    
    if (!signature || !paystackClient.verifyWebhookSignature(signature, body)) {
      console.error('❌ Invalid Webhook Signature');
      return apiUnauthorized();
    }

    const event = JSON.parse(body);
    
    // Only process successful charges
    if (event.event !== 'charge.success') {
      return apiSuccess({ status: 'ignored' });
    }

    const { reference, metadata, amount, customer } = event.data;
    
    // ============================================
    // 2. PARSE METADATA (handle string or object)
    // ============================================
    const meta = typeof metadata === 'string' ? JSON.parse(metadata) : metadata;
    const { user_id, product_id, payment_type, tokens_to_add } = meta || {};

    if (!user_id) {
      console.error('❌ Missing user_id in metadata for ref:', reference);
      return apiBadRequest('Missing user_id in metadata');
    }

    // ============================================
    // 3. IDEMPOTENCY CHECK - Prevent double processing
    // ============================================
    const { data: existingPayment } = await supabase
      .from('payments')
      .select('id, status')
      .eq('transaction_id', reference)
      .single();

    if (existingPayment) {
      if (existingPayment.status === 'completed' || existingPayment.status === 'successful') {
        console.log(`⚠️ Transaction ${reference} already processed. Skipping.`);
        return apiSuccess({ status: 'already_processed' });
      }
    }

    console.log(`📨 Processing Payment: ${reference} | Amount: KES ${amount/100}`);

    // ============================================
    // 4. ATOMIC UPDATE - All or nothing!
    // ============================================
    const { error: rpcError } = await supabase.rpc('handle_successful_payment_webhook', {
      p_user_id: user_id,
      p_transaction_id: reference,
      p_product_id: product_id || 'token_bundle',
      p_payment_type: payment_type || 'bundle',
      p_tokens_to_add: Number(tokens_to_add) || 0,
      p_amount: amount / 100,
      p_metadata: meta,
      p_customer_email: customer?.email || null
    });

    if (rpcError) {
      console.error('❌ RPC Error:', rpcError);
      
      // Log to error table for manual review
      await supabase.from('webhook_errors').insert({
        transaction_id: reference,
        error: rpcError.message,
        payload: meta,
        created_at: new Date().toISOString()
      });
      
      // Return 500 so Paystack retries
      return apiError('Database update failed');
    }

    console.log(`✅ Success! Payment processed for User: ${user_id}`);
    return apiSuccess({ status: 'success' });

  } catch (error: any) {
    console.error('❌ Webhook Critical Error:', error.message);
    return apiError('Internal Server Error');
  }
}

export const dynamic = 'force-dynamic';