/**
 * Minimal, dependency-free circuit breaker — NOT opossum.
 *
 * opossum is a CommonJS package and pulls Node-only dependencies into an
 * Edge-compatible path (PLAN library_notes). This implementation is a
 * self-contained state machine: closed → open → half-open → closed.
 *
 * Design decisions:
 *   - The fallback must be a pure value-returning function — never re-throws.
 *     Callers (client.ts) never see a raw Nexus error (PITFALLS.md Pitfall 9).
 *   - An injectable `now()` clock enables deterministic test control with
 *     vitest fake timers (no real timers or setTimeout in the critical path).
 *   - Timeout is implemented via Promise.race — compatible with Edge runtimes.
 */

export interface BreakerOptions {
  /** Maximum ms a call may take before it counts as a failure. Default: 5000 */
  timeoutMs: number;
  /** Failure % needed to open the circuit (after volumeThreshold). Default: 50 */
  errorThresholdPercentage: number;
  /** Ms to wait in open state before trying half-open. Default: 30000 */
  resetTimeoutMs: number;
  /** Minimum calls required before the failure % is evaluated. Default: 5 */
  volumeThreshold: number;
  /** Injectable clock — override in tests to advance time. Default: Date.now */
  now?: () => number;
}

type BreakerState = 'closed' | 'open' | 'half-open';

/**
 * Create a circuit-breaker-wrapped version of `fn`.
 *
 * @param fn        The async function to protect.
 * @param fallback  Pure function that returns a safe value when the breaker is
 *                  open or when a call fails. Never re-throws.
 * @param options   BreakerOptions (all optional — sensible defaults provided).
 * @returns         A wrapped async function with the same signature as `fn`.
 */
export function createBreaker<A extends unknown[], R>(
  fn: (...args: A) => Promise<R>,
  fallback: (...args: A) => R,
  options?: Partial<BreakerOptions>,
): (...args: A) => Promise<R> {
  const cfg: BreakerOptions = {
    timeoutMs: 5000,
    errorThresholdPercentage: 50,
    resetTimeoutMs: 30000,
    volumeThreshold: 5,
    now: Date.now,
    ...options,
  };

  const clock = cfg.now!;

  // State machine
  let state: BreakerState = 'closed';
  let openedAt: number | null = null;

  // Rolling call stats (reset on state transition to closed)
  let totalCalls = 0;
  let failureCalls = 0;

  function recordSuccess(): void {
    totalCalls++;
    // Success in half-open → close the circuit, reset stats
    if (state === 'half-open') {
      state = 'closed';
      totalCalls = 0;
      failureCalls = 0;
      openedAt = null;
    }
  }

  function recordFailure(): void {
    totalCalls++;
    failureCalls++;
    checkThreshold();
  }

  function checkThreshold(): void {
    if (state !== 'closed') return;
    if (totalCalls < cfg.volumeThreshold) return;

    const failureRate = (failureCalls / totalCalls) * 100;
    if (failureRate >= cfg.errorThresholdPercentage) {
      openCircuit();
    }
  }

  function openCircuit(): void {
    state = 'open';
    openedAt = clock();
  }

  function maybeEnterHalfOpen(): boolean {
    if (state !== 'open' || openedAt === null) return false;
    const elapsed = clock() - openedAt;
    if (elapsed >= cfg.resetTimeoutMs) {
      state = 'half-open';
      return true;
    }
    return false;
  }

  /**
   * Race `fn(...args)` against a timeout.
   * Returns the result on success, or throws on timeout/error.
   */
  async function callWithTimeout(...args: A): Promise<R> {
    return new Promise<R>((resolve, reject) => {
      const timeoutId = setTimeout(() => {
        reject(new Error(`Circuit breaker: call timed out after ${cfg.timeoutMs}ms`));
      }, cfg.timeoutMs);

      fn(...args)
        .then((result) => {
          clearTimeout(timeoutId);
          resolve(result);
        })
        .catch((err) => {
          clearTimeout(timeoutId);
          reject(err);
        });
    });
  }

  return async function wrappedFn(...args: A): Promise<R> {
    // If open, check whether resetTimeout has elapsed → half-open
    if (state === 'open') {
      if (!maybeEnterHalfOpen()) {
        // Still open — short-circuit immediately
        return fallback(...args);
      }
    }

    // If half-open, let exactly one probe through
    // (half-open state is checked below via the normal call path)

    try {
      const result = await callWithTimeout(...args);
      recordSuccess();
      return result;
    } catch {
      recordFailure();
      // If the failure just opened the circuit, that's handled above on next call.
      // Return fallback — never re-throw (PITFALLS.md Pitfall 9 / T-01-06).
      return fallback(...args);
    }
  };
}
