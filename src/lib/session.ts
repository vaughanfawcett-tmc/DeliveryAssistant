// Edge-safe session config — NO 'server-only' import (Pitfall 2: middleware runs in Edge
// runtime and cannot load server-only). Reads process.env directly, NOT the env Proxy
// (the Proxy chain may pull in server-only modules through env.ts imports).
import type { SessionOptions } from 'iron-session';

export interface SessionData {
  isLoggedIn: boolean;
}

/**
 * Returns iron-session options. Called as a function (not a singleton constant) so
 * that process.env is read at request time — safe for edge + Node.js runtimes.
 */
export function getSessionOptions(): SessionOptions {
  const secret = process.env.DASHBOARD_SESSION_SECRET;
  if (!secret) throw new Error('DASHBOARD_SESSION_SECRET is required');
  return {
    password: secret,
    cookieName: 'da_session',
    cookieOptions: {
      secure: process.env.NODE_ENV === 'production',
      httpOnly: true,
      sameSite: 'lax' as const,
      maxAge: 60 * 60 * 8, // 8h session expiry (D-05)
    },
  };
}
