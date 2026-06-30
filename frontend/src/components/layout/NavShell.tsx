import { NavLink, useNavigate } from "react-router-dom";
import { UserButton } from "@clerk/react";
import type { ReactNode } from "react";
import { ActivityIcon, CalendarIcon, DashboardIcon, DumbbellIcon, ProgramIcon, SettingsIcon } from "./icons";

const navItems = [
  { to: "/", label: "Dashboard", Icon: DashboardIcon, end: true },
  { to: "/exercises", label: "Exercises", Icon: DumbbellIcon, end: false },
  { to: "/programs", label: "Programs", Icon: ProgramIcon, end: false },
  { to: "/activity", label: "Activity", Icon: ActivityIcon, end: false },
  { to: "/settings", label: "Settings", Icon: SettingsIcon, end: false },
];

export default function NavShell({ children }: { children: ReactNode }) {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen bg-bg">
      {/* Desktop sidebar */}
      <aside className="fixed left-0 top-0 hidden h-screen w-56 flex-col border-r border-border bg-surface md:flex">
        <div className="px-5 pb-2 pt-6">
          <span className="text-lg font-bold text-white">
            FitTrack <span className="text-accent">Pro</span>
          </span>
        </div>
        <nav className="flex flex-col gap-0.5 px-3 pt-4">
          {navItems.map(({ to, label, Icon, end }) => (
            <NavLink
              key={to}
              to={to}
              end={end}
              className={({ isActive }) =>
                `flex items-center gap-3 rounded-xl px-4 py-2.5 text-[15px] font-medium transition-colors ${
                  isActive ? "bg-accent-dim text-accent font-semibold" : "text-muted hover:bg-white/5 hover:text-white"
                }`
              }
            >
              <Icon width={18} height={18} />
              {label}
            </NavLink>
          ))}
        </nav>
        <div className="mt-auto flex items-center gap-2 border-t border-border px-5 py-4">
          <UserButton />
          <span className="text-xs text-muted">Trainer account</span>
        </div>
      </aside>

      {/* Mobile top bar */}
      <header className="sticky top-0 z-20 flex items-center justify-between border-b border-border bg-surface px-4 py-3 md:hidden">
        <span className="text-base font-bold text-white">
          FitTrack <span className="text-accent">Pro</span>
        </span>
        <UserButton />
      </header>

      <main className="pb-20 md:ml-56 md:pb-0">
        <div className="mx-auto max-w-5xl px-4 py-5 md:px-8 md:py-8">{children}</div>
      </main>

      {/* Mobile bottom tab bar */}
      <nav className="fixed bottom-0 left-0 right-0 z-20 flex border-t border-border bg-surface md:hidden">
        {navItems.map(({ to, label, Icon, end }) => (
          <NavLink
            key={to}
            to={to}
            end={end}
            onClick={() => navigate(to)}
            className={({ isActive }) =>
              `flex flex-1 flex-col items-center gap-1 py-2.5 text-[11px] font-medium ${
                isActive ? "text-accent" : "text-muted"
              }`
            }
          >
            <Icon width={20} height={20} />
            {label}
          </NavLink>
        ))}
      </nav>
    </div>
  );
}
