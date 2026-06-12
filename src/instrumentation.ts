/**
 * Next.js instrumentation hook.
 *
 * Activates the MSW request interceptor at runtime when the app is running in
 * mock mode (PALLEX_MOCK=true). Without this, mock mode only works inside the
 * test runner (where each suite calls `server.listen()` itself) — a running
 * `next dev` / `next start` process would still attempt real Nexus HTTP calls
 * and fail because no live Pall-Ex credentials are issued yet.
 *
 * This makes the whole product (portal, dashboard, voice lookup tool) actually
 * demonstrable against mocks until the Phase 4 live cutover swaps PALLEX_MOCK
 * to false. Runs only in the Node.js runtime (not Edge/middleware).
 */
export async function register() {
  if (
    process.env.NEXT_RUNTIME === 'nodejs' &&
    process.env.PALLEX_MOCK === 'true'
  ) {
    const { server } = await import('./mocks/server');
    // 'bypass' so non-Nexus traffic (Supabase, Redis, telephony) passes through
    // untouched — only the mocked Pall-Ex URLs are intercepted.
    server.listen({ onUnhandledRequest: 'bypass' });
  }
}
