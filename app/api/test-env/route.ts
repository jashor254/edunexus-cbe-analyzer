// app/api/test-env/route.ts
import { NextResponse } from "next/server";

export async function GET() {
  return NextResponse.json({
    supabaseUrl: process.env.NEXT_PUBLIC_SUPABASE_URL || "MISSING",
    anonKey: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ? "OK" : "MISSING",
    googleApiKey: process.env.GOOGLE_API_KEY ? "OK" : "MISSING",
  });
}

