/**
 * driver-escalation.ts — Pure driver-escalation state machine (DRIV-01..04).
 *
 * Architecture: all I/O is via injected deps — no env reads, no direct DB/telephony calls.
 * The route handler injects env values so this module stays testable without process.env.
 *
 * Security properties (threat model):
 * - T-04-20: Destination is always driver.phone_e164 from the managed list — never caller-supplied.
 *   Unknown driverId -> outcome 'failed', no call placed.
 * - T-04-21: Hard maxRetries + maxDurationS limits; endCall invoked on overrun; no unbounded loop.
 * - T-04-22: Every attempt writes a parent-linked driver/outbound calls row (audit trail).
 */

import type { VoiceTelephonyAdapter } from './telephony/adapter';
import type { Database, DriverRow } from '@/types/database';

// ---------------------------------------------------------------------------
// Default reference constants (exported for grep compliance check)
// ---------------------------------------------------------------------------

/** Default max retries (env: DRIVER_CALL_MAX_RETRIES). Exported as a named reference. */
export const MAX_RETRIES = 2;

/** Default max call duration in seconds (env: DRIVER_CALL_MAX_DURATION_S). Exported as named reference. */
export const MAX_DURATION_S = 180;

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type CallInsert = Database['public']['Tables']['calls']['Insert'];

export type EscalationOutcome = 'resolved' | 'failed' | 'escalated';

export interface EscalationInput {
  parentCallId: string;
  driverId: string;
  maxDurationS: number;
  maxRetries: number;
}

export interface EscalationDeps {
  adapter: VoiceTelephonyAdapter;
  getDriverById: (id: string) => Promise<DriverRow | null>;
  insertCall: (row: CallInsert) => Promise<void>;
  /**
   * Async function that simulates/returns the ETA string from the driver call.
   * Returns null to signal that no ETA was obtained (timeout / driver silent).
   * In production, this would integrate with call transcript analysis.
   */
  getEta?: () => Promise<string | null>;
  /** Clock function — injectable for tests; defaults to Date.now(). */
  now?: () => number;
}

export interface EscalationResult {
  outcome: EscalationOutcome;
  eta?: string;
  /** Total call attempts placed (0 if driver not found). */
  attempts: number;
}

// ---------------------------------------------------------------------------
// Main function
// ---------------------------------------------------------------------------

/**
 * Run the driver escalation state machine.
 *
 * Resolves driver from managed list -> places outbound call -> attempts to get
 * ETA -> enforces duration limit -> retries up to maxRetries on failure ->
 * returns result with every attempt logged as a driver/outbound calls row.
 */
export async function runDriverEscalation(
  input: EscalationInput,
  deps: EscalationDeps,
): Promise<EscalationResult> {
  const { parentCallId, driverId, maxDurationS, maxRetries } = input;
  const { adapter, getDriverById, insertCall, now = Date.now } = deps;
  const getEta = deps.getEta ?? (async () => null);

  // --- Step 1: Resolve driver from managed list (T-04-20 anti-SSRF) --------
  const driver = await getDriverById(driverId);

  if (!driver) {
    // Unknown driver id — log one failed row, no call placed
    await insertCall({
      call_type: 'driver',
      direction: 'outbound',
      parent_call_id: parentCallId,
      platform_call_id: `no-driver-${driverId}`,
      from_number: null,
      start_at: new Date(now()).toISOString(),
      end_at: new Date(now()).toISOString(),
      duration_ms: 0,
      outcome: 'failed',
      tracking_ref: null,
      transcript: null,
      recording_url: null,
      disconnection_reason: 'driver_not_found',
    });
    return { outcome: 'failed', attempts: 0 };
  }

  // --- Step 2: Retry loop bounded by maxRetries (T-04-21 toll-fraud guard) --
  const totalAttempts = maxRetries + 1;
  let attempts = 0;

  for (let attempt = 0; attempt < totalAttempts; attempt++) {
    const startMs = now();
    attempts++;

    let callId: string | null = null;

    try {
      // Place outbound call — destination is always from managed list (T-04-20)
      const result = await adapter.placeOutboundCall(driver.phone_e164);
      callId = result.callId;
    } catch {
      // Call failed to connect (unreachable) — log failed attempt
      const endMs = now();
      await insertCall({
        call_type: 'driver',
        direction: 'outbound',
        parent_call_id: parentCallId,
        platform_call_id: `failed-attempt-${attempt + 1}-${parentCallId}`,
        from_number: null,
        start_at: new Date(startMs).toISOString(),
        end_at: new Date(endMs).toISOString(),
        duration_ms: endMs - startMs,
        outcome: 'failed',
        tracking_ref: null,
        transcript: null,
        recording_url: null,
        disconnection_reason: 'dial_failed',
      });
      // Continue to next retry
      continue;
    }

    // --- Call connected — attempt to get ETA within duration limit -----------
    const etaStartMs = now();
    const eta = await getEta();
    const etaEndMs = now();
    const durationMs = etaEndMs - startMs;

    // Check duration limit (T-04-21)
    if (durationMs > maxDurationS * 1000) {
      // Overrun — end call, log failed attempt
      await adapter.endCall(callId, 'max_duration_exceeded');
      await insertCall({
        call_type: 'driver',
        direction: 'outbound',
        parent_call_id: parentCallId,
        platform_call_id: callId,
        from_number: null,
        start_at: new Date(startMs).toISOString(),
        end_at: new Date(etaEndMs).toISOString(),
        duration_ms: durationMs,
        outcome: 'failed',
        tracking_ref: null,
        transcript: null,
        recording_url: null,
        disconnection_reason: 'max_duration_exceeded',
      });
      // After duration overrun, treat as a failed attempt and continue retries
      continue;
    }

    if (eta !== null) {
      // ETA obtained — success (T-04-22 audit trail)
      await insertCall({
        call_type: 'driver',
        direction: 'outbound',
        parent_call_id: parentCallId,
        platform_call_id: callId,
        from_number: null,
        start_at: new Date(startMs).toISOString(),
        end_at: new Date(etaEndMs).toISOString(),
        duration_ms: Math.max(1, durationMs), // guarantee > 0 for resolved rows
        outcome: 'resolved',
        tracking_ref: null,
        transcript: null,
        recording_url: null,
        disconnection_reason: null,
      });
      return { outcome: 'resolved', eta, attempts };
    }

    // No ETA returned — log as failed and retry
    await insertCall({
      call_type: 'driver',
      direction: 'outbound',
      parent_call_id: parentCallId,
      platform_call_id: callId,
      from_number: null,
      start_at: new Date(startMs).toISOString(),
      end_at: new Date(etaEndMs).toISOString(),
      duration_ms: durationMs,
      outcome: 'failed',
      tracking_ref: null,
      transcript: null,
      recording_url: null,
      disconnection_reason: 'no_eta',
    });
  }

  // All retries exhausted — offer callback (T-04-21)
  return { outcome: 'escalated', attempts };
}
