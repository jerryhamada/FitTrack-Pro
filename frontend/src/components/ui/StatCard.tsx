export default function StatCard({ label, value, accent }: { label: string; value: string; accent?: boolean }) {
  return (
    <div className="card flex flex-col gap-1">
      <span className="text-xs uppercase tracking-wide text-muted">{label}</span>
      <span className={`text-2xl font-bold ${accent ? "text-accent" : "text-white"}`}>{value}</span>
    </div>
  );
}
