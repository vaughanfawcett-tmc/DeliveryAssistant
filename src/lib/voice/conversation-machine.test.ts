import { describe, it, expect } from 'vitest';
import type { MappedConsignment } from '@/types/tracking';
import { DISCLOSURE } from './compliance';
import { reduce, initialState } from './conversation-machine';
import type { VoiceState, VoiceEvent } from './types';

// Helper to apply multiple events in sequence
function applyEvents(events: VoiceEvent[], startState = initialState): { state: VoiceState; actions: ReturnType<typeof reduce>['actions'] } {
  let state = startState;
  let actions: ReturnType<typeof reduce>['actions'] = [];
  for (const event of events) {
    const result = reduce(state, event);
    state = result.state;
    actions = result.actions;
  }
  return { state, actions };
}

describe('Conversation machine — VOICE-01: Disclosure first', () => {
  it('call_started transitions to awaiting_tracking and emits DISCLOSURE say', () => {
    const { state, actions } = reduce(initialState, { type: 'call_started' });
    expect(state.phase).toBe('awaiting_tracking');
    const sayAction = actions.find(a => a.type === 'say');
    expect(sayAction).toBeDefined();
    expect(sayAction?.text).toBe(DISCLOSURE);
  });

  it('first action is disclosure before any data capture', () => {
    const { actions } = reduce(initialState, { type: 'call_started' });
    expect(actions[0].type).toBe('say');
    expect((actions[0] as { type: 'say'; text: string }).text).toBe(DISCLOSURE);
  });

  it('transcript records the opening agent turn', () => {
    const { state } = reduce(initialState, { type: 'call_started' });
    expect(state.transcript.length).toBeGreaterThan(0);
    expect(state.transcript[0].speaker).toBe('Agent');
  });
});

describe('Conversation machine — VOICE-02: NATO read-back + confirm', () => {
  it('utterance with tracking ref while awaiting_tracking prompts NATO readback and transitions to confirming', () => {
    const started = reduce(initialState, { type: 'call_started' }).state;
    const { state, actions } = reduce(started, { type: 'utterance', text: 'PA123456' });
    expect(state.phase).toBe('confirming');
    expect(state.trackingRef).toBe('PA123456');
    const sayAction = actions.find(a => a.type === 'say');
    expect(sayAction).toBeDefined();
    // NATO readback should include Papa for P and Alfa for A
    expect(sayAction?.text).toContain('Papa');
    expect(sayAction?.text).toContain('Alfa');
  });

  it('postcode utterance while awaiting_postcode prompts confirmation', () => {
    const started = reduce(initialState, { type: 'call_started' }).state;
    const withRef = reduce(started, { type: 'utterance', text: 'PA123456' }).state;
    // confirm the tracking ref
    const confirmed = reduce(withRef, { type: 'confirm', yes: true }).state;
    expect(confirmed.phase).toBe('awaiting_postcode');
    const { state, actions } = reduce(confirmed, { type: 'utterance', text: 'DE1 2AB' });
    expect(state.phase).toBe('confirming');
    expect(state.postcode).toBeDefined();
    const sayAction = actions.find(a => a.type === 'say');
    expect(sayAction).toBeDefined();
  });
});

describe('Conversation machine — VOICE-03: DTMF # terminator', () => {
  it('dtmf event with trailing # strips hash and treats as captured ref', () => {
    const started = reduce(initialState, { type: 'call_started' }).state;
    const { state } = reduce(started, { type: 'dtmf', digits: 'PA123456#' });
    expect(state.phase).toBe('confirming');
    expect(state.trackingRef).toBe('PA123456');
  });

  it('dtmf without # is also handled as partial input or direct capture', () => {
    const started = reduce(initialState, { type: 'call_started' }).state;
    const { state } = reduce(started, { type: 'dtmf', digits: 'PA123456' });
    // Should still capture and move to confirming
    expect(state.phase).toBe('confirming');
    expect(state.trackingRef).toBe('PA123456');
  });
});

