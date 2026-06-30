import type { ReactNode } from "react";

export default function EmptyState({
  title,
  subtitle,
  action,
}: {
  title: string;
  subtitle?: string;
  action?: ReactNode;
}) {
  return (
    <div className="flex flex-col items-center justify-center gap-3 rounded-2xl border border-dashed border-border-light py-14 text-center">
      <p className="text-base font-medium text-white">{title}</p>
      {subtitle && <p className="max-w-xs text-sm text-muted">{subtitle}</p>}
      {action}
    </div>
  );
}
