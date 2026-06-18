interface Props {
  start: string;
  end: string;
}

/** Format a "HH:MM" 24-hour string into a friendly "9am" / "2:30pm". */
function formatTime(t: string): string {
  const [hStr, mStr] = t.split(':');
  let h = Number.parseInt(hStr, 10);
  const m = Number.parseInt(mStr ?? '0', 10);
  if (Number.isNaN(h)) return t;
  const ampm = h >= 12 ? 'pm' : 'am';
  h = h % 12;
  if (h === 0) h = 12;
  return m ? `${h}:${String(m).padStart(2, '0')}${ampm}` : `${h}${ampm}`;
}

export function TimeWindow({ start, end }: Props) {
  return (
    <div className="bg-accent/10 text-accent rounded-lg px-4 py-3 font-medium">
      Estimated delivery window: {formatTime(start)} – {formatTime(end)}
    </div>
  );
}