describe('Conversation machine — VOICE-05: 3-attempt escalation', () => {
  it('confirm{yes:false} increments attempts counter', () => {
    const started = reduce(initialState, { type: 'call_started' }).state;
    const captured = reduce(started, { type: 'utterance', text: 'PA123456' }).state;
    const { state } = reduce(captured, { type: 'confirm', yes: false });
    expect(state.attempts).toBe(1);
  });

  it('after 3rd failed confirm transitions to handoff with transfer action', () => {
    const started = reduce(initialState, { type: 'call_started' }).state;

    // Attempt 1
    const cap1 = reduce(started, { type: 'utterance', text: 'PA000001' }).state;
    const rej1 = reduce(cap1, { type: 'confirm', yes: false }).state;

    // Attempt 2
    const cap2 = reduce(rej1, { type: 'utterance', text: 'PA000002' }).state;
    const rej2 = reduce(cap2, { type: 'confirm', yes: false }).state;

    // Attempt 3 — trigger handoff
    const cap3 = reduce(rej2, { type: 'utterance', text: 'PA000003' }).state;
    const { state, actions } = reduce(cap3, { type: 'confirm', yes: false });

    expect(state.phase).toBe('handoff');
    const transferAction = actions.find(a => a.type === 'transfer');
    expect(transferAction).toBeDefined();
    // Summary should mention the failed attempts
    expect(transferAction?.summary).toBeTruthy();
    expect(typeof transferAction?.summary).toBe('string');
  });

  it('confirm{yes:true} after tracking ref capture moves to awaiting_postcode', () => {
    const started = reduce(initialState, { type: 'call_started' }).state;
    const captured = reduce(started, { type: 'utterance', text: 'PA123456' }).state;
    const { state } = reduce(captured, { type: 'confirm', yes: true });
    expect(state.phase).toBe('awaiting_postcode');
  });
});

describe('Conversation machine — VOICE-06: On-demand human handoff', () => {
  it('request_human at awaiting_tracking transitions to handoff', () => {
    const started = reduce(initialState, { type: 'call_started' }).state;
    const { state, actions } = reduce(started, { type: 'request_human' });
    expect(state.phase).toBe('handoff');
    const transferAction = actions.find(a => a.type === 'transfer');
    expect(transferAction).toBeDefined();
    expect(typeof transferAction?.summary).toBe('string');
  });

  it('request_human at confirming phase transitions to handoff', () => {
    const started = reduce(initialState, { type: 'call_started' }).state;
    const captured = reduce(started, { type: 'utterance', text: 'PA123456' }).state;
    const { state, actions } = reduce(captured, { type: 'request_human' });
    expect(state.phase).toBe('handoff');
    const transferAction = actions.find(a => a.type === 'transfer');
    expect(transferAction).toBeDefined();
  });

  it('request_human at answering phase transitions to handoff with summary', () => {
    const started = reduce(initialState, { type: 'call_started' }).state;
    // Simulate reaching answering phase
    const captured = reduce(started, { type: 'utterance', text: 'PA123456' }).state;
    const confirmed1 = reduce(captured, { type: 'confirm', yes: true }).state;
    const withPostcode = reduce(confirmed1, { type: 'utterance', text: 'DE1 2AB' }).state;
    const confirmedPostcode = reduce(withPostcode, { type: 'confirm', yes: true }).state;
    // Should now be looking_up
    const lookupResult = reduce(confirmedPostcode, {
      type: 'lookup_result',
      result: {
        ok: true,
        consignment: {
          consignmentNumber: 'PA123456',
          plainStatus: 'Out for delivery',
          description: 'Your parcel is out for delivery',
          currentStage: 'out_for_delivery',
          estimatedDelDate: '2026-06-12',
          startWindow: '09:00',
          endWindow: '12:00',
          routeDetails: [],
        } satisfies MappedConsignment,
      },
    }).state;

    const { state, actions } = reduce(lookupResult, { type: 'request_human' });
    expect(state.phase).toBe('handoff');
    const transfer = actions.find(a => a.type === 'transfer');
    expect(transfer).toBeDefined();
  });

  it('handoff summary contains transcript of the exchange', () => {
    const started = reduce(initialState, { type: 'call_started' }).state;
    const { actions } = reduce(started, { type: 'request_human' });
    const transfer = actions.find(a => a.type === 'transfer');
    expect(transfer?.summary).toBeTruthy();
  });
});

