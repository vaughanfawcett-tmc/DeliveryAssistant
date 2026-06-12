import { describe, it, expect, beforeEach } from 'vitest';
import { MockTelephonyAdapter } from './mock-adapter';
import type { VoiceTelephonyAdapter } from './adapter';

describe('MockTelephonyAdapter', () => {
  let adapter: MockTelephonyAdapter;

  beforeEach(() => {
    adapter = new MockTelephonyAdapter();
  });

  it('satisfies the VoiceTelephonyAdapter interface (structural check)', () => {
    // TypeScript ensures this at compile time; this assertion keeps the runtime contract visible.
    const iface: VoiceTelephonyAdapter = adapter;
    expect(iface).toBeDefined();
  });

  describe('placeOutboundCall', () => {
    it('returns an incrementing mock callId', async () => {
      const r1 = await adapter.placeOutboundCall('+441332000001');
      const r2 = await adapter.placeOutboundCall('+441332000002');

      expect(r1.callId).toBe('mock-call-1');
      expect(r2.callId).toBe('mock-call-2');
    });

    it('records a placeOutboundCall event with the correct args', async () => {
      await adapter.placeOutboundCall('+441332000001', { agentId: 'agent-xyz' });

      expect(adapter.events).toHaveLength(1);
      expect(adapter.events[0].op).toBe('placeOutboundCall');
      expect(adapter.events[0].args).toEqual({ to: '+441332000001', opts: { agentId: 'agent-xyz' } });
    });

    it('records placeOutboundCall with no opts when omitted', async () => {
      await adapter.placeOutboundCall('+441332000001');

      expect(adapter.events[0].args).toEqual({ to: '+441332000001', opts: undefined });
    });
  });

  describe('failNextPlace (DRIV-03 callback simulation)', () => {
    it('rejects when failNextPlace is true', async () => {
      adapter.failNextPlace = true;

      await expect(adapter.placeOutboundCall('+441332000001')).rejects.toThrow(
        'Simulated dial failure',
      );
    });

    it('records a placeOutboundCall:fail event on rejection', async () => {
      adapter.failNextPlace = true;
      await adapter.placeOutboundCall('+441332000001').catch(() => {/* expected */});

      expect(adapter.events[0].op).toBe('placeOutboundCall:fail');
    });

    it('resets failNextPlace to false after rejecting once', async () => {
      adapter.failNextPlace = true;
      await adapter.placeOutboundCall('+441332000001').catch(() => {/* expected */});

      // Second call must succeed
      const result = await adapter.placeOutboundCall('+441332000001');
      expect(result.callId).toBe('mock-call-1'); // counter continues (fail doesn't increment)
    });

    it('succeeds on subsequent calls after one failure', async () => {
      adapter.failNextPlace = true;
      await adapter.placeOutboundCall('+441332000001').catch(() => {});

      const r = await adapter.placeOutboundCall('+441332000001');
      expect(r.callId).toMatch(/^mock-call-/);
      expect(adapter.failNextPlace).toBe(false);
    });
  });

  describe('endCall', () => {
    it('records an endCall event', async () => {
      await adapter.endCall('mock-call-1', 'conversation ended');

      expect(adapter.events).toHaveLength(1);
      expect(adapter.events[0]).toEqual({
        op: 'endCall',
        args: { callId: 'mock-call-1', reason: 'conversation ended' },
      });
    });

    it('records endCall with no reason when omitted', async () => {
      await adapter.endCall('mock-call-1');

      expect(adapter.events[0].args).toEqual({ callId: 'mock-call-1', reason: undefined });
    });
  });

  describe('transferToHuman', () => {
    it('records a transferToHuman event', async () => {
      await adapter.transferToHuman('mock-call-1', '+441332999999', 'Driver unreachable');

      expect(adapter.events).toHaveLength(1);
      expect(adapter.events[0]).toEqual({
        op: 'transferToHuman',
        args: { callId: 'mock-call-1', toNumber: '+441332999999', summary: 'Driver unreachable' },
      });
    });
  });

  describe('sendDtmf', () => {
    it('records a sendDtmf event', async () => {
      await adapter.sendDtmf('mock-call-1', '1#');

      expect(adapter.events).toHaveLength(1);
      expect(adapter.events[0]).toEqual({
        op: 'sendDtmf',
        args: { callId: 'mock-call-1', digits: '1#' },
      });
    });
  });

  describe('event accumulation', () => {
    it('accumulates events across multiple operations', async () => {
      const { callId } = await adapter.placeOutboundCall('+441332000001');
      await adapter.sendDtmf(callId, '1');
      await adapter.endCall(callId, 'done');

      expect(adapter.events).toHaveLength(3);
      expect(adapter.events.map((e) => e.op)).toEqual([
        'placeOutboundCall',
        'sendDtmf',
        'endCall',
      ]);
    });
  });

  describe('reset()', () => {
    it('clears events and resets the counter', async () => {
      await adapter.placeOutboundCall('+441332000001');
      adapter.reset();

      expect(adapter.events).toHaveLength(0);
      const r = await adapter.placeOutboundCall('+441332000001');
      expect(r.callId).toBe('mock-call-1'); // counter restarted
    });
  });
});
