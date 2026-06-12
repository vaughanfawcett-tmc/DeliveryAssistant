'use client';

import { useEffect, useRef, useTransition } from 'react';
import { deleteDriver } from '@/app/actions/drivers';

interface Props {
  driverId: string;
  driverName: string;
  onDone: (outcome: 'deleted' | 'cancel') => void;
}

export function DeleteConfirmDialog({ driverId, driverName, onDone }: Props) {
  const [isPending, startTransition] = useTransition();
  const cancelRef = useRef<HTMLButtonElement>(null);

  // Focus cancel (safe default) on open
  useEffect(() => {
    cancelRef.current?.focus();
  }, []);

  function handleKeyDown(e: React.KeyboardEvent<HTMLDivElement>) {
    if (e.key === 'Escape') onDone('cancel');
  }

  function handleConfirm() {
    startTransition(async () => {
      await deleteDriver(driverId);
      onDone('deleted');
    });
  }

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="delete-dialog-title"
      className="fixed inset-0 flex items-center justify-center z-50"
      onKeyDown={handleKeyDown}
    >
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-black/40"
        onClick={() => onDone('cancel')}
        aria-hidden="true"
      />

      {/* Card */}
      <div className="relative max-w-sm w-full mx-4 rounded-xl shadow-lg p-6 bg-background z-10">
        <h2 id="delete-dialog-title" className="text-lg font-semibold text-zinc-900 mb-2">
          Delete {driverName}?
        </h2>
        <p className="text-sm text-zinc-600 mb-6">
          This will permanently remove them from the system and cannot be undone.
        </p>

        <div className="flex flex-col gap-3 sm:flex-row-reverse">
          <button
            type="button"
            onClick={handleConfirm}
            disabled={isPending}
            className="flex-1 h-11 bg-red-600 text-white rounded-full px-5 py-2 text-sm font-semibold
                       transition-colors hover:bg-red-700 disabled:opacity-60 disabled:cursor-not-allowed"
          >
            {isPending ? 'Deleting…' : 'Delete driver'}
          </button>
          <button
            ref={cancelRef}
            type="button"
            onClick={() => onDone('cancel')}
            disabled={isPending}
            className="flex-1 h-11 border border-zinc-300 rounded-full px-5 py-2 text-sm text-zinc-700
                       hover:bg-zinc-50 transition-colors disabled:opacity-60 disabled:cursor-not-allowed"
          >
            Keep driver
          </button>
        </div>
      </div>
    </div>
  );
}
