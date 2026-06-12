import type { NextRequest } from 'next/server';
import { getIronSession } from 'iron-session';
import { cookies } from 'next/headers';
import { getSessionOptions, type SessionData } from '@/lib/session';

export async function middleware(request: NextRequest) {
  // await cookies() — required in Next.js 16 (Pitfall 1: cookies() is async)
  const session = await getIronSession<SessionData>(await cookies(), getSessionOptions());
  if (!session.isLoggedIn) {
    return Response.redirect(new URL('/login', request.url), 302);
  }
  return undefined;
}

export const config = {
  matcher: '/dashboard/:path*',
};
