import type { ReactNode } from "react";

/** Shared page frame for the five tabs. */
export function Screen({ title, lead, children }: { title: string; lead?: string; children?: ReactNode }) {
  return (
    <>
      <header>
        <h1 className="text-3xl font-semibold tracking-tight">{title}</h1>
        {lead ? <p className="mt-2 leading-relaxed text-muted">{lead}</p> : null}
      </header>
      <div className="mt-8 space-y-4">{children}</div>
    </>
  );
}

export function Card({ children }: { children: ReactNode }) {
  return <section className="rounded-2xl border border-line bg-surface p-5">{children}</section>;
}

/** Says plainly what a screen will do once its milestone is built. */
export function ComingNext({ milestone, children }: { milestone: string; children: ReactNode }) {
  return (
    <Card>
      <p className="text-xs font-medium uppercase tracking-wider text-muted">{milestone}</p>
      <p className="mt-2 leading-relaxed">{children}</p>
    </Card>
  );
}

export function ListSkeleton({ rows = 4 }: { rows?: number }) {
  return (
    <div className="space-y-3" aria-hidden="true">
      {Array.from({ length: rows }, (_, row) => (
        <div key={row} className="h-18 rounded-2xl border border-line bg-surface" />
      ))}
    </div>
  );
}
