import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { ListSkeleton, Screen } from "@/components/screen";
import { SetupNotice } from "@/components/setup-notice";
import { getCurrentUser } from "@/lib/auth";
import { ContentUnavailableError } from "@/lib/lessons";
import { getLearningPath, type LearningPath } from "@/lib/path";

export const metadata: Metadata = { title: "Practice" };

function Tile({ href, title, detail, badge, strong }: { href: string; title: string; detail: string; badge?: string; strong?: boolean }) {
  return (
    <Link
      href={href}
      className={`flex items-center gap-4 rounded-2xl border-2 p-4 shadow-[0_4px_0_0_var(--line)] transition active:translate-y-1 active:shadow-none ${
        strong ? "border-accent bg-accent-soft" : "border-line bg-surface"
      }`}
    >
      <span className="min-w-0 flex-1">
        <span className="block text-lg font-semibold leading-snug">{title}</span>
        <span className="mt-0.5 block text-sm text-muted">{detail}</span>
      </span>
      {badge ? <span className="shrink-0 rounded-xl bg-accent px-3 py-1.5 text-sm font-semibold text-accent-ink">{badge}</span> : null}
      <span aria-hidden="true" className="text-xl text-muted">
        ›
      </span>
    </Link>
  );
}

async function Hub() {
  await getCurrentUser();
  let path: LearningPath;
  try {
    path = await getLearningPath();
  } catch (error) {
    if (error instanceof ContentUnavailableError) return <SetupNotice detail={error.message} />;
    throw error;
  }
  const p = path.progress;
  const started = path.levels.flatMap((l) => l.units).filter((u) => u.lessons.some((x) => x.completed));

  return (
    <div className="space-y-8">
      <section aria-labelledby="revise">
        <h2 id="revise" className="text-xs font-semibold uppercase tracking-wider text-muted">
          Revise
        </h2>
        <div className="mt-3">
          <Tile
            href="/review"
            title="Revise sentences"
            detail={
              p.due_now > 0
                ? `Ready now · ${p.reviewed_today} of ${p.daily_review_goal} done today`
                : p.sentences_started > 0
                  ? `Nothing due right now · ${p.reviewed_today} done today`
                  : "Sentences from finished lessons come back here to keep them fresh"
            }
            badge={p.due_now > 0 ? String(p.due_now) : undefined}
            strong={p.due_now > 0}
          />
        </div>
      </section>

      <section aria-labelledby="checks">
        <h2 id="checks" className="text-xs font-semibold uppercase tracking-wider text-muted">
          Unit checks
        </h2>
        {started.length ? (
          <ul className="mt-3 space-y-3">
            {started.map((u) => (
              <li key={u.slug}>
                <Tile href={`/learn/${u.slug}/check`} title={u.title} detail={`Level ${u.level} · build, hear and say this unit's sentences`} />
              </li>
            ))}
          </ul>
        ) : (
          <p className="mt-3 leading-relaxed text-muted">Finish a lesson and its unit check appears here.</p>
        )}
      </section>

      <section aria-labelledby="lab">
        <h2 id="lab" className="text-xs font-semibold uppercase tracking-wider text-muted">
          Build your own
        </h2>
        <div className="mt-3">
          <Tile href="/build" title="Sentence lab" detail="Swap words into patterns like nanage … bēku and hear the result" />
        </div>
      </section>
    </div>
  );
}

export default function PracticePage() {
  return (
    <Screen title="Practice" lead="Keep what you've learned: revise, check a unit, or build your own sentences.">
      <Suspense fallback={<ListSkeleton rows={3} />}>
        <Hub />
      </Suspense>
    </Screen>
  );
}
