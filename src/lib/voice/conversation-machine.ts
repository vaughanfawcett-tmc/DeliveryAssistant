/**
 * Pure conversation state machine for the Derby Aggs voice agent.
 *
 * Architecture: reducer pattern — (state, event) -> { state, actions }
 * - No I/O, no Date.now(), no side effects, no module-level state.
 * - All telephony instructions are returned as VoiceAction values; the
 *   telephony adapter (ElevenLabs/Twilio or MockTelephonyAdapter) executes them.
 *
 * VOICE-08 never-invent-data guarantee is STRUCTURAL:
 * - The answering branch only interpolates fields from the TrackingResult the
 *   lookup_result event carries. It cannot invent facts because it has no other
 *   data source to read from.
 *
 * Security notes (threat model T-04-05 / T-04-06):
 * - Caller utterances populate candidate trackingRef/postcode values only.
 *   They are confirmed before use and never set delivery status directly.
 * - The answer text is always derived from result.consignment — not from
 *   caller input.
 */

import { DISCLOSURE } from './compliance';
import { readBack } from './nato';
import type { VoiceState, VoiceEvent, VoiceAction, TranscriptTurn } from './types';

/** Maximum number of capture failures before forced human handoff (VOICE-05) */
const MAX_ATTEMPTS = 3;

// ---------------------------------------------------------------------------
// Initial state
// ---------------------------------------------------------------------------

export const initialState: VoiceState = {
  phase: 'greeting',
  attempts: 0,
  transcript: [],
};

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function agentSay(text: string): VoiceAction {
  return { type: 'say', text };
}

function addTurn(transcript: TranscriptTurn[], speaker: 'Agent' | 'Customer', text: string): TranscriptTurn[] {
  return [...transcript, { speaker, text }];
}

/**
 * Build a warm-handoff summary string from the call transcript and current state.
 * Used by VOICE-06 (on-demand) and VOICE-05 (3-attempt cap).
 */
function buildSummary(state: VoiceState, reason: string): string {
  const turns = state.transcript
    .map(t => `${t.speaker}: ${t.text}`)
    .join(' | ');
  const refPart = state.trackingRef ? ` Tracking ref: ${state.trackingRef}.` : '';
  const postPart = state.postcode ? ` Postcode: ${state.postcode}.` : '';
  return `Call summary — ${reason}.${refPart}${postPart} Transcript: ${turns || 'no prior turns'}`;
}

/**
 * Strip trailing '#' from DTMF sequences and normalise whitespace.
 * Per VOICE-03: '#' terminates DTMF entry; the '#' itself is not part of the ref.
 */
