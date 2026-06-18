import Image from 'next/image';
import Link from 'next/link';

interface LogoProps {
  /** Where the logo links to. Public site → home; admin → dashboard. */
  href?: string;
  className?: string;
  /** Eager-load above the fold (set on the primary header logo). */
  priority?: boolean;
  /** Rendered height in px (width scales to keep aspect ratio). */
  height?: number;
}

/**
 * Derbyshire Specialist Aggregates wordmark (official logo asset).
 * Single source of truth for the brand mark across the app.
 */
export function Logo({ href = '/', className = '', priority = false, height = 36 }: LogoProps) {
  return (
    <Link
      href={href}
      aria-label="Derbyshire Specialist Aggregates — home"
      className={`inline-flex items-center ${className}`}
    >
      <Image
        src="/derby-logo.png"
        alt="Derbyshire Specialist Aggregates"
        width={435}
        height={96}
        priority={priority}
        style={{ height, width: 'auto' }}
      />
    </Link>
  );
}
