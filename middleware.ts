import { type NextRequest } from 'next/server'
import { updateSession } from '@/utils/supabase/middleware'

// Next.js inatafuta function inayoitwa 'middleware' ndani ya 'middleware.ts'
export async function middleware(request: NextRequest) {
  return await updateSession(request)
}

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
}