'use client';

import { useEffect } from 'react';

interface Props {
  message: string;
  variant?: 'default' | 'error';
  onDone: () => void;
}

export function Toast({ message, variant = 'default', onDone }: Props) {
  useEffect(() => {
    const timer = setTimeout(onDone, 3000);
    return () => clearTimeout(timer);
  }, [onDone]);

  return (
    <div
      role="status"
      aria-live="polite"
      className={`fixed bottom-4 left-1/2 -translate-x-1/2 text-sm rounded-full px-4 py-2 z-50 shadow-lg
        ${variant === 'error' ? 'bg-red-600 text-white' : 'bg-zinc-900 text-white'}`}
    >
      {message}
    </div>
  );
}