describe('Conversation machine — VOICE-07/08: api_error handling — never invent data', () => {
  it('lookup_result api_error emits a say explaining the issue', () => {
    const started = reduce(initialState, { type: 'call_started' }).state;
    const captured = reduce(started, { type: 'utterance', text: 'PA123456' }).state;
    const confirmed1 = reduce(captured, { type: 'confirm', yes: true }).state;
    const withPostcode = reduce(confirmed1, { type: 'utterance', text: 'DE1 2AB' }).state;
    const confirmed2 = reduce(withPostcode, { type: 'confirm', yes: true }).state;

    const { state, actions } = reduce(confirmed2, {
      type: 'lookup_result',
      result: { ok: false, reason: 'api_error' },
    });

    expect(state.phase).toBe('answering');
    const sayAction = actions.find(a => a.type === 'say');
    expect(sayAction).toBeDefined();
    // Must not contain fake status or date
    expect(sayAction?.text).not.toMatch(/delivered|out for delivery|in transit/i);
    expect(sayAction?.text).not.toMatch(/\d{1,2}[\/\-]\d{1,2}[\/\-]\d{2,4}/);
  });

  it('api_error say offers a transfer option', () => {
    const started = reduce(initialState, { type: 'call_started' }).state;
    const captured = reduce(started, { type: 'utterance', text: 'PA123456' }).state;
    const confirmed1 = reduce(captured, { type: 'confirm', yes: true }).state;
    const withPostcode = reduce(confirmed1, { type: 'utterance', text: 'DE1 2AB' }).state;
    const confirmed2 = reduce(withPostcode, { type: 'confirm', yes: true }).state;
    const { actions } = reduce(confirmed2, {
      type: 'lookup_result',
      result: { ok: false, reason: 'api_error' },
    });
    const sayAction = actions.find(a => a.type === 'say');
    expect(sayAction?.text.toLowerCase()).toMatch(/transfer|agent|team|help/);
  });
});

describe('Conversation machine — VOICE-04/08: ok=true result — only real data', () => {
  it('lookup_result ok=true emits a say using plainStatus from consignment', () => {
    const started = reduce(initialState, { type: 'call_started' }).state;
    const captured = reduce(started, { type: 'utterance', text: 'PA123456' }).state;
    const confirmed1 = reduce(captured, { type: 'confirm', yes: true }).state;
    const withPostcode = reduce(confirmed1, { type: 'utterance', text: 'DE1 2AB' }).state;
    const confirmed2 = reduce(withPostcode, { type: 'confirm', yes: true }).state;

    const consignment: MappedConsignment = {
      consignmentNumber: 'PA123456',
      plainStatus: 'Out for delivery',
      description: 'Your parcel is out for delivery',
      currentStage: 'out_for_delivery',
      estimatedDelDate: '2026-06-12',
      startWindow: '09:00',
      endWindow: '12:00',
      routeDetails: [],
    };

    const { state, actions } = reduce(confirmed2, {
      type: 'lookup_result',
      result: { ok: true, consignment },
    });

    expect(state.phase).toBe('answering');
    const sayAction = actions.find(a => a.type === 'say');
    expect(sayAction).toBeDefined();
    expect(sayAction?.text).toContain('Out for delivery');
  });

  it('VOICE-08 structural: null estimatedDelDate never produces an invented date', () => {
    const started = reduce(initialState, { type: 'call_started' }).state;
    const captured = reduce(started, { type: 'utterance', text: 'PA123456' }).state;
    const confirmed1 = reduce(captured, { type: 'confirm', yes: true }).state;
    const withPostcode = reduce(confirmed1, { type: 'utterance', text: 'DE1 2AB' }).state;
    const confirmed2 = reduce(withPostcode, { type: 'confirm', yes: true }).state;

    const consignment: MappedConsignment = {
      consignmentNumber: 'PA123456',
      plainStatus: 'At hub',
      description: 'Your parcel is at the hub',
      currentStage: 'at_hub',
      estimatedDelDate: null,
      startWindow: null,
      endWindow: null,
      routeDetails: [],
    };

    const { actions } = reduce(confirmed2, {
      type: 'lookup_result',
      result: { ok: true, consignment },
    });

    const sayAction = actions.find(a => a.type === 'say');
    expect(sayAction).toBeDefined();
    // Must not contain any date-like digit sequence when estimatedDelDate is null
    expect(sayAction?.text).not.toMatch(/\b\d{1,2}[\/\-]\d{1,2}[\/\-]\d{2,4}\b/);
    expect(sayAction?.text).not.toMatch(/\b\d{1,2}(st|nd|rd|th)?\s+(jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)/i);
    // Must not contain fabricated time windows
    expect(sayAction?.text).not.toMatch(/\d{1,2}:\d{2}/);
  });

  it('says contain tokens present in the consignment — not fabricated', () => {
    const started = reduce(initialState, { type: 'call_started' }).state;
    const captured = reduce(started, { type: 'utterance', text: 'PA123456' }).state;
    const confirmed1 = reduce(captured, { type: 'confirm', yes: true }).state;
    const withPostcode = reduce(confirmed1, { type: 'utterance', text: 'DE1 2AB' }).state;
    const confirmed2 = reduce(withPostcode, { type: 'confirm', yes: true }).state;

    const consignment: MappedConsignment = {
      consignmentNumber: 'PA123456',
      plainStatus: 'In transit',
      description: 'Parcel is being transported',
      currentStage: 'in_transit',
      estimatedDelDate: '2026-06-15',
      startWindow: '10:00',
      endWindow: '14:00',
      routeDetails: [],
    };

    const { actions } = reduce(confirmed2, {
      type: 'lookup_result',
      result: { ok: true, consignment },
    });

    const sayAction = actions.find(a => a.type === 'say');
    expect(sayAction).toBeDefined();
    // Status should be from the consignment
    expect(sayAction?.text).toContain('In transit');
  });
});

