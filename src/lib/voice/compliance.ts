import type { VoiceAction } from './types';

/**
 * AI-disclosure and recording-consent opening script.
 *
 * Regulatory requirements (VOICE-01 / D-12):
 * - Must explicitly identify the caller as an AI/automated assistant before any
 *   data capture (GDPR transparency; PECR call recording consent).
 * - Must announce that the call is being recorded.
 * - This is the FIRST thing said on every call — enforced structurally via openingTurn().
 */
export const DISCLOSURE =
  "Hello! I'm an automated AI assistant for Derby Aggs. " +
  'This call is being recorded for quality and training purposes. ' +
  "I'm here to help you track your delivery — let's get started. " +
  'Could you please tell me your consignment number?';

/**
 * Returns the opening turn actions for a new call.
 * Always the first thing the agent says — before any data capture.
 */
export function openingTurn(): VoiceAction[] {
  return [{ type: 'say', text: DISCLOSURE }];
}
