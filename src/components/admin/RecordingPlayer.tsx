// RecordingPlayer — native audio player + recording-unavailable state.
// Uses native <audio controls> for browser-native accessibility (UI-05, D-03).
// No 'use client' needed — purely presentational, no browser APIs called at render.

interface Props {
  recordingUrl: string | null;
}

export function RecordingPlayer({ recordingUrl }: Props) {
  return (
    <div className="border border-zinc-200 rounded-lg p-4 bg-zinc-50">
      <p className="text-sm font-semibold text-zinc-700 mb-2">Call recording</p>
      {recordingUrl ? (
        // Browser-native player — accessible without any custom controls (UI-05)
        // eslint-disable-next-line jsx-a11y/media-has-caption
        <audio controls src={recordingUrl} className="w-full" />
      ) : (
        // Phase 3 stub: no real recordings yet (D-03)
        // Exact UI-SPEC copy for unavailable state
        <p className="text-sm text-zinc-500">
          Recording not yet available. Recordings are stored for 30 days after a call.
        </p>
      )}
    </div>
  );
}
