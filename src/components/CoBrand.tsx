import Image from 'next/image';

/**
 * Co-brand lockup — Derbyshire Specialist Aggregates alongside The AI Agency,
 * shown large and side-by-side on the admin dashboard.
 */
export function CoBrand() {
  return (
    <div className="flex items-center gap-4 sm:gap-6">
      <Image
        src="/derby-logo.png"
        alt="Derbyshire Specialist Aggregates"
        width={435}
        height={96}
        priority
        style={{ height: 44, width: 'auto' }}
      />
      <span className="h-12 w-px bg-zinc-200" aria-hidden />
      <div className="flex items-center gap-2">
        <Image
          src="/ai-agency-logo.png"
          alt="The AI Agency"
          width={1200}
          height={1200}
          style={{ height: 48, width: 'auto' }}
        />
        <span className="text-sm font-semibold leading-tight text-zinc-700">
          The AI
          <br />
          Agency
        </span>
      </div>
    </div>
  );
}
