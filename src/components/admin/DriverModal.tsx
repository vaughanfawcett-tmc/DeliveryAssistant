'use client';

import { useEffect, useRef, useState, useTransition } from 'react';
import type { DriverRow } from '@/types/database';
import { addDriver, updateDriver } from '@/app/actions/drivers';

// Client-side E.164 regex mirrors the server-side zod validation
const E164_REGEX = /^\+[1-9]\d{7,14}$/;

interface Props {
  driver?: DriverRow | null;
  onClose: (outcome: 'saved' | 'cancel') => void;
}

export function DriverModal({ driver, onClose }: Props) {
  const [isPending, startTransition] = useTransition();
  const [serverError, setServerError] = useState<string | null>(null);
  const [nameError, setNameError] = useState<string | null>(null);
  const [phoneError, setPhoneError] = useState<string | null>(null);

  const firstFieldRef = useRef<HTMLInputElement>(null);
  const lastFocusableRef = useRef<HTMLButtonElement>(null);

  // Focus first field on open
  useEffect(() => {
    firstFieldRef.current?.focus();
  }, []);

  // Trap focus within dialog
  function handleKeyDown(e: React.KeyboardEvent<HTMLDivElement>) {
    if (e.key === 'Escape') {
      onClose('cancel');
      return;
    }
    if (e.key !== 'Tab') return;

    const focusable = Array.from(
      e.currentTarget.querySelectorAll<HTMLElement>(
        'button:not([disabled]), input, a[href], [tabindex]:not([tabindex="-1"])',
      ),
    ).filter((el) => !el.closest('[aria-hidden="true"]'));

    if (focusable.length === 0) return;
    const first = focusable[0];
    const last = focusable[focusable.length - 1];

    if (e.shiftKey) {
      if (document.activeElement === first) {
        e.preventDefault();
        last.focus();
      }
    } else {
      if (document.activeElement === last) {
        e.preventDefault();
        first.focus();
      }
    }
  }

  function validateName(value: string): string | null {
    if (!value.trim()) return "Please enter the driver's full name.";
    return null;
  }

  function validatePhone(value: string): string | null {
    if (!E164_REGEX.test(value.trim()))
      return 'Enter a valid phone number in E.164 format (e.g. +44 7911 123456).';
    return null;
  }

  function handleSave(formData: FormData) {
    // Client-side validation before calling server
    const nameVal = ((formData.get('name') as string | null) ?? '').trim();
    const phoneVal = ((formData.get('phone_e164') as string | null) ?? '').trim();

    const nErr = validateName(nameVal);
    const pErr = validatePhone(phoneVal);
    setNameError(nErr);
    setPhoneError(pErr);
    if (nErr || pErr) return;

    setServerError(null);
    startTransition(async () => {
      const result = driver
        ? await updateDriver(driver.id, formData)
        : await addDriver(null, formData);
      if (result?.error) {
        setServerError(result.error);
        return;
      }
      onClose('saved');
    });
  }

  const title = driver ? 'Edit driver' : 'Add driver';

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="driver-modal-title"
      className="fixed inset-0 flex items-center justify-center z-50"
      onKeyDown={handleKeyDown}
    >
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-black/40"
        onClick={() => onClose('cancel')}
        aria-hidden="true"
      />

      {/* Card */}
      <div className="relative max-w-sm w-full mx-4 rounded-xl shadow-lg p-6 bg-background z-10">
        <h2 id="driver-modal-title" className="text-xl font-semibold text-zinc-900 mb-4">
          {title}
        </h2>

        <form action={handleSave} className="flex flex-col gap-4">
          {/* Full name */}
          <div>
            <label htmlFor="driver-name" className="block text-sm font-semibold text-zinc-700">
              Full name
            </label>
            <input
              ref={firstFieldRef}
              id="driver-name"
              name="name"
              type="text"
              defaultValue={driver?.name ?? ''}
              autoComplete="off"
              onBlur={(e) => setNameError(validateName(e.target.value))}
              className="w-full rounded-lg border border-zinc-300 px-4 py-3 text-base mt-1
                         focus:outline-none focus:ring-2 focus:ring-accent"
            />
            {nameError && (
              <p role="alert" className="text-red-600 text-sm mt-1">
                {nameError}
              </p>
            )}
          </div>

          {/* Phone number */}
          <div>
            <label htmlFor="driver-phone" className="block text-sm font-semibold text-zinc-700">
              Phone number
            </label>
            <input
              id="driver-phone"
              name="phone_e164"
              type="text"
              defaultValue={driver?.phone_e164 ?? ''}
              placeholder="+44 7911 123456"
              autoComplete="off"
              onBlur={(e) => setPhoneError(validatePhone(e.target.value))}
              className="w-full rounded-lg border border-zinc-300 px-4 py-3 text-base mt-1 font-mono
                         focus:outline-none focus:ring-2 focus:ring-accent"
            />
            <p className="text-sm text-zinc-500 mt-1">E.164 format, e.g. +44 7911 123456</p>
            {phoneError && (
              <p role="alert" className="text-red-600 text-sm mt-1">
                {phoneError}
              </p>
            )}
          </div>

          {/* Server error */}
          {serverError && (
            <p role="alert" className="text-red-600 text-sm">
              {serverError}
            </p>
          )}

          {/* Save */}
          <button
            type="submit"
            disabled={isPending}
            className="w-full h-11 rounded-full bg-accent text-white font-semibold
                       transition-colors hover:bg-accent/90 disabled:opacity-60 disabled:cursor-not-allowed"
          >
            {isPending ? 'Saving…' : 'Save driver'}
          </button>
        </form>

        {/* Cancel */}
        <div className="mt-3 text-center">
          <button
            ref={lastFocusableRef}
            type="button"
            onClick={() => onClose('cancel')}
            className="text-sm text-zinc-500 underline hover:text-zinc-700 min-h-[44px] px-2"
          >
            Discard changes
          </button>
        </div>
      </div>
    </div>
  );
}