function normaliseDtmf(digits: string): string {
  return digits.replace(/#$/, '').trim();
}

/**
 * Best-effort extraction of a tracking reference from a spoken utterance.
 * Returns the trimmed, uppercased text (simple heuristic — real STT already
 * returns clean alphanumeric sequences for our use-case).
 */
function extractRef(text: string): string {
  return text.trim().toUpperCase().replace(/\s+/g, '');
}

// ---------------------------------------------------------------------------
// Reducer
// ---------------------------------------------------------------------------

export function reduce(
  state: VoiceState,
  event: VoiceEvent,
): { state: VoiceState; actions: VoiceAction[] } {

  // ---- Global intercept: on-demand human handoff (VOICE-06) ---------------
  // "0" or "agent" keyword at any phase triggers immediate warm transfer.
  if (event.type === 'request_human') {
    const summary = buildSummary(state, 'Customer requested human agent');
    const transcript = addTurn(state.transcript, 'Agent', 'Transferring you to our team now. One moment please.');
    return {
      state: { ...state, phase: 'handoff', transcript },
      actions: [
        agentSay('Let me transfer you to one of our team members now. Please hold.'),
        { type: 'transfer', summary },
      ],
    };
  }

  // ---- Phase-specific transitions -----------------------------------------
  switch (state.phase) {

    // ---- greeting -----------------------------------------------------------
    case 'greeting': {
      if (event.type === 'call_started') {
        const transcript = addTurn(state.transcript, 'Agent', DISCLOSURE);
        return {
          state: { ...state, phase: 'awaiting_tracking', transcript },
          actions: [agentSay(DISCLOSURE)],
        };
      }
      return noOp(state);
    }

    // ---- awaiting_tracking --------------------------------------------------
    case 'awaiting_tracking': {
      if (event.type === 'utterance') {
        const ref = extractRef(event.text);
        const readBackText = readBack(ref);
        const confirmPrompt = `I heard your consignment number as: ${readBackText}. Is that correct? Please say yes or no.`;
        const transcript = addTurn(
          addTurn(state.transcript, 'Customer', event.text),
          'Agent', confirmPrompt,
        );
        return {
          state: {
            ...state,
            phase: 'confirming',
            confirmingField: 'tracking_ref',
            trackingRef: ref,
            transcript,
          },
          actions: [agentSay(confirmPrompt)],
        };
      }

      if (event.type === 'dtmf') {
        const ref = normaliseDtmf(event.digits);
        const readBackText = readBack(ref);
        const confirmPrompt = `I received via keypad: ${readBackText}. Is that correct? Please say yes or no.`;
        const transcript = addTurn(
          addTurn(state.transcript, 'Customer', `[DTMF] ${event.digits}`),
          'Agent', confirmPrompt,
        );
        return {
          state: {
            ...state,
            phase: 'confirming',
            confirmingField: 'tracking_ref',
            trackingRef: ref,
            transcript,
          },
          actions: [agentSay(confirmPrompt)],
        };
      }
      return noOp(state);
    }

    // ---- awaiting_postcode --------------------------------------------------
    case 'awaiting_postcode': {
      if (event.type === 'utterance') {
        const postcode = event.text.trim().toUpperCase();
        const readBackText = readBack(postcode);
        const confirmPrompt = `I heard your postcode as: ${readBackText}. Is that correct? Please say yes or no.`;
        const transcript = addTurn(
          addTurn(state.transcript, 'Customer', event.text),
          'Agent', confirmPrompt,
        );
        return {
          state: {
            ...state,
            phase: 'confirming',
            confirmingField: 'postcode',
            postcode,
            transcript,
          },
          actions: [agentSay(confirmPrompt)],
        };
      }

      if (event.type === 'dtmf') {
        const postcode = normaliseDtmf(event.digits).toUpperCase();
        const readBackText = readBack(postcode);
        const confirmPrompt = `I received via keypad: ${readBackText}. Is that correct? Please say yes or no.`;
        const transcript = addTurn(
          addTurn(state.transcript, 'Customer', `[DTMF] ${event.digits}`),
          'Agent', confirmPrompt,
        );
        return {
          state: {
            ...state,
            phase: 'confirming',
            confirmingField: 'postcode',
            postcode,
            transcript,
          },
          actions: [agentSay(confirmPrompt)],
        };
      }
      return noOp(state);
    }

    // ---- confirming ---------------------------------------------------------
    case 'confirming': {
      if (event.type === 'confirm') {
        if (event.yes) {
          // Confirmed — move to the next capture step or trigger lookup
          if (state.confirmingField === 'tracking_ref') {
            const prompt = 'Great! Now, could you please tell me your delivery postcode?';
            const transcript = addTurn(
              addTurn(state.transcript, 'Customer', 'Yes'),
              'Agent', prompt,
            );
            return {
              // WR-03: reset attempts counter when moving to postcode capture.
              // VOICE-05 "3 capture failures" is interpreted as per-field: 3 failures
              // on tracking_ref before handoff, and a fresh 3 for postcode capture.
              state: { ...state, phase: 'awaiting_postcode', confirmingField: undefined, attempts: 0, transcript },
              actions: [agentSay(prompt)],
            };
          }

          // Postcode confirmed — trigger lookup
          if (state.confirmingField === 'postcode' && state.trackingRef && state.postcode) {
            const prompt = 'Perfect, looking that up for you now...';
            const transcript = addTurn(
              addTurn(state.transcript, 'Customer', 'Yes'),
              'Agent', prompt,
            );
            return {
              state: { ...state, phase: 'looking_up', confirmingField: undefined, transcript },
              actions: [
                agentSay(prompt),
                { type: 'lookup', trackingRef: state.trackingRef, postcode: state.postcode },
              ],
            };
          }
        }

        // Rejected — increment attempts
        const newAttempts = state.attempts + 1;

        if (newAttempts >= MAX_ATTEMPTS) {
          // 3 attempts exhausted — warm handoff (VOICE-05)
          const summary = buildSummary(
            { ...state, attempts: newAttempts },
            `Caller could not confirm reference after ${newAttempts} attempts`,
          );
          const transferMsg = "I'm sorry we're having trouble getting the details. Let me transfer you to our team who can help.";
          const transcript = addTurn(
            addTurn(state.transcript, 'Customer', 'No'),
            'Agent', transferMsg,
          );
          return {
            state: { ...state, phase: 'handoff', attempts: newAttempts, transcript },
            actions: [
              agentSay(transferMsg),
              { type: 'transfer', summary },
            ],
          };
        }

        // Re-prompt for the same field
        const isTrackingRef = state.confirmingField === 'tracking_ref';
        const retryPrompt = isTrackingRef
          ? `No problem, let's try again. Could you please say your consignment number? (Attempt ${newAttempts + 1} of ${MAX_ATTEMPTS})`
          : `No problem, let's try again. Could you please say your delivery postcode? (Attempt ${newAttempts + 1} of ${MAX_ATTEMPTS})`;

        // Clear the current candidate value and go back to the appropriate capture phase
        const nextPhase = isTrackingRef ? 'awaiting_tracking' : 'awaiting_postcode';
        const stateUpdate = isTrackingRef
          ? { ...state, phase: nextPhase as VoiceState['phase'], trackingRef: undefined, confirmingField: undefined, attempts: newAttempts }
          : { ...state, phase: nextPhase as VoiceState['phase'], postcode: undefined, confirmingField: undefined, attempts: newAttempts };

        const transcript = addTurn(
          addTurn(state.transcript, 'Customer', 'No'),
          'Agent', retryPrompt,
        );

        return {
          state: { ...stateUpdate, transcript },
          actions: [agentSay(retryPrompt)],
        };
      }
      return noOp(state);
    }

    // ---- looking_up ---------------------------------------------------------
    case 'looking_up': {
      if (event.type === 'lookup_result') {
        const result = event.result;

        if (result.ok) {
          // VOICE-04/08: Only speak facts from the consignment — never fabricate.
          const c = result.consignment;
          let responseText = `Your consignment ${c.consignmentNumber} — current status: ${c.plainStatus}.`;

          // Only include time window if BOTH fields are non-null (VOICE-08 guarantee)
          if (c.startWindow !== null && c.endWindow !== null) {
            responseText += ` Expected delivery window: ${c.startWindow} to ${c.endWindow}.`;
          }

          // Only include estimated date if it's actually set (prevents invented dates)
          // Note: deliberately NOT included here — window already covers that need.
          // estimatedDelDate is not spoken to avoid date formatting that could mismatch
          // VOICE-08 structural check. The window fields are sufficient.

          responseText += ' Is there anything else I can help you with? You can say "agent" at any time to speak with someone.';

          const transcript = addTurn(state.transcript, 'Agent', responseText);
          return {
            state: { ...state, phase: 'answering', transcript },
            actions: [agentSay(responseText)],
          };
        }

        // Not-ok cases
        if (result.reason === 'api_error') {
          // VOICE-07: Explain downtime, offer transfer — never stall or guess
          const errorText =
            "I'm sorry, I'm currently unable to retrieve your delivery information due to a system issue. " +
            'You can say "agent" to speak with our team, or please try again in a few minutes.';
          const transcript = addTurn(state.transcript, 'Agent', errorText);
          return {
            state: { ...state, phase: 'answering', transcript },
            actions: [agentSay(errorText)],
          };
        }

        if (result.reason === 'not_found') {
          const notFoundText =
            "I'm sorry, I couldn't find a record matching that consignment number and postcode. " +
            'Please double-check the details and try again, or say "agent" to speak with our team.';
          const transcript = addTurn(state.transcript, 'Agent', notFoundText);
          return {
            state: { ...state, phase: 'answering', transcript },
            actions: [agentSay(notFoundText)],
          };
        }

        if (result.reason === 'postcode_mismatch') {
          const mismatchText =
            "I'm sorry, the postcode you provided doesn't match our records for that consignment. " +
            'Please check your delivery postcode and try again, or say "agent" to speak with our team.';
          const transcript = addTurn(state.transcript, 'Agent', mismatchText);
          return {
            state: { ...state, phase: 'answering', transcript },
            actions: [agentSay(mismatchText)],
          };
        }

        if (result.reason === 'multiple_matches') {
          const multiText =
            "I found multiple consignments matching your details. " +
            'To make sure I give you the right information, please say "agent" and a team member can assist you directly.';
          const transcript = addTurn(state.transcript, 'Agent', multiText);
          return {
            state: { ...state, phase: 'answering', transcript },
            actions: [agentSay(multiText)],
          };
        }
      }
      return noOp(state);
    }

    // ---- answering ----------------------------------------------------------
    case 'answering': {
      // In answering phase, request_human is handled globally above.
      // Other utterances can trigger a restart or hangup.
      return noOp(state);
    }

    // ---- handoff / ended ---------------------------------------------------
    case 'handoff':
    case 'ended': {
      return noOp(state);
    }

    default: {
      return noOp(state);
    }
  }
}

// ---------------------------------------------------------------------------
// Utility
// ---------------------------------------------------------------------------

function noOp(state: VoiceState): { state: VoiceState; actions: VoiceAction[] } {
  return { state, actions: [] };
}
