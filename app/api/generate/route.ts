// app/api/generate/route.ts
import { NextResponse } from 'next/server';
import { validateUserAccess } from '@/lib/api-protection';
import { createClient } from '@/utils/supabase/server';

export async function POST(req: Request) {
  // Await hapa pia kuzuia TS errors
  const supabase = await createClient(); 
  
  const { allowed, user, subscription, isUnlimited } = await validateUserAccess();

  if (!allowed) {
    return NextResponse.json(
      { error: 'Inasikitisha, huna tokens za kutosha!' }, 
      { status: 403 }
    );
  }

  try {
    // --- HAPA NDIPO AI LOGIC YAKO INAKAA (OpenAI/Claude call) ---
    const aiResponse = "Hapa ni matokeo ya AI...";

    // KUKATA TOKENS: Skip kama ni Founder/Admin
    if (!isUnlimited && subscription && user) {
      await supabase
        .from('subscriptions')
        .update({ tokens_remaining: subscription.tokens_remaining - 1 })
        .eq('user_id', user.id);
      
      console.log(`Token imekatwa kwa user: ${user.email}`);
    } else {
      console.log("Founder Access: Hakuna token imekatwa.");
    }

    return NextResponse.json({ success: true, data: aiResponse });

  } catch (error) {
    console.error("API Error:", error);
    return NextResponse.json({ error: 'Server Error' }, { status: 500 });
  }
}