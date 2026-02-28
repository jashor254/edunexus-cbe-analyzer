import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { paystackClient } from '@/lib/payments/paystack';

// Tunatumia Service Role hapa ili kuweza ku-update DB bila vikwazo vya RLS
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function POST(request: NextRequest) {
  try {
    const signature = request.headers.get('x-paystack-signature');
    const body = await request.text();
    
    // 1. Security Check
    if (!signature || !paystackClient.verifyWebhookSignature(signature, body)) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const event = JSON.parse(body);
    if (event.event !== 'charge.success') {
      return NextResponse.json({ status: 'ignored' });
    }

    const data = event.data;
    const reference = data.reference;
    // Muhimu: Hakikisha metadata hizi unazituma kutoka kwa frontend wakati wa kuanzisha malipo
    const { user_id, plan_type, tokens_to_add } = data.metadata;

    console.log(`📨 Processing Payment: ${reference} for User: ${user_id}`);

    // 2. Double Check na Paystack (Optional but Safe)
    const verifyResult = await paystackClient.verifyPayment(reference);
    if (!verifyResult.status || verifyResult.data.status !== 'success') {
      return NextResponse.json({ error: 'Paystack verification failed' }, { status: 400 });
    }

    // 3. Database Updates (Inline with yesterday's Logic)
    
    if (plan_type === 'term') {
      // Logic ya UNLIMITED (3 Months / 90 Days)
      await supabase
        .from('subscriptions')
        .update({
          plan_type: 'term',
          tokens_remaining: 999999, // Backup tokens
          subscription_end: new Date(Date.now() + 90 * 24 * 60 * 60 * 1000).toISOString(),
          updated_at: new Date().toISOString()
        })
        .eq('user_id', user_id);
      
      console.log(`✅ Termly Unlimited activated for ${user_id}`);

    } else {
      // Logic ya TOKENS
      // Tunatumia RPC tuliyoiandika jana ili ku-increment tokens salama
      const { error: rpcError } = await supabase.rpc('add_tokens', {
        p_user_id: user_id,
        p_tokens: tokens_to_add || 10, // Default kama metadata ikikosekana
        p_amount: data.amount / 100    // Convert cents to KES
      });

      if (rpcError) {
        console.error('❌ RPC Token Error:', rpcError);
        return NextResponse.json({ error: 'DB Update Failed' }, { status: 500 });
      }
      
      console.log(`✅ ${tokens_to_add} tokens added for ${user_id}`);
    }

    // 4. Rekodi Transaction (Hii ni kwa ajili ya audit/history)
    await supabase.from('payments').insert({
      user_id: user_id,
      transaction_id: reference,
      amount: data.amount / 100,
      status: 'successful',
      plan_type: plan_type,
      metadata: data.metadata
    });

    return NextResponse.json({ status: 'success', message: 'Processed' });

  } catch (error: any) {
    console.error('❌ Webhook Crash:', error.message);
    return NextResponse.json({ error: 'Internal Error' }, { status: 500 });
  }
}

export const dynamic = 'force-dynamic';