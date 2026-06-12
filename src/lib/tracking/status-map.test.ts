import { describe, it, expect, vi, afterEach } from 'vitest';
import { mapStatusName } from './status-map';

afterEach(() => {
  vi.restoreAllMocks();
});

describe('mapStatusName', () => {
  it('maps "In Transit" to in_transit with non-empty description', () => {
    const result = mapStatusName('In Transit');
    expect(result.stage).toBe('in_transit');
    expect(result.plainStatus).toBeTruthy();
    expect(result.description).toBeTruthy();
  });

  it('maps "Delivered" to delivered', () => {
    const result = mapStatusName('Delivered');
    expect(result.stage).toBe('delivered');
    expect(result.plainStatus).toBeTruthy();
    expect(result.description).toBeTruthy();
  });

  it('maps "Booked" to booked', () => {
    const result = mapStatusName('Booked');
    expect(result.stage).toBe('booked');
    expect(result.plainStatus).toBeTruthy();
    expect(result.description).toBeTruthy();
  });

  it('maps "Out for Delivery" to out_for_delivery', () => {
    const result = mapStatusName('Out for Delivery');
    expect(result.stage).toBe('out_for_delivery');
    expect(result.plainStatus).toBeTruthy();
    expect(result.description).toBeTruthy();
  });

  it('maps "At Hub" to at_hub', () => {
    const result = mapStatusName('At Hub');
    expect(result.stage).toBe('at_hub');
    expect(result.plainStatus).toBeTruthy();
    expect(result.description).toBeTruthy();
  });

  it('maps "At Depot" to at_hub', () => {
    const result = mapStatusName('At Depot');
    expect(result.stage).toBe('at_hub');
  });

  it('returns safe default for unknown status and does not throw', () => {
    const consoleSpy = vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    expect(() => mapStatusName('Exception')).not.toThrow();
    const result = mapStatusName('Exception');
    expect(result.stage).toBe('in_transit'); // safe default stage
    expect(result.plainStatus).toBeTruthy();
    expect(result.description).toBeTruthy();
    expect(consoleSpy).toHaveBeenCalled();
  });
});
