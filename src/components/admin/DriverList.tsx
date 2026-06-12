'use client';

import { useState, useTransition } from 'react';
import type { DriverRow } from '@/types/database';
import { setDriverActive } from '@/app/actions/drivers';
import { DriverModal } from './DriverModal';
import { DeleteConfirmDialog } from './DeleteConfirmDialog';
import { Toast } from './Toast';

// WR-05: phone_e164_display holds the masked phone for list rendering.
// phone_e164 (raw) is retained so DriverModal can pre-populate the edit field.
type DriverListRow = DriverRow & { phone_e164_display: string };

interface Props {
  drivers: DriverListRow[];
}

type ToastState = {
  message: string;
  variant?: 'default' | 'error';
} | null;

type ModalState =
  | { type: 'add' }
  | { type: 'edit'; driver: DriverRow }
  | { type: 'delete'; driver: DriverRow }
  | null;

export function DriverList({ drivers }: Props) {
  const [modal, setModal] = useState<ModalState>(null);
  const [toast, setToast] = useState<ToastState>(null);
  const [isPending, startTransition] = useTransition();

  function showToast(message: string, variant: 'default' | 'error' = 'default') {
    setToast({ message, variant });
  }

  function handleDeactivate(driver: DriverRow) {
    const nextActive = !driver.active;
    startTransition(async () => {
      const result = await setDriverActive(driver.id, nextActive);
      if (result?.error) {
        showToast(result.error, 'error');
      } else {
        showToast(nextActive ? 'Driver activated' : 'Driver deactivated');
      }
    });
  }

  function handleModalClose(outcome: 'saved' | 'cancel') {
    setModal(null);
    if (outcome === 'saved') showToast('Driver saved');
  }

  function handleDeleteDone(outcome: 'deleted' | 'cancel' | 'error', errorMessage?: string) {
    setModal(null);
    if (outcome === 'deleted') showToast('Driver deleted');
    // WR-02: surface delete errors via toast instead of silently swallowing them
    if (outcome === 'error') showToast(errorMessage ?? 'Failed to delete driver', 'error');
  }

  // ---------- Empty state ----------
  if (drivers.length === 0) {
    return (
      <div>
        <div className="flex items-center justify-between mb-6">
          <div /> {/* spacer */}
          <button
            type="button"
            onClick={() => setModal({ type: 'add' })}
            className="bg-accent text-white rounded-full px-5 py-2 text-sm font-semibold
                       hover:bg-accent/90 transition-colors min-h-[44px]"
          >
            Add driver
          </button>
        </div>
        <div className="text-center py-16">
          <p className="text-base font-semibold text-zinc-900 mb-2">No drivers yet</p>
          <p className="text-sm text-zinc-500 mb-6">
            Add your first driver to enable outbound call escalation in Phase 4.
          </p>
          <button
            type="button"
            onClick={() => setModal({ type: 'add' })}
            className="bg-accent text-white rounded-full px-5 py-2 text-sm font-semibold
                       hover:bg-accent/90 transition-colors min-h-[44px]"
          >
            Add driver
          </button>
        </div>

        {modal?.type === 'add' && <DriverModal onClose={handleModalClose} />}
        {toast && (
          <Toast message={toast.message} variant={toast.variant} onDone={() => setToast(null)} />
        )}
      </div>
    );
  }

  // ---------- Populated state ----------
  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div /> {/* spacer */}
        <button
          type="button"
          onClick={() => setModal({ type: 'add' })}
          className="bg-accent text-white rounded-full px-5 py-2 text-sm font-semibold
                     hover:bg-accent/90 transition-colors min-h-[44px]"
        >
          Add driver
        </button>
      </div>

      {/* Desktop table */}
      <div className="hidden md:block border border-zinc-200 rounded-xl overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-zinc-50 border-b border-zinc-200">
            <tr>
              <th className="text-left px-4 py-3 text-sm font-semibold text-zinc-700">Name</th>
              <th className="text-left px-4 py-3 text-sm font-semibold text-zinc-700">Phone</th>
              <th className="text-left px-4 py-3 text-sm font-semibold text-zinc-700">Status</th>
              <th className="text-left px-4 py-3 text-sm font-semibold text-zinc-700">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-zinc-100">
            {drivers.map((driver) => (
              <tr key={driver.id} className="hover:bg-zinc-50 transition-colors">
                <td className="px-4 py-3 text-zinc-900">{driver.name}</td>
                <td className="px-4 py-3 font-mono text-zinc-600">{driver.phone_e164_display}</td>
                <td className="px-4 py-3">
                  {driver.active ? (
                    <span
                      className="inline-flex items-center rounded-full px-2 py-0.5 text-sm font-semibold bg-green-100 text-green-600"
                      aria-label="Status: Active"
                    >
                      Active
                    </span>
                  ) : (
                    <span
                      className="inline-flex items-center rounded-full px-2 py-0.5 text-sm font-semibold bg-zinc-100 text-zinc-500"
                      aria-label="Status: Inactive"
                    >
                      Inactive
                    </span>
                  )}
                </td>
                <td className="px-4 py-3">
                  <div className="flex items-center gap-4">
                    <button
                      type="button"
                      onClick={() => setModal({ type: 'edit', driver })}
                      className="text-accent text-sm min-h-[44px] px-1 hover:underline"
                    >
                      Edit
                    </button>
                    <button
                      type="button"
                      onClick={() => handleDeactivate(driver)}
                      disabled={isPending}
                      className="text-zinc-600 text-sm min-h-[44px] px-1 hover:underline disabled:opacity-50"
                    >
                      {driver.active ? 'Deactivate' : 'Activate'}
                    </button>
                    <button
                      type="button"
                      onClick={() => setModal({ type: 'delete', driver })}
                      className="text-red-600 text-sm min-h-[44px] px-1 hover:underline"
                    >
                      Delete
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Mobile stacked cards */}
      <div className="md:hidden flex flex-col gap-3">
        {drivers.map((driver) => (
          <div key={driver.id} className="border border-zinc-200 rounded-lg p-4">
            <div className="flex items-start justify-between mb-2">
              <div>
                <p className="font-semibold text-zinc-900">{driver.name}</p>
                <p className="font-mono text-sm text-zinc-600 mt-0.5">{driver.phone_e164_display}</p>
              </div>
              {driver.active ? (
                <span
                  className="inline-flex items-center rounded-full px-2 py-0.5 text-sm font-semibold bg-green-100 text-green-600"
                  aria-label="Status: Active"
                >
                  Active
                </span>
              ) : (
                <span
                  className="inline-flex items-center rounded-full px-2 py-0.5 text-sm font-semibold bg-zinc-100 text-zinc-500"
                  aria-label="Status: Inactive"
                >
                  Inactive
                </span>
              )}
            </div>
            <div className="flex items-center gap-4 mt-3 pt-3 border-t border-zinc-100">
              <button
                type="button"
                onClick={() => setModal({ type: 'edit', driver })}
                className="text-accent text-sm min-h-[44px] px-1 hover:underline"
              >
                Edit
              </button>
              <button
                type="button"
                onClick={() => handleDeactivate(driver)}
                disabled={isPending}
                className="text-zinc-600 text-sm min-h-[44px] px-1 hover:underline disabled:opacity-50"
              >
                {driver.active ? 'Deactivate' : 'Activate'}
              </button>
              <button
                type="button"
                onClick={() => setModal({ type: 'delete', driver })}
                className="text-red-600 text-sm min-h-[44px] px-1 hover:underline"
              >
                Delete
              </button>
            </div>
          </div>
        ))}
      </div>

      {/* Modals */}
      {modal?.type === 'add' && <DriverModal onClose={handleModalClose} />}
      {modal?.type === 'edit' && (
        <DriverModal driver={modal.driver} onClose={handleModalClose} />
      )}
      {modal?.type === 'delete' && (
        <DeleteConfirmDialog
          driverId={modal.driver.id}
          driverName={modal.driver.name}
          onDone={handleDeleteDone}
        />
      )}

      {/* Toast */}
      {toast && (
        <Toast message={toast.message} variant={toast.variant} onDone={() => setToast(null)} />
      )}
    </div>
  );
}