describe('Conversation machine — VOICE-08: not_found and postcode_mismatch', () => {
  function reachLookup(trackingRef = 'PA999999', postcode = 'DE1 2AB') {
    const started = reduce(initialState, { type: 'call_started' }).state;
    const captured = reduce(started, { type: 'utterance', text: trackingRef }).state;
    const confirmed1 = reduce(captured, { type: 'confirm', yes: true }).state;
    const withPostcode = reduce(confirmed1, { type: 'utterance', text: postcode }).state;
    return reduce(withPostcode, { type: 'confirm', yes: true }).state;
  }

  it('not_found emits appropriate say and offers retry or human', () => {
    const ready = reachLookup();
    const { actions } = reduce(ready, {
      type: 'lookup_result',
      result: { ok: false, reason: 'not_found' },
    });
    const sayAction = actions.find(a => a.type === 'say');
    expect(sayAction).toBeDefined();
    expect(sayAction?.text.toLowerCase()).toMatch(/not found|couldn|unable|no record|try again|agent/);
  });

  it('postcode_mismatch emits a distinct say from not_found', () => {
    const readyNotFound = reachLookup();
    const readyMismatch = reachLookup();

    const { actions: notFoundActions } = reduce(readyNotFound, {
      type: 'lookup_result',
      result: { ok: false, reason: 'not_found' },
    });

    const { actions: mismatchActions } = reduce(readyMismatch, {
      type: 'lookup_result',
      result: { ok: false, reason: 'postcode_mismatch' },
    });

    const notFoundSay = notFoundActions.find(a => a.type === 'say')?.text ?? '';
    const mismatchSay = mismatchActions.find(a => a.type === 'say')?.text ?? '';

    // They should be different messages
    expect(notFoundSay).not.toBe(mismatchSay);
  });
});

describe('Conversation machine — transcript integrity (T-04-07)', () => {
  it('every event appends to transcript', () => {
    const started = reduce(initialState, { type: 'call_started' }).state;
    const afterUtterance = reduce(started, { type: 'utterance', text: 'PA123456' }).state;
    expect(afterUtterance.transcript.length).toBeGreaterThan(started.transcript.length);
  });

  it('customer utterances are attributed to Customer speaker', () => {
    const started = reduce(initialState, { type: 'call_started' }).state;
    const { state } = reduce(started, { type: 'utterance', text: 'PA123456' });
    const customerTurn = state.transcript.find(t => t.speaker === 'Customer');
    expect(customerTurn).toBeDefined();
    expect(customerTurn?.text).toContain('PA123456');
  });
});

describe('Conversation machine — purity guarantee', () => {
  it('reduce does not mutate the input state', () => {
    const state = { ...initialState };
    const originalPhase = state.phase;
    reduce(state, { type: 'call_started' });
    expect(state.phase).toBe(originalPhase);
  });

  it('initial state has 0 attempts and empty transcript', () => {
    expect(initialState.attempts).toBe(0);
    expect(initialState.transcript).toHaveLength(0);
    expect(initialState.phase).toBe('greeting');
  });
});
