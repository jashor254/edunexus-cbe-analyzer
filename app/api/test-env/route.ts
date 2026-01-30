// app/api/test-env/route.ts - UPDATED VERSION
import { NextResponse } from "next/server";

export async function GET() {
  // Get raw values
  const deepseekRaw = process.env.DEEPSEEK_API_KEY || '';
  const supabaseUrlRaw = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
  const anonKeyRaw = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';
  const serviceKeyRaw = process.env.SUPABASE_SERVICE_ROLE_KEY || '';
  
  return NextResponse.json({
    timestamp: new Date().toISOString(),
    
    // Your 4 keys with DETAILED info
    deepseekApiKey: {
      exists: !!deepseekRaw,
      isSet: deepseekRaw.length > 0,
      length: deepseekRaw.length,
      startsWith: deepseekRaw.substring(0, 5),
      looksValid: deepseekRaw.startsWith('sk-') && deepseekRaw.length > 40,
      preview: deepseekRaw ? `${deepseekRaw.substring(0, 10)}...` : 'EMPTY',
      rawValue: deepseekRaw,  // Show full for debugging (remove later!)
    },
    
    supabaseUrl: {
      exists: !!supabaseUrlRaw,
      isSet: supabaseUrlRaw.length > 0,
      length: supabaseUrlRaw.length,
      startsWith: supabaseUrlRaw.substring(0, 8),
      looksValid: supabaseUrlRaw.startsWith('https://'),
      preview: supabaseUrlRaw ? `${supabaseUrlRaw.substring(0, 20)}...` : 'EMPTY',
    },
    
    supabaseAnonKey: {
      exists: !!anonKeyRaw,
      isSet: anonKeyRaw.length > 0,
      length: anonKeyRaw.length,
      startsWith: anonKeyRaw.substring(0, 5),
      looksValid: anonKeyRaw.startsWith('eyJ'), // JWT token
      preview: anonKeyRaw ? `${anonKeyRaw.substring(0, 10)}...` : 'EMPTY',
    },
    
    supabaseServiceRoleKey: {
      exists: !!serviceKeyRaw,
      isSet: serviceKeyRaw.length > 0,
      length: serviceKeyRaw.length,
      startsWith: serviceKeyRaw.substring(0, 5),
      looksValid: serviceKeyRaw.startsWith('eyJ'), // JWT token
      preview: serviceKeyRaw ? `${serviceKeyRaw.substring(0, 10)}...` : 'EMPTY',
    },
    
    // Environment info
    environment: {
      nodeEnv: process.env.NODE_ENV,
      allEnvVarsCount: Object.keys(process.env).length,
      loadedFrom: '.env.local',
    }
  });
}
