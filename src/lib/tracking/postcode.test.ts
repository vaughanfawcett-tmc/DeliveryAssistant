import { describe, it, expect } from 'vitest';
import { normalisePostcode, postcodesMatch } from './postcode';

describe('normalisePostcode', () => {
  it('uppercases and strips spaces from lowercase postcode', () => {
    expect(normalisePostcode('de1 1aa')).toBe('DE11AA');
  });

  it('uppercases and strips leading/trailing spaces', () => {
    expect(normalisePostcode(' SW1A 2AA ')).toBe('SW1A2AA');
  });
});

describe('postcodesMatch', () => {
  it('matches postcodes that differ only in spacing and case', () => {
    expect(postcodesMatch('DE1 1AA', 'de11aa')).toBe(true);
  });

  it('returns false for genuinely different postcodes', () => {
    expect(postcodesMatch('DE1 1AA', 'DE2 1AA')).toBe(false);
  });

  it('returns false when supplied postcode is empty', () => {
    expect(postcodesMatch('', 'DE1 1AA')).toBe(false);
  });
});
