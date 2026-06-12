'use server';
import 'server-only';

import { cookies } from 'next/headers';
import { getIronSession } from 'iron-session';
import { redirect } from 'next/navigation';
import { getSessionOptions, type SessionData } from '@/lib/session';

/**
 * Login server action — validates submitted password against DASHBOARD_PASSWORD env var.
 * On match: sets a signed httpOnly session cookie and redirects to /dashboard.
 * On mismatch: returns an error message (never throws).
 *
 * Signature is compatible with useActionState(loginAction, null).
 */
export async function loginAction(
  _prevState: { error?: string } | null,
  formData: FormData,
): Promise<{ error?: string }> {
  const password = ((formData.get('password') as string | null) ?? '').trim();
  const expected = process.env.DASHBOARD_PASSWORD;

  // T-03-03: read password from process.env (never from client-accessible env proxy)
  if (!password || !expected || password !== expected) {
    return { error: 'Incorrect password. Please try again.' };
  }

  // await cookies() — required in Next.js 16 (Pitfall 1)
  const session = await getIronSession<SessionData>(await cookies(), getSessionOptions());
  session.isLoggedIn = true;
  await session.save();
  redirect('/dashboard');
}

/**
 * Logout server action — destroys the session cookie and redirects to /login.
 */
export async function logoutAction(): Promise<void> {
  const session = await getIronSession<SessionData>(await cookies(), getSessionOptions());
  session.destroy();
  redirect('/login');
}
