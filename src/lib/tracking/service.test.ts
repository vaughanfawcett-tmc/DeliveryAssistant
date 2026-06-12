/**
 * service.test.ts — Tests for the tracking service orchestration.
 *
 * Uses the factory pattern (createTrackingService) to inject spies for
 * nexusLookup, logLookup, and mapStatusName — so each test verifies
 * the correct orchestration without hitting the database or Nexus API.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { FOUND_IN_TRANSIT, FOUND_NULL_ETA } from '../../mocks/fixtures';
import type { NexusLookupResult } from '../nexus/client';
import type { LookupOutcome } from '../repositories/lookup-log';
import { createTrackingService } from './service';

// ---- Helpers ----------------------------------------------------------------

function makeNexusLookup(result: NexusLookupResult) {
  return vi.fn().mockResolvedValue(result);
}

function makeLogLookup() {
  return vi.fn().mockResolvedValue(undefined);
}

// ---- Tests ------------------------------------------------------------------

describe('lookupConsignment (via createTrackingService)', () => {
  let logLookupSpy: ReturnType<typeof makeLogLookup>;

  beforeEach(() => {
    logLookupSpy = makeLogLookup();
  });

  it('found + postcode match: returns ok:true with mapped consignment, logs "found"', async () => {
    const nexusLookup = makeNexusLookup({ ok: true, consignments: [FOUND_IN_TRANSIT] });
    const { lookupConsignment } = createTrackingService({ nexusLookup, logLookup: logLookupSpy });

    const result = await lookupConsignment({ trackingRef: 'PA-12345', postcode: 'de1 1aa' });

    expect(result.ok).toBe(true);
    if (!result.ok) throw new Error('Expected ok:true');

    expect(result.consignment.consignmentNumber).toBe('PA-12345');
    expect(result.consignment.currentStage).toBe('in_transit');
    expect(result.consignment.plainStatus).toBeTruthy();
    expect(result.consignment.estimatedDelDate).toBe('2026-06-12');

    expect(logLookupSpy).toHaveBeenCalledOnce();
    expect(logLookupSpy).toHaveBeenCalledWith(
      expect.objectContaining({ outcome: 'found' as LookupOutcome, success: true }),
    );
  });

  it('postcode mismatch: returns ok:false reason:postcode_mismatch, logs "postcode_mismatch", does NOT call mapStatusName', async () => {
    const nexusLookup = makeNexusLookup({ ok: true, consignments: [FOUND_IN_TRANSIT] });
    const mapStatusNameSpy = vi.fn();
    const { lookupConsignment } = createTrackingService({
      nexusLookup,
      logLookup: logLookupSpy,
      mapStatusName: mapStatusNameSpy,
    });

    const result = await lookupConsignment({ trackingRef: 'PA-12345', postcode: 'XX1 1XX' });

    expect(result.ok).toBe(false);
    if (result.ok) throw new Error('Expected ok:false');
    expect(result.reason).toBe('postcode_mismatch');

    // Critically: mapStatusName must NOT be called — no data shaped before gate passes
    expect(mapStatusNameSpy).not.toHaveBeenCalled();

    expect(logLookupSpy).toHaveBeenCalledOnce();
    expect(logLookupSpy).toHaveBeenCalledWith(
      expect.objectContaining({ outcome: 'postcode_mismatch' as LookupOutcome, success: false }),
    );
  });

  it('not found: returns ok:false reason:not_found, logs "not_found"', async () => {
    const nexusLookup = makeNexusLookup({ ok: false, error: 'not_found' });
    const { lookupConsignment } = createTrackingService({ nexusLookup, logLookup: logLookupSpy });

    const result = await lookupConsignment({ trackingRef: 'PA-00000', postcode: 'DE1 1AA' });

    expect(result.ok).toBe(false);
    if (result.ok) throw new Error('Expected ok:false');
    expect(result.reason).toBe('not_found');

    expect(logLookupSpy).toHaveBeenCalledOnce();
    expect(logLookupSpy).toHaveBeenCalledWith(
      expect.objectContaining({ outcome: 'not_found' as LookupOutcome, success: false }),
    );
  });

  it('nexus unavailable: returns ok:false reason:api_error, logs "api_error", does not throw or fabricate', async () => {
    const nexusLookup = makeNexusLookup({ ok: false, error: 'nexus_unavailable' });
    const { lookupConsignment } = createTrackingService({ nexusLookup, logLookup: logLookupSpy });

    await expect(
      lookupConsignment({ trackingRef: 'PA-12345', postcode: 'DE1 1AA' }),
    ).resolves.not.toThrow();

    const result = await lookupConsignment({ trackingRef: 'PA-12345', postcode: 'DE1 1AA' });

    expect(result.ok).toBe(false);
    if (result.ok) throw new Error('Expected ok:false');
    expect(result.reason).toBe('api_error');

    // logLookupSpy called once per invocation — we called it twice above
    expect(logLookupSpy).toHaveBeenCalledWith(
      expect.objectContaining({ outcome: 'api_error' as LookupOutcome, success: false }),
    );
  });

  it('multiple matches: returns ok:false reason:multiple_matches with candidates array containing safe detail', async () => {
    const nexusLookup = makeNexusLookup({
      ok: true,
      consignments: [FOUND_IN_TRANSIT, FOUND_NULL_ETA],
    });
    const { lookupConsignment } = createTrackingService({ nexusLookup, logLookup: logLookupSpy });

    const result = await lookupConsignment({ trackingRef: 'PA-12345', postcode: 'DE1 1AA' });

    expect(result.ok).toBe(false);
    if (result.ok) throw new Error('Expected ok:false');
    expect(result.reason).toBe('multiple_matches');

    // Must carry candidates (D-10)
    if (result.reason !== 'multiple_matches') throw new Error('Expected multiple_matches');
    expect(result.candidates).toHaveLength(2);

    // First candidate maps FOUND_IN_TRANSIT
    const first = result.candidates[0];
    expect(first.consignmentNumber).toBe('PA-12345');
    expect(first.delAddressTown).toBe('Derby');
    expect(typeof first.plainStatus).toBe('string');
    expect(first.plainStatus.length).toBeGreaterThan(0);

    // Second candidate maps FOUND_NULL_ETA
    const second = result.candidates[1];
    expect(second.consignmentNumber).toBe('PA-99999');
    expect(second.delAddressTown).toBe('Nottingham');

    // Neither candidate has a postcode field (D-10: safe detail only)
    expect(first).not.toHaveProperty('postcode');
    expect(first).not.toHaveProperty('delAddressPostcode');
    expect(second).not.toHaveProperty('postcode');
    expect(second).not.toHaveProperty('delAddressPostcode');

    // Logged under not_found bucket
    expect(logLookupSpy).toHaveBeenCalledOnce();
    expect(logLookupSpy).toHaveBeenCalledWith(
      expect.objectContaining({ success: false }),
    );
  });

  it('null ETA passthrough: estimatedDelDate is null, not fabricated', async () => {
    // FOUND_NULL_ETA has postcode NG1 5FS and estimatedDelDate: null
    const nexusLookup = makeNexusLookup({ ok: true, consignments: [FOUND_NULL_ETA] });
    const { lookupConsignment } = createTrackingService({ nexusLookup, logLookup: logLookupSpy });

    const result = await lookupConsignment({ trackingRef: 'PA-99999', postcode: 'NG1 5FS' });

    expect(result.ok).toBe(true);
    if (!result.ok) throw new Error('Expected ok:true');
    expect(result.consignment.estimatedDelDate).toBeNull();
    expect(result.consignment.startWindow).toBeNull();
    expect(result.consignment.endWindow).toBeNull();
  });
});

describe('lookupForShare (via createTrackingService)', () => {
  let logLookupSpy: ReturnType<typeof makeLogLookup>;

  beforeEach(() => {
    logLookupSpy = makeLogLookup();
  });

  it('single match: returns ok:true with mapped consignment and calls mapStatusName', async () => {
    const mapStatusNameSpy = vi.fn().mockReturnValue({
      stage: 'in_transit',
      plainStatus: 'In transit',
      description: 'Your parcel is on its way',
    });
    const nexusLookup = makeNexusLookup({ ok: true, consignments: [FOUND_IN_TRANSIT] });
    const { lookupForShare } = createTrackingService({
      nexusLookup,
      logLookup: logLookupSpy,
      mapStatusName: mapStatusNameSpy,
    });

    // FOUND_IN_TRANSIT has postcode DE1 1AA — we do NOT supply a postcode here;
    // the whole point is that lookupForShare bypasses the postcode gate.
    const result = await lookupForShare('PA-12345');

    expect(result.ok).toBe(true);
    if (!result.ok) throw new Error('Expected ok:true');
    expect(result.consignment.consignmentNumber).toBe('PA-12345');

    // mapStatusName MUST be called (status is shaped)
    expect(mapStatusNameSpy).toHaveBeenCalledOnce();
  });

  it('postcode gate is NOT applied: a consignment whose postcode would not match still succeeds', async () => {
    // FOUND_IN_TRANSIT has delAddressPostcode: DE1 1AA
    // We verify lookupForShare does not check any postcode at all.
    // If the postcode gate were applied with any postcode value, it might fail.
    const nexusLookup = makeNexusLookup({ ok: true, consignments: [FOUND_IN_TRANSIT] });
    const { lookupForShare } = createTrackingService({ nexusLookup, logLookup: logLookupSpy });

    const result = await lookupForShare('PA-12345');
    // Should succeed even though we never supplied a matching postcode
    expect(result.ok).toBe(true);
  });

  it('nexus not_found: returns ok:false reason:not_found', async () => {
    const nexusLookup = makeNexusLookup({ ok: false, error: 'not_found' });
    const { lookupForShare } = createTrackingService({ nexusLookup, logLookup: logLookupSpy });

    const result = await lookupForShare('PA-00000');

    expect(result.ok).toBe(false);
    if (result.ok) throw new Error('Expected ok:false');
    expect(result.reason).toBe('not_found');
  });

  it('nexus_unavailable: returns ok:false reason:api_error', async () => {
    const nexusLookup = makeNexusLookup({ ok: false, error: 'nexus_unavailable' });
    const { lookupForShare } = createTrackingService({ nexusLookup, logLookup: logLookupSpy });

    const result = await lookupForShare('PA-12345');

    expect(result.ok).toBe(false);
    if (result.ok) throw new Error('Expected ok:false');
    expect(result.reason).toBe('api_error');
  });
});
