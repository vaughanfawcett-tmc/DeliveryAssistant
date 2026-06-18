import { Logo } from './Logo';

/**
 * Public site header — brand logo on a clean white bar with a thin brand-teal
 * underline. Used on the customer-facing pages (home, share/track).
 */
export function SiteHeader() {
  return (
    <header className="sticky top-0 z-20 w-full border-b border-zinc-200 bg-white/90 backdrop-blur">
      <div className="mx-auto flex h-16 max-w-5xl items-center px-4 sm:px-6">
        <Logo priority />
      </div>
      {/* Brand accent strip */}
      <div className="h-0.5 w-full bg-accent" />
    </header>
  );
}
