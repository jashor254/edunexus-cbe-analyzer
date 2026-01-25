// app/api/users/create/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function POST(request: NextRequest) {
  try {
    const { email, name, referralCode } = await request.json();

    if (!email) {
      return NextResponse.json(
        { success: false, error: 'Email required' },
        { status: 400 }
      );
    }

    // Check if user already exists
    const { data: existing } = await supabase
      .from('users')
      .select('id, email, referral_code')
      .eq('email', email)
      .single();

    if (existing) {
      return NextResponse.json({
        success: true,
        user: existing,
        message: 'User already exists',
      });
    }

    // Create user with referral
    const { data, error } = await supabase
      .rpc('create_user_with_referral', {
        p_email: email,
        p_name: name || null,
        p_referred_by_code: referralCode || null,
      });

    if (error) {
      console.error('User creation error:', error);
      return NextResponse.json(
        { success: false, error: error.message },
        { status: 500 }
      );
    }

    const userData = data[0];

    return NextResponse.json({
      success: true,
      user: {
        id: userData.user_id,
        email: email,
        referralCode: userData.referral_code,
        freeAnalyses: userData.free_analyses,
      },
      message: referralCode 
        ? 'Account created! You and your referrer got bonus tokens!' 
        : 'Account created! You have 1 free analysis!',
    });
  } catch (error: any) {
    console.error('User creation API error:', error);
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 }
    );
  }
}

export const dynamic = 'force-dynamic';