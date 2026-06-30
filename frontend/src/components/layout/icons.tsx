import type { SVGProps } from "react";

type IconProps = SVGProps<SVGSVGElement>;

const base = (children: React.ReactNode, props: IconProps) => (
  <svg
    width={20}
    height={20}
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth={1.8}
    strokeLinecap="round"
    strokeLinejoin="round"
    {...props}
  >
    {children}
  </svg>
);

export const DashboardIcon = (p: IconProps) =>
  base(
    <>
      <rect x="3" y="3" width="7" height="9" rx="1.5" />
      <rect x="14" y="3" width="7" height="5" rx="1.5" />
      <rect x="14" y="12" width="7" height="9" rx="1.5" />
      <rect x="3" y="16" width="7" height="5" rx="1.5" />
    </>,
    p
  );

export const DumbbellIcon = (p: IconProps) =>
  base(
    <>
      <path d="M6.5 6.5l11 11" />
      <rect x="2" y="9" width="4" height="6" rx="1" />
      <rect x="18" y="9" width="4" height="6" rx="1" />
      <rect x="6" y="11" width="3" height="2" rx="0.5" />
      <rect x="15" y="11" width="3" height="2" rx="0.5" />
    </>,
    p
  );

export const ProgramIcon = (p: IconProps) =>
  base(
    <>
      <rect x="3" y="3" width="18" height="18" rx="2" />
      <path d="M8 3v18M3 9h18" />
    </>,
    p
  );

export const CalendarIcon = (p: IconProps) =>
  base(
    <>
      <rect x="3" y="5" width="18" height="16" rx="2" />
      <path d="M3 10h18M8 3v4M16 3v4" />
    </>,
    p
  );

export const ActivityIcon = (p: IconProps) =>
  base(<path d="M3 12h4l2 8 4-16 2 8h6" />, p);

export const SettingsIcon = (p: IconProps) =>
  base(
    <>
      <circle cx="12" cy="12" r="3" />
      <path d="M19.4 15a1.7 1.7 0 0 0 .34 1.87l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.7 1.7 0 0 0-1.87-.34 1.7 1.7 0 0 0-1 1.55V21a2 2 0 1 1-4 0v-.09a1.7 1.7 0 0 0-1-1.55 1.7 1.7 0 0 0-1.87.34l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.7 1.7 0 0 0 .34-1.87 1.7 1.7 0 0 0-1.55-1H3a2 2 0 1 1 0-4h.09a1.7 1.7 0 0 0 1.55-1 1.7 1.7 0 0 0-.34-1.87l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.7 1.7 0 0 0 1.87.34h0a1.7 1.7 0 0 0 1-1.55V3a2 2 0 1 1 4 0v.09a1.7 1.7 0 0 0 1 1.55h0a1.7 1.7 0 0 0 1.87-.34l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.7 1.7 0 0 0-.34 1.87v0a1.7 1.7 0 0 0 1.55 1H21a2 2 0 1 1 0 4h-.09a1.7 1.7 0 0 0-1.55 1z" />
    </>,
    p
  );

export const PlusIcon = (p: IconProps) => base(<path d="M12 5v14M5 12h14" />, p);
export const ChevronLeftIcon = (p: IconProps) => base(<path d="M15 18l-6-6 6-6" />, p);
export const TrophyIcon = (p: IconProps) =>
  base(
    <>
      <path d="M8 21h8M12 17v4M7 4h10v4a5 5 0 0 1-10 0V4z" />
      <path d="M7 5H4a3 3 0 0 0 3 5M17 5h3a3 3 0 0 1-3 5" />
    </>,
    p
  );
