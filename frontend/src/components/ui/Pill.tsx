export default function Pill({ children, tone = "default" }: { children: React.ReactNode; tone?: "default" | "accent" | "danger" }) {
  const toneClass = {
    default: "bg-white/5 text-muted",
    accent: "bg-accent-dim text-accent",
    danger: "bg-danger-dim text-danger",
  }[tone];
  return <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold ${toneClass}`}>{children}</span>;
}
