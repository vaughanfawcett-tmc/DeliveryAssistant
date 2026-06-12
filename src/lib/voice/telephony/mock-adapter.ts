/**
 * mock-adapter.ts — In-memory MockTelephonyAdapter for tests and dev.
 *
 * Satisfies VoiceTelephonyAdapter with zero network I/O.
 * Records every operation in `events` so tests can make assertions about what
 * the calling code did without inspecting real platform responses.
 *
 * Usage in tests:
 *   const adapter = new MockTelephonyAdapter();
 *   const { callId } = await adapter.placeOutboundCall('+441332123456');
 *   expect(adapter.events[0]).toEqual({ op: 'placeOutboundCall', args: { to: '+441332123456', opts: undefined } });
 *
 * Simulating an unreachable driver (DRIV-03 callback path):
 *   adapter.failNextPlace = true;
 *   await expect(adapter.placeOutboundCall('+441332123456')).rejects.toThrow();
 *   // Next call succeeds normally and failNextPlace is reset to false.
 */

import type { VoiceTelephonyAdapter, OutboundCallResult } from './adapter';

export interface TelephonyEvent {
  op: string;
  args: unknown;
}

export class MockTelephonyAdapter implements VoiceTelephonyAdapter {
  /** All operations in call order — assert in tests. */
  readonly events: TelephonyEvent[] = [];

  /**
   * When true, the NEXT placeOutboundCall call will reject with a simulated
   * network/dial error and immediately reset to false.  Subsequent calls succeed
   * normally — allowing tests to check retry / callback recovery (DRIV-03).
   */
  failNextPlace = false;

  private _callCounter = 0;

  async placeOutboundCall(
    to: string,
    opts?: { agentId?: string },
  ): Promise<OutboundCallResult> {
    if (this.failNextPlace) {
      this.failNextPlace = false;
      this.events.push({ op: 'placeOutboundCall:fail', args: { to, opts } });
      throw new Error(`[MockTelephonyAdapter] Simulated dial failure for ${to}`);
    }

    const callId = `mock-call-${++this._callCounter}`;
    this.events.push({ op: 'placeOutboundCall', args: { to, opts } });
    return { callId };
  }

  async endCall(callId: string, reason?: string): Promise<void> {
    this.events.push({ op: 'endCall', args: { callId, reason } });
  }

  async transferToHuman(callId: string, toNumber: string, summary: string): Promise<void> {
    this.events.push({ op: 'transferToHuman', args: { callId, toNumber, summary } });
  }

  async sendDtmf(callId: string, digits: string): Promise<void> {
    this.events.push({ op: 'sendDtmf', args: { callId, digits } });
  }

  /** Reset state between tests without creating a new instance. */
  reset(): void {
    this.events.length = 0;
    this._callCounter = 0;
    this.failNextPlace = false;
  }
}
