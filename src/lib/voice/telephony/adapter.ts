/**
 * adapter.ts — VoiceTelephonyAdapter interface (D-01 Retell-pivot insurance).
 *
 * Decouples business/conversation logic from the concrete telephony platform
 * (ElevenLabs + Twilio today; any other provider tomorrow without touching callers).
 *
 * Security notes (T-04-09, T-04-10):
 * - placeOutboundCall accepts an E.164 destination — callers are responsible for
 *   resolving driver ids to numbers via getDriverById before calling here, keeping
 *   SSRF surface off this interface.
 * - Auth credentials are NOT part of this interface; implementations read them via
 *   injected config or a lazy factory to prevent test snapshots from capturing secrets.
 */

// ---------------------------------------------------------------------------
// Supporting types
// ---------------------------------------------------------------------------

export interface OutboundCallResult {
  callId: string;
}

// ---------------------------------------------------------------------------
// Adapter interface
// ---------------------------------------------------------------------------

export interface VoiceTelephonyAdapter {
  /**
   * Place an outbound call to an E.164 number.
   * Resolves with a platform call ID that callers must hold to end/transfer/dtmf.
   *
   * @param to      E.164 destination (e.g. "+441332123456")
   * @param opts    Optional platform hints (agentId override etc.)
   */
  placeOutboundCall(to: string, opts?: { agentId?: string }): Promise<OutboundCallResult>;

  /**
   * Gracefully terminate an active call.
   *
   * @param callId  Platform call ID returned by placeOutboundCall
   * @param reason  Optional free-text reason (logged but not sent to callee)
   */
  endCall(callId: string, reason?: string): Promise<void>;

  /**
   * Blind transfer an active call to a human agent number.
   * The summary is intended for warm-handoff screen-pop / notes.
   *
   * @param callId    Platform call ID
   * @param toNumber  E.164 destination for the human agent
   * @param summary   Short context string (e.g. "Driver unreachable — escalating")
   */
  transferToHuman(callId: string, toNumber: string, summary: string): Promise<void>;

  /**
   * Send DTMF digits mid-call (e.g. to navigate IVR menus).
   *
   * @param callId  Platform call ID
   * @param digits  String of DTMF characters: 0-9, *, #
   */
  sendDtmf(callId: string, digits: string): Promise<void>;
}
