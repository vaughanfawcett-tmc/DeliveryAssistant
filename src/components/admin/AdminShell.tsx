'use client';

import { useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { logoutAction } from '@/app/actions/auth';

const NAV_LINKS = [
  { href: '/dashboard', label: 'Metrics' },
  { href: '/dashboard/calls', label: 'Call history' },
  { href: '/dashboard/drivers', label: 'Drivers' },
];

interface Props {
  children: React.ReactNode;
}

export function AdminShell({ children }: Props) {
  const [drawerOpen, setDrawerOpen] = useState(false);
  const pathname = usePathname();

  function isActive(href: string) {
    // /dashboard is only active for exact match to avoid it matching all sub-routes
    if (href === '/dashboard') return pathname === '/dashboard';
    return pathname.startsWith(href);
  }

  const navLinkClass = (href: string) =>
    `flex items-center min-h-[44px] px-4 text-sm font-semibold rounded-md transition-colors
     ${
       isActive(href)
         ? 'text-accent border-l-2 border-accent bg-zinc-50'
         : 'text-zinc-600 hover:text-zinc-900 hover:bg-zinc-50 border-l-2 border-transparent'
     }`;

  const sidebarContent = (
    <div className="flex flex-col h-full">
      {/* Wordmark */}
      <div className="px-4 py-6">
        <span className="text-xl font-semibold text-zinc-900">Derby Aggregates</span>
      </div>

      {/* Nav */}
      <nav aria-label="Dashboard" className="flex-1 px-2 space-y-1">
        {NAV_LINKS.map(({ href, label }) => (
          <Link
            key={href}
            href={href}
            className={navLinkClass(href)}
            onClick={() => setDrawerOpen(false)}
          >
            {label}
          </Link>
        ))}
      </nav>

      {/* Logout */}
      <div className="px-4 py-6 border-t border-zinc-200">
        <form action={logoutAction}>
          <button
            type="submit"
            className="w-full flex items-center min-h-[44px] px-4 text-sm font-semibold text-zinc-600 hover:text-zinc-900 hover:bg-zinc-50 rounded-md transition-colors"
          >
            Log out
          </button>
        </form>
      </div>
    </div>
  );

  return (
    <div className="min-h-full flex">
      {/* Desktop sidebar */}
      <aside className="hidden lg:flex lg:flex-col lg:fixed lg:inset-y-0 lg:w-60 border-r border-zinc-200 bg-background">
        {sidebarContent}
      </aside>

      {/* Mobile drawer overlay */}
      {drawerOpen && (
        <div
          className="fixed inset-0 z-30 bg-black/40 lg:hidden"
          onClick={() => setDrawerOpen(false)}
          aria-hidden="true"
        />
      )}

      {/* Mobile drawer panel */}
      <aside
        className={`fixed inset-y-0 left-0 z-40 w-60 bg-background border-r border-zinc-200 transform transition-transform duration-200 ease-in-out lg:hidden
          ${drawerOpen ? 'translate-x-0' : '-translate-x-full'}`}
        aria-hidden={!drawerOpen}
      >
        {sidebarContent}
      </aside>

      {/* Main content */}
      <div className="flex flex-col flex-1 lg:pl-60">
        {/* Mobile top bar */}
        <header className="flex items-center gap-4 px-4 h-14 border-b border-zinc-200 bg-background lg:hidden">
          <button
            type="button"
            aria-label="Open navigation menu"
            onClick={() => setDrawerOpen(true)}
            className="flex items-center justify-center min-w-[44px] min-h-[44px] rounded-md text-zinc-600 hover:text-zinc-900 hover:bg-zinc-50 transition-colors"
          >
            {/* Hamburger icon */}
            <svg
              width="20"
              height="20"
              viewBox="0 0 20 20"
              fill="none"
              aria-hidden="true"
            >
              <path
                d="M3 5h14M3 10h14M3 15h14"
                stroke="currentColor"
                strokeWidth="1.5"
                strokeLinecap="round"
              />
            </svg>
          </button>
          <span className="text-base font-semibold text-zinc-900">Derby Aggregates</span>
        </header>

        {/* Page content */}
        <main className="flex-1 overflow-y-auto px-4 lg:px-8 py-8">{children}</main>
      </div>
    </div>
  );
}
