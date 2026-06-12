import { describe, it, expect } from 'vitest';
import { DISCLOSURE, openingTurn } from './compliance';

describe('DISCLOSURE constant', () => {
  it('contains an explicit AI/automated identifier', () => {
    const lower = DISCLOSURE.toLowerCase();
    const hasAI = lower.includes('automated') || lower.includes('ai assistant') || lower.includes('virtual assistant') || lower.includes('artificial intelligence');
    expect(hasAI).toBe(true);
  });

  it('contains a recording/recorded phrase', () => {
    const lower = DISCLOSURE.toLowerCase();
    const hasRecording = lower.includes('recording') || lower.includes('recorded');
    expect(hasRecording).toBe(true);
  });

  it('is a non-empty string', () => {
    expect(typeof DISCLOSURE).toBe('string');
    expect(DISCLOSURE.length).toBeGreaterThan(20);
  });
});

describe('openingTurn', () => {
  it('returns an array of VoiceActions', () => {
    const actions = openingTurn();
    expect(Array.isArray(actions)).toBe(true);
    expect(actions.length).toBeGreaterThan(0);
  });

  it('first action is a say action containing the DISCLOSURE text', () => {
    const actions = openingTurn();
    const sayAction = actions.find(a => a.type === 'say');
    expect(sayAction).toBeDefined();
    expect(sayAction?.text).toBe(DISCLOSURE);
  });
});
