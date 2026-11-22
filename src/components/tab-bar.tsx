"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Suspense, type ReactNode } from "react";

type Tab = { href: string; label: string; also?: string[]; icon: ReactNode };

const stroke = {
  fill: "none",
  stroke: "currentColor",
  strokeWidth: 2,
  strokeLinecap: "round",
  strokeLinejoin: "round",
} as const;

function Icon({ children }: { children: ReactNode }) {
  return (
    <svg viewBox="0 0 24 24" className="h-7 w-7" aria-hidden="true" {...stroke}>
      {children}
    </svg>
  );
}

const TABS: Tab[] = [
  {
    href: "/learn",
    label: "Home",
    icon: (
      <Icon>
        <path d="M4 11.5 12 5l8 6.5V20a1 1 0 0 1-1 1h-4.5v-5.5h-5V21H5a1 1 0 0 1-1-1z" />
      </Icon>
    ),
  },
  {
    href: "/practice",
    label: "Practice",
    also: ["/review", "/build"],
    icon: (
      <Icon>
        <path d="M4 12a8 8 0 0 1 13.7-5.6M20 12a8 8 0 0 1-13.7 5.6" />
        <path d="M18 3v4h-4M6 21v-4h4" />
      </Icon>
    ),
  },
  {
    href: "/talk",
    label: "Tutor",
    icon: (
      <Icon>
        <rect x="9" y="3" width="6" height="11" rx="3" />
        <path d="M5.5 11.5a6.5 6.5 0 0 0 13 0M12 18v3" />
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

const under = (pathname: string, href: string) => pathname === href || pathname.startsWith(`${href}/`);

/** Lessons and unit checks take the whole screen, like a focused task. */
export const isFocusScreen = (pathname: string) => /^\/learn\/[^/]+\/[^/]+$/.test(pathname);

/**
 * Four tabs: the path (Home), Practice, the Tutor and Me.
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
  if (isFocusScreen(pathname)) return null;
  return (
    <nav aria-label="Main" className="fixed inset-x-0 bottom-0 z-10 border-t-2 border-line bg-surface pb-[env(safe-area-inset-bottom)]">
      <div className="mx-auto flex h-16 max-w-md items-stretch px-2">
        {TABS.map((tab) => {
          const active = under(pathname, tab.href) || (tab.also ?? []).some((h) => under(pathname, h));
          return (
            <Link
              key={tab.href}
              href={tab.href}
              aria-current={active ? "page" : undefined}
              className={`flex flex-1 flex-col items-center justify-center gap-0.5 text-xs font-semibold ${
                active ? "text-accent" : "text-muted"
              }`}
            >
              <span className={`flex h-8 w-12 items-center justify-center rounded-xl ${active ? "bg-accent-soft" : ""}`}>{tab.icon}</span>
              {tab.label}
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
