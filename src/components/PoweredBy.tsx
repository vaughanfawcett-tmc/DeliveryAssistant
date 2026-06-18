import Image from 'next/image';

/**
 * Small "Powered by The AI Agency" credit for customer-facing pages.
 */
export function PoweredBy({ className = '' }: { className?: string }) {
  return (
    <span className={`inline-flex items-center gap-1.5 text-xs text-zinc-400 ${className}`}>
      Powered by
      <Image
        src="/ai-agency-logo.png"
        alt=""
        width={1200}
        height={1200}
        style={{ height: 16, width: 'auto' }}
      />
      <span className="font-medium text-zinc-500">The AI Agency</span>
    </span>
  );
}
