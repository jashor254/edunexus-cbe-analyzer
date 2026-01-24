// app/api/payments/callback/route.ts
import { NextRequest, NextResponse } from 'next/server';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    
    const status = searchParams.get('status');
    const reference = searchParams.get('reference');
    const trxref = searchParams.get('trxref');
    
    const transactionId = reference || trxref;
    const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';
    
    if (status === 'success') {
      return NextResponse.redirect(
        `${baseUrl}/payment/success?transactionId=${transactionId}`
      );
    } else if (status === 'cancelled') {
      return NextResponse.redirect(
        `${baseUrl}/payment/cancelled?transactionId=${transactionId}`
      );
    } else {
      return NextResponse.redirect(
        `${baseUrl}/payment/failed?transactionId=${transactionId}`
      );
    }
  } catch (error) {
    console.error('Callback error:', error);
    const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';
    return NextResponse.redirect(`${baseUrl}/payment/error`);
  }
}

// Add this to make it a valid module
export const dynamic = 'force-dynamic';