interface Props {
  start: string;
  end: string;
}

export function TimeWindow({ start, end }: Props) {
  return (
    <div className="bg-accent/10 text-accent rounded-lg px-4 py-3 font-medium">
      Arriving between {start} and {end}
    </div>
  );
}
