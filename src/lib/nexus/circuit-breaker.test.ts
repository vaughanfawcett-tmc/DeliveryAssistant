import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { createBreaker } from './circuit-breaker';

describe('Circuit Breaker', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('passes through a successful call unchanged (circuit closed)', async () => {
    const fn = vi.fn().mockResolvedValue('success-value');
    const fallback = vi.fn().mockReturnValue('fallback-value');

    const breaker = createBreaker(fn, fallback, {
      volumeThreshold: 5,
      errorThresholdPercentage: 50,
      timeoutMs: 5000,
      resetTimeoutMs: 30000,
    });

    const result = await breaker('arg1');

    expect(result).toBe('success-value');
    expect(fn).toHaveBeenCalledWith('arg1');
    expect(fallback).not.toHaveBeenCalled();
  });

  it('opens the circuit after volumeThreshold calls with >= 50% failures, and short-circuits subsequent calls', async () => {
    const fn = vi.fn().mockRejectedValue(new Error('nexus error'));
    const fallback = vi.fn().mockReturnValue('fallback-value');

    const breaker = createBreaker(fn, fallback, {
      volumeThreshold: 5,
      errorThresholdPercentage: 50,
      timeoutMs: 5000,
      resetTimeoutMs: 30000,
    });

    // Make 5 failing calls to reach volumeThreshold
    for (let i = 0; i < 5; i++) {
      await breaker();
    }

    // Circuit should now be open — next call must NOT invoke fn
    const callCountBeforeShortCircuit = fn.mock.calls.length;
    const result = await breaker();

    expect(fn.mock.calls.length).toBe(callCountBeforeShortCircuit); // fn not called again
    expect(result).toBe('fallback-value');
  });

  it('counts a rejected call as a failure and returns fallback while circuit is open', async () => {
    const error = new Error('5xx error');
    const fn = vi.fn().mockRejectedValue(error);
    const fallback = vi.fn().mockReturnValue('fallback-value');

    const breaker = createBreaker(fn, fallback, {
      volumeThreshold: 3,
      errorThresholdPercentage: 100, // 100% failures → open immediately at threshold
      timeoutMs: 5000,
      resetTimeoutMs: 30000,
    });

    // Three failures → open circuit
    for (let i = 0; i < 3; i++) {
      const result = await breaker();
      // While closed + failing, the breaker should still return fallback for errors
      expect(result).toBe('fallback-value');
    }

    // Now open — next call must return fallback, not throw
    const result = await breaker();
    expect(result).toBe('fallback-value');
    // fn should have been called exactly 3 times, not 4 (open circuit skips fn)
    expect(fn).toHaveBeenCalledTimes(3);
  });

  it('treats a timed-out call as a failure', async () => {
    const timeoutMs = 5000;
    // fn that never resolves (simulating hang)
    const fn = vi.fn().mockImplementation(() => new Promise(() => {}));
    const fallback = vi.fn().mockReturnValue('timeout-fallback');

    const breaker = createBreaker(fn, fallback, {
      volumeThreshold: 5,
      errorThresholdPercentage: 50,
      timeoutMs,
      resetTimeoutMs: 30000,
    });

    // Start a call that will time out
    const resultPromise = breaker();

    // Advance fake timers past the timeout
    await vi.advanceTimersByTimeAsync(timeoutMs + 100);

    const result = await resultPromise;

    // Should have returned fallback, not thrown
    expect(result).toBe('timeout-fallback');
    expect(fallback).toHaveBeenCalled();
  });

  it('enters half-open after resetTimeout and closes on success', async () => {
    const resetTimeoutMs = 30000;
    let callCount = 0;

    // First N calls fail, then succeed (simulates recovery)
    const fn = vi.fn().mockImplementation(() => {
      callCount++;
      if (callCount <= 5) {
        return Promise.reject(new Error('fail'));
      }
      return Promise.resolve('recovered');
    });
    const fallback = vi.fn().mockReturnValue('fallback-value');

    const breaker = createBreaker(fn, fallback, {
      volumeThreshold: 5,
      errorThresholdPercentage: 50,
      timeoutMs: 5000,
      resetTimeoutMs,
    });

    // Trip the circuit — 5 failures
    for (let i = 0; i < 5; i++) {
      await breaker();
    }

    // Circuit is open — call returns fallback without calling fn
    const openResult = await breaker();
    expect(openResult).toBe('fallback-value');
    expect(fn).toHaveBeenCalledTimes(5); // not 6

    // Advance time past resetTimeout → half-open
    await vi.advanceTimersByTimeAsync(resetTimeoutMs + 100);

    // Next call in half-open: fn succeeds → circuit closes
    const halfOpenResult = await breaker();
    expect(halfOpenResult).toBe('recovered');
    expect(fn).toHaveBeenCalledTimes(6); // one probe call in half-open

    // Circuit is now closed — subsequent calls go through normally
    const closedResult = await breaker();
    expect(closedResult).toBe('recovered');
    expect(fn).toHaveBeenCalledTimes(7);
  });
});
