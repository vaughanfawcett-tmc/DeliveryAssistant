'use client';

import { useCallback, useRef } from 'react';
import { useRouter, useSearchParams, usePathname } from 'next/navigation';

interface ActiveFilter {
  key: string;
  label: string;
}

export function CallFilters() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const pathname = usePathname();
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const setParam = useCallback(
    (key: string, value: string) => {
      const params = new URLSearchParams(searchParams.toString());
      if (value) {
        params.set(key, value);
      } else {
        params.delete(key);
      }
      // Always reset to page 1 when filters change
      params.delete('page');
      router.push(`${pathname}?${params.toString()}`);
    },
    [searchParams, pathname, router],
  );

  const handleSearchChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const value = e.target.value;
      if (debounceRef.current) clearTimeout(debounceRef.current);
      debounceRef.current = setTimeout(() => {
        setParam('q', value);
      }, 300);
    },
    [setParam],
  );

  const removeFilter = useCallback(
    (key: string) => {
      setParam(key, '');
    },
    [setParam],
  );

  // Build active filter chips
  const activeFilters: ActiveFilter[] = [];
  const fromVal = searchParams.get('from');
  const toVal = searchParams.get('to');
  const outcomeVal = searchParams.get('outcome');
  const qVal = searchParams.get('q');

  if (fromVal) activeFilters.push({ key: 'from', label: `From: ${fromVal}` });
  if (toVal) activeFilters.push({ key: 'to', label: `To: ${toVal}` });
  if (outcomeVal) activeFilters.push({ key: 'outcome', label: `Outcome: ${outcomeVal}` });
  if (qVal) activeFilters.push({ key: 'q', label: `Search: ${qVal}` });

  return (
    <div className="flex flex-col gap-3 mb-4">
      <div className="flex flex-wrap gap-3">
        {/* Date range */}
        <div className="flex flex-col gap-1">
          <label htmlFor="filter-from" className="text-sm font-semibold text-zinc-700">
            Date range
          </label>
          <div className="flex gap-2 items-center">
            <input
              id="filter-from"
              type="date"
              defaultValue={fromVal ?? ''}
              onChange={(e) => setParam('from', e.target.value)}
              className="text-sm border border-zinc-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-accent"
            />
            <span className="text-sm text-zinc-500">to</span>
            <input
              id="filter-to"
              type="date"
              defaultValue={toVal ?? ''}
              onChange={(e) => setParam('to', e.target.value)}
              className="text-sm border border-zinc-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-accent"
            />
          </div>
        </div>

        {/* Outcome filter */}
        <div className="flex flex-col gap-1">
          <label htmlFor="filter-outcome" className="text-sm font-semibold text-zinc-700">
            Outcome
          </label>
          <select
            id="filter-outcome"
            defaultValue={outcomeVal ?? ''}
            onChange={(e) => setParam('outcome', e.target.value)}
            className="text-sm border border-zinc-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-accent bg-white"
          >
            <option value="">All outcomes</option>
            <option value="resolved">Resolved</option>
            <option value="no_data">Missed</option>
            <option value="escalated">Escalated</option>
            <option value="failed">Failed</option>
          </select>
        </div>

        {/* Search input */}
        <div className="flex flex-col gap-1">
          <label htmlFor="filter-search" className="text-sm font-semibold text-zinc-700">
            Search
          </label>
          <input
            id="filter-search"
            type="text"
            defaultValue={qVal ?? ''}
            onChange={handleSearchChange}
            placeholder="Search tracking reference…"
            className="text-sm border border-zinc-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-accent min-w-[220px]"
          />
        </div>
      </div>

      {/* Active filter chips */}
      {activeFilters.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {activeFilters.map((filter) => (
            <span
              key={filter.key}
              className="inline-flex items-center gap-1 bg-accent/10 text-accent text-sm font-semibold rounded-full px-3 py-1"
            >
              {filter.label}
              <button
                type="button"
                onClick={() => removeFilter(filter.key)}
                aria-label="Remove filter"
                className="ml-1 hover:opacity-70 leading-none"
              >
                ×
              </button>
            </span>
          ))}
        </div>
      )}
    </div>
  );
}
