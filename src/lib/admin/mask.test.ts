import { describe, it, expect } from 'vitest';
import { maskPhone } from './mask';

describe('maskPhone', () => {
  it('returns "—" for null', () => {
    expect(maskPhone(null)).toBe('—');
  });

  it('returns "•••" when fewer than 4 digits present', () => {
    expect(maskPhone('123')).toBe('•••');
  });

  it('masks full UK number to "••• ••• 3456"', () => {
    expect(maskPhone('+447911123456')).toBe('••• ••• 3456');
  });

  it('does not leak any source digit other than the last 4', () => {
    const result = maskPhone('+447911123456');
    // Must end with 3456
    expect(result.endsWith('3456')).toBe(true);
    // Must not contain any of the preceding digits from the source
    expect(result).not.toMatch(/[0-9]{5}/); // no 5-digit run
  });
});
