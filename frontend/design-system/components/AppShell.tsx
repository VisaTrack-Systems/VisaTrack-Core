/**
 * AppShell: Signed-in application frame (Clio-style). Renders the blue top
 * bar, the navy left sidebar with role navigation and the signed-in user's
 * account controls, and the page content area. On small screens the sidebar
 * collapses behind a menu button.
 *
 * The shell holds no business logic: App passes in the navigation items and
 * the account callbacks.
 */

import { FileText, LogOut, Menu, ShieldCheck, UserCircle, X, type LucideIcon } from 'lucide-react';
import Link from 'next/link';
import { type ReactNode, useState } from 'react';

import { cx } from './ui';

// ── Sidebar building blocks ─────────────────────────────────────────────────

type SidebarNavItemProps = {
  label: string;
  icon: LucideIcon;
  active: boolean;
  onClick: () => void;
};

export function SidebarNavItem({ label, icon: Icon, active, onClick }: SidebarNavItemProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-current={active ? 'page' : undefined}
      className={cx(
        'flex w-full items-center gap-3 rounded-r-md py-2 pl-4 pr-3 text-sm font-medium transition-colors',
        active ? 'bg-primary-600 text-white' : 'text-white/85 hover:bg-white/10 hover:text-white'
      )}
    >
      <Icon className="h-4 w-4 shrink-0" aria-hidden="true" />
      {label}
    </button>
  );
}

/** Optional labelled group of nav items, e.g. "Settings". */
export function SidebarGroup({ label, children }: { label?: string; children: ReactNode }) {
  return (
    <div className="space-y-0.5 pb-3">
      {label ? (
        <p className="px-4 pb-1 pt-2 text-[11px] font-semibold uppercase tracking-wider text-white/50">{label}</p>
      ) : null}
      {children}
    </div>
  );
}

// ── Shell ───────────────────────────────────────────────────────────────────

type AppShellProps = {
  /** Sidebar contents, built from SidebarGroup and SidebarNavItem. */
  navigation: ReactNode;
  /** Extra controls on the right of the top bar (e.g. the role switcher). */
  topBarActions?: ReactNode;
  userName: string;
  userSubtitle: string;
  onOpenProfile: () => void;
  onSignOut: () => void;
  children: ReactNode;
};

function initialsOf(name: string) {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  const initials = parts.slice(0, 2).map((part) => part[0]?.toUpperCase() ?? '');
  return initials.join('') || '?';
}

export function AppShell({
  navigation,
  topBarActions,
  userName,
  userSubtitle,
  onOpenProfile,
  onSignOut,
  children,
}: AppShellProps) {
  const [mobileNavOpen, setMobileNavOpen] = useState(false);

  const sidebar = (
    <div className="flex h-full flex-col">
      {/* Any click inside the nav closes the mobile drawer; no-op on desktop. */}
      <nav aria-label="Main" className="flex-1 overflow-y-auto pr-3 pt-3" onClick={() => setMobileNavOpen(false)}>
        {navigation}
      </nav>

      <div className="border-t border-white/10 p-3">
        <div className="flex items-center gap-3 px-1 pb-3">
          <span
            aria-hidden="true"
            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-primary-600 text-sm font-semibold text-white"
          >
            {initialsOf(userName)}
          </span>
          <div className="min-w-0 leading-tight">
            <p className="truncate text-sm font-semibold text-white">{userName}</p>
            <p className="truncate text-xs text-white/60">{userSubtitle}</p>
          </div>
        </div>
        <div className="space-y-0.5">
          <button
            type="button"
            onClick={onOpenProfile}
            className="flex w-full items-center gap-3 rounded-md px-2 py-1.5 text-sm text-white/85 transition-colors hover:bg-white/10 hover:text-white"
          >
            <UserCircle className="h-4 w-4" aria-hidden="true" />
            Profile
          </button>
          <Link
            href="/legal/privacy"
            className="flex w-full items-center gap-3 rounded-md px-2 py-1.5 text-sm text-white/85 transition-colors hover:bg-white/10 hover:text-white"
          >
            <ShieldCheck className="h-4 w-4" aria-hidden="true" />
            Privacy
          </Link>
          <button
            type="button"
            onClick={onSignOut}
            className="flex w-full items-center gap-3 rounded-md px-2 py-1.5 text-sm text-white/85 transition-colors hover:bg-white/10 hover:text-white"
          >
            <LogOut className="h-4 w-4" aria-hidden="true" />
            Sign Out
          </button>
        </div>
      </div>
    </div>
  );

  return (
    <div className="min-h-screen bg-canvas">
      {/* ── Top bar ── */}
      <header className="sticky top-0 z-50 flex h-14 items-center gap-3 bg-primary-600 px-3 text-white shadow-card sm:px-4">
        <button
          type="button"
          onClick={() => setMobileNavOpen((open) => !open)}
          aria-label={mobileNavOpen ? 'Close navigation' : 'Open navigation'}
          aria-expanded={mobileNavOpen}
          className="rounded-md p-1.5 hover:bg-white/10 lg:hidden"
        >
          {mobileNavOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
        </button>

        <div className="flex items-center gap-2">
          <span className="flex h-8 w-8 items-center justify-center rounded-full bg-white text-primary-600">
            <FileText className="h-4 w-4" aria-hidden="true" />
          </span>
          <div className="leading-tight">
            <p className="text-base font-semibold">VisaTrack</p>
            <p className="hidden text-[11px] text-white/75 sm:block">Immigration Case Management</p>
          </div>
        </div>

        <div className="ml-auto flex items-center gap-2">{topBarActions}</div>
      </header>

      <div className="flex">
        {/* ── Sidebar: fixed column on desktop, drawer on mobile ── */}
        <aside className="sticky top-14 hidden h-[calc(100vh-3.5rem)] w-56 shrink-0 bg-navy-900 lg:block">
          {sidebar}
        </aside>

        {mobileNavOpen ? (
          <div className="fixed inset-0 top-14 z-40 lg:hidden">
            <div className="absolute inset-0 bg-navy-900/50" onClick={() => setMobileNavOpen(false)} aria-hidden="true" />
            <aside className="relative h-full w-64 bg-navy-900 shadow-popover">{sidebar}</aside>
          </div>
        ) : null}

        <div className="min-w-0 flex-1">{children}</div>
      </div>
    </div>
  );
}

// ── Page header ─────────────────────────────────────────────────────────────

/** White title strip at the top of a page inside the shell. */
export function PageHeader({
  title,
  description,
  actions,
  children,
}: {
  title: ReactNode;
  description?: ReactNode;
  actions?: ReactNode;
  /** Rendered under the title row, e.g. a tab strip. */
  children?: ReactNode;
}) {
  return (
    <header className="border-b border-gray-200 bg-white">
      <div className="flex flex-wrap items-center justify-between gap-4 px-4 py-4 sm:px-6 lg:px-8">
        <div className="min-w-0">
          <h1 className="text-xl font-semibold text-gray-900">{title}</h1>
          {description ? <p className="mt-0.5 text-sm text-gray-500">{description}</p> : null}
        </div>
        {actions ? <div className="flex shrink-0 items-center gap-3">{actions}</div> : null}
      </div>
      {children}
    </header>
  );
}
