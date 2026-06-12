'use client';

import { useActionState } from 'react';
import { loginAction } from '@/app/actions/auth';

export function LoginForm() {
  const [state, formAction, pending] = useActionState(loginAction, null);

  return (
    <div className="max-w-sm w-full border border-zinc-200 rounded-xl p-8 bg-background">
      <h1 className="text-xl font-semibold text-zinc-900 mb-6">Derby Aggs — Staff login</h1>
      <form action={formAction} className="flex flex-col gap-4">
        <div>
          <label
            htmlFor="password"
            className="block text-sm font-semibold text-zinc-700"
          >
            Password
          </label>
          <input
            id="password"
            name="password"
            type="password"
            required
            className="w-full rounded-lg border border-zinc-300 px-4 py-3 text-base mt-1
                       focus:outline-none focus:ring-2 focus:ring-accent"
          />
          {state?.error && (
            <p role="alert" className="text-sm text-red-600 mt-1">
              {state.error}
            </p>
          )}
        </div>
        <button
          type="submit"
          disabled={pending}
          className="w-full h-12 rounded-full bg-accent text-white font-semibold
                     transition-colors hover:bg-accent/90 disabled:opacity-60 disabled:cursor-not-allowed"
        >
          {pending ? 'Signing in…' : 'Sign in'}
        </button>
      </form>
    </div>
  );
}
