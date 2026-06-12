import { describe, it, expect } from 'vitest';
import { NATO, readBack } from './nato';

describe('NATO phonetic alphabet', () => {
  it('exports the ALFA entry', () => {
    expect(NATO['A']).toBe('Alfa');
  });

  it('has all 26 letters per ICAO standard', () => {
    const letters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'.split('');
    for (const letter of letters) {
      expect(NATO[letter]).toBeTruthy();
    }
  });

  it('Bravo is the NATO word for B', () => {
    expect(NATO['B']).toBe('Bravo');
  });

  it('Zulu is the NATO word for Z', () => {
    expect(NATO['Z']).toBe('Zulu');
  });
});

describe('readBack', () => {
  it('converts letters to NATO phonetic words', () => {
    const result = readBack('AB');
    expect(result).toContain('Alfa');
    expect(result).toContain('Bravo');
  });

  it('groups digits individually, letters as NATO words', () => {
    // "PA12" -> "P for Papa, A for Alfa, one two"
    const result = readBack('PA12');
    expect(result).toContain('Papa');
    expect(result).toContain('Alfa');
    expect(result).toContain('one');
    expect(result).toContain('two');
  });

  it('handles lowercase input by converting to uppercase', () => {
    const result = readBack('ab');
    expect(result).toContain('Alfa');
    expect(result).toContain('Bravo');
  });

  it('handles pure digits', () => {
    const result = readBack('123');
    expect(result).toContain('one');
    expect(result).toContain('two');
    expect(result).toContain('three');
  });

  it('handles a real UK consignment-number style ref', () => {
    const result = readBack('PA123456');
    expect(result).toContain('Papa');
    expect(result).toContain('Alfa');
    expect(result).toContain('one');
  });
});
