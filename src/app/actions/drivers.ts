'use server';
import 'server-only';

import { cookies } from 'next/headers';
import { getIronSession } from 'iron-session';
import { revalidatePath } from 'next/cache';
import { z } from 'zod';
import { getSessionOptions, type SessionData } from '@/lib/session';
import {
  insertDriver,
  updateDriver as repoUpdateDriver,
  deleteDriver as repoDeleteDriver,
} from '@/lib/repositories/drivers-repo';

// ---------------------------------------------------------------------------
// Session guard — MUST be the first call in every mutation (Pitfall 5 / T-03-11)
// Middleware does NOT protect server actions; each action must self-verify.
// ---------------------------------------------------------------------------

async function requireSession(): Promise<void> {
  const session = await getIronSession<SessionData>(await cookies(), getSessionOptions());
  if (!session.isLoggedIn) throw new Error('Unauthorized');
}

// ---------------------------------------------------------------------------
// Validation schema (T-03-12 — server-side zod E.164 + length caps)
// ---------------------------------------------------------------------------

const driverSchema = z.object({
  name: z
    .string()
    .min(1, "Please enter the driver's full name.")
    .max(120, "Please enter the driver's full name."),
  phone_e164: z
    .string()
    .max(20, 'Enter a valid phone number in E.164 format (e.g. +44 7911 123456).')
    .regex(
      /^\+[1-9]\d{7,14}$/,
      'Enter a valid phone number in E.164 format (e.g. +44 7911 123456).',
    ),
});

// ---------------------------------------------------------------------------
// Exported server actions
// ---------------------------------------------------------------------------

/**
 * Add a new driver. Signature compatible with useActionState(addDriver, null).
 */
export async function addDriver(
  _prevState: { error?: string } | null,
  formData: FormData,
): Promise<{ error?: string }> {
  await requireSession(); // MUST be first (Pitfall 5)

  const parsed = driverSchema.safeParse({
    name: ((formData.get('name') as string | null) ?? '').trim(),
    phone_e164: ((formData.get('phone_e164') as string | null) ?? '').trim(),
  });

  if (!parsed.success) {
    return { error: parsed.error.issues[0].message };
  }

  try {
    await insertDriver(parsed.data);
  } catch (err) {
    console.error('[drivers action] addDriver failed:', err);
    return { error: 'Failed to save driver. Please try again.' };
  }

  revalidatePath('/dashboard/drivers');
  return {};
}

/**
 * Update an existing driver by id. id is a trusted server-held value, not from formData.
 */
export async function updateDriver(
  id: string,
  formData: FormData,
): Promise<{ error?: string }> {
  await requireSession(); // MUST be first (Pitfall 5)

  const parsed = driverSchema.safeParse({
    name: ((formData.get('name') as string | null) ?? '').trim(),
    phone_e164: ((formData.get('phone_e164') as string | null) ?? '').trim(),
  });

  if (!parsed.success) {
    return { error: parsed.error.issues[0].message };
  }

  try {
    await repoUpdateDriver(id, parsed.data);
  } catch (err) {
    console.error('[drivers action] updateDriver failed:', err);
    return { error: 'Failed to update driver. Please try again.' };
  }

  revalidatePath('/dashboard/drivers');
  return {};
}

/**
 * Toggle a driver's active status (D-10: deactivate is reversible, no confirmation).
 */
export async function setDriverActive(id: string, active: boolean): Promise<{ error?: string }> {
  await requireSession(); // MUST be first (Pitfall 5)

  try {
    await repoUpdateDriver(id, { active });
  } catch (err) {
    console.error('[drivers action] setDriverActive failed:', err);
    return { error: 'Failed to update driver status. Please try again.' };
  }

  revalidatePath('/dashboard/drivers');
  return {};
}

/**
 * Hard-delete a driver (D-10: gated behind DeleteConfirmDialog on the client).
 */
export async function deleteDriver(id: string): Promise<{ error?: string }> {
  await requireSession(); // MUST be first (Pitfall 5)

  try {
    await repoDeleteDriver(id);
  } catch (err) {
    console.error('[drivers action] deleteDriver failed:', err);
    return { error: 'Failed to delete driver. Please try again.' };
  }

  revalidatePath('/dashboard/drivers');
  return {};
}
