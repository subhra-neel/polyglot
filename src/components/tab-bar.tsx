"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Suspense, type ReactNode } from "react";

type Tab = { href: string; label: string; icon: ReactNode };

const stroke = {
  fill: "none",
  stroke: "currentColor",
  strokeWidth: 1.75,
  strokeLinecap: "round",
  strokeLinejoin: "round",
} as const;

function Icon({ children }: { children: ReactNode }) {
  return (
    <svg viewBox="0 0 24 24" className="h-6 w-6" aria-hidden="true" {...stroke}>
      {children}
    </svg>
  );
}

const SIDE_TABS: Tab[] = [
  {
    href: "/today",
    label: "Today",
    icon: (
      <Icon>
        <circle cx="12" cy="12" r="4" />
        <path d="M12 3v2M12 19v2M3 12h2M19 12h2M5.6 5.6 7 7M17 17l1.4 1.4M5.6 18.4 7 17M17 7l1.4-1.4" />
      </Icon>
    ),
  },
  {
    href: "/learn",
    label: "Learn",
    icon: (
      <Icon>
        <path d="M12 6.5C10 5 7 4.5 4 5v13c3-.5 6 0 8 1.5 2-1.5 5-2 8-1.5V5c-3-.5-6 0-8 1.5zM12 6.5v13" />
      </Icon>
    ),
  },
  {
    href: "/build",
    label: "Build",
    icon: (
      <Icon>
        <rect x="3.5" y="13.5" width="7" height="7" rx="1.5" />
        <rect x="13.5" y="13.5" width="7" height="7" rx="1.5" />
        <rect x="8.5" y="3.5" width="7" height="7" rx="1.5" />
      </Icon>
    ),
  },
  {
    href: "/me",
    label: "Me",
    icon: (
      <Icon>
        <circle cx="12" cy="8.5" r="3.5" />
        <path d="M5 20c.8-3.5 3.6-5.5 7-5.5s6.2 2 7 5.5" />
      </Icon>
    ),
  },
];

function isActive(pathname: string, href: string) {
  return pathname === href || pathname.startsWith(`${href}/`);
}

function SideTab({ tab, active }: { tab: Tab; active: boolean }) {
  return (
    <Link
      href={tab.href}
      aria-current={active ? "page" : undefined}
      className={`flex flex-1 flex-col items-center justify-center gap-1 py-2 text-xs font-medium ${
        active ? "text-accent" : "text-muted"
      }`}
    >
      {tab.icon}
      {tab.label}
    </Link>
  );
}

/**
 * Five tabs. The tutor sits in the middle, one tap from anywhere.
 *
 * On pages whose address is only known at request time (a lesson, say), the
 * bar first renders with no tab highlighted, then highlights once the
 * address is read. Without the Suspense boundary those pages cannot build.
 */
export function TabBar() {
  return (
    <Suspense fallback={<TabBarView pathname="" />}>
      <TabBarWithPath />
    </Suspense>
  );
}

function TabBarWithPath() {
  return <TabBarView pathname={usePathname()} />;
}

function TabBarView({ pathname }: { pathname: string }) {
  const talkActive = isActive(pathname, "/talk");

  return (
    <nav
      aria-label="Main"
      className="fixed inset-x-0 bottom-0 z-10 border-t border-line bg-surface pb-[env(safe-area-inset-bottom)]"
    >
      <div className="mx-auto flex h-16 max-w-md items-stretch px-2">
        <SideTab tab={SIDE_TABS[0]} active={isActive(pathname, SIDE_TABS[0].href)} />
        <SideTab tab={SIDE_TABS[1]} active={isActive(pathname, SIDE_TABS[1].href)} />

        <div className="flex flex-1 items-center justify-center">
          <Link
            href="/talk"
            aria-label="Talk to the tutor"
            aria-current={talkActive ? "page" : undefined}
            className={`-mt-6 flex h-16 w-16 items-center justify-center rounded-full bg-accent text-accent-ink shadow-lg ring-4 ${
              talkActive ? "ring-accent-soft" : "ring-paper"
            }`}
          >
            <svg viewBox="0 0 24 24" className="h-7 w-7" aria-hidden="true" {...stroke}>
              <rect x="9" y="3" width="6" height="11" rx="3" />
              <path d="M5.5 11.5a6.5 6.5 0 0 0 13 0M12 18v3" />
            </svg>
          </Link>
        </div>

        <SideTab tab={SIDE_TABS[2]} active={isActive(pathname, SIDE_TABS[2].href)} />
        <SideTab tab={SIDE_TABS[3]} active={isActive(pathname, SIDE_TABS[3].href)} />
      </div>
    </nav>
  );
}
