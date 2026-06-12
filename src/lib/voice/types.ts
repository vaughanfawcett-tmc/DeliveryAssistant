import type { TrackingResult } from '@/types/tracking';

/**
 * A single turn in the call transcript.
 * Shape matches the Phase 3 TranscriptView component expectations.
 */
export interface TranscriptTurn {
  speaker: 'Agent' | 'Customer';
  text: string;
  ts?: string;
}

/**
 * Conversation phase the state machine is currently in.
 */
export type VoicePhase =
  | 'greeting'
  | 'awaiting_tracking'
  | 'awaiting_postcode'
  | 'confirming'
  | 'looking_up'
  | 'answering'
  | 'handoff'
  | 'ended';

/**
 * What the machine is currently waiting to confirm.
 * Used to distinguish confirming a trackingRef from confirming a postcode.
 */
export type ConfirmingField = 'tracking_ref' | 'postcode';

/**
 * Full machine state — passed to every reduce() call; never mutated in place.
 */
export interface VoiceState {
  phase: VoicePhase;
  trackingRef?: string;
  postcode?: string;
  /** Which field we are currently awaiting confirmation for */
  confirmingField?: ConfirmingField;
  /** Number of failed capture/confirm attempts for the current capture session */
  attempts: number;
  /** Ordered call transcript — grows with every agent/customer turn */
  transcript: TranscriptTurn[];
}

// ---------------------------------------------------------------------------
// Events (discriminated union — one per caller action or system notification)
// ---------------------------------------------------------------------------

export type VoiceEvent =
  | { type: 'call_started' }
  | { type: 'utterance'; text: string }
  | { type: 'dtmf'; digits: string }
  | { type: 'confirm'; yes: boolean }
  | { type: 'request_human' }
  | { type: 'lookup_result'; result: TrackingResult };

// ---------------------------------------------------------------------------
// Actions (discriminated union — instructions emitted to the telephony layer)
// ---------------------------------------------------------------------------

export type VoiceAction =
  | { type: 'say'; text: string }
  | { type: 'lookup'; trackingRef: string; postcode: string }
  | { type: 'transfer'; summary: string }
  | { type: 'hangup' }
  | { type: 'collect_dtmf' };
