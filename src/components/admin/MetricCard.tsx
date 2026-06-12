interface Props {
  label: string;
  value: number | string;
  description?: string;
}

export function MetricCard({ label, value, description }: Props) {
  return (
    <div className="border border-zinc-200 rounded-xl p-6 bg-background">
      <p className="text-3xl font-semibold text-zinc-900">{value}</p>
      <h2 className="text-sm font-semibold text-zinc-500 mt-1">{label}</h2>
      {description && <p className="text-sm text-zinc-400 mt-1">{description}</p>}
    </div>
  );
}
