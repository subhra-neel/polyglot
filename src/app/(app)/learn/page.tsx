import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { ListSkeleton, Screen } from "@/components/screen";
import { SetupNotice } from "@/components/setup-notice";
import { getCurrentUser } from "@/lib/auth";
import { ContentUnavailableError, getUnits, type UnitSummary } from "@/lib/lessons";

export const metadata: Metadata = { title: "Learn" };

function UnitRow({ unit }: { unit: UnitSummary }) {
  const ready = unit.lesson_count > 0;
  const done = ready && unit.completed_count === unit.lesson_count;
  const badge = (
    <span
      className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-full font-medium ${
        ready ? "bg-accent-soft text-accent" : "border border-line text-muted"
      }`}
    >
      {done ? "✓" : unit.position}
    </span>
  );

  if (!ready) {
    return (
      <li className="flex items-center gap-4 rounded-2xl border border-line p-4">
        {badge}
        <span className="flex-1">
          <span className="block font-medium leading-snug text-muted">{unit.title}</span>
          <span className="mt-0.5 block text-sm text-muted">Coming soon</span>
        </span>
      </li>
    );
  }

  return (
    <li>
      <Link href={`/learn/${unit.slug}`} className="flex items-center gap-4 rounded-2xl border border-line bg-surface p-4">
        {badge}
        <span className="flex-1">
          <span className="block font-medium leading-snug">{unit.title}</span>
          <span className="mt-0.5 block text-sm text-muted">
            {unit.completed_count} of {unit.lesson_count} lessons done
          </span>
        </span>
        <span aria-hidden="true" className="text-muted">
          ›
        </span>
      </Link>
    </li>
  );
}

/** What each level lets you do (matches the levels seeded in 0001_init.sql). */
const LEVELS: Record<number, { title: string; canDo: string }> = {
  1: { title: "Level 1 · Absolute beginner", canDo: "Greet, introduce yourself, ask for things, ask where and how much." },
  2: { title: "Level 2 · Basic communication", canDo: "Describe your day, family and plans; talk about yesterday." },
  3: { title: "Level 3 · Conversational", canDo: "Shop, bargain, give and follow directions, explain a simple problem." },
  4: { title: "Level 4 · Intermediate", canDo: "Handle work, phone calls, complaints and a clinic visit; give opinions." },
  5: { title: "Level 5 · Advanced", canDo: "Converse spontaneously, joke, disagree politely, follow films and news." },
};

async function UnitList() {
  await getCurrentUser();
  let levels: { level: number; units: UnitSummary[] }[];
  try {
    const all = await Promise.all([1, 2, 3, 4, 5].map(async (level) => ({ level, units: await getUnits(level) })));
    // Level 1 always shows; later levels appear once they have lessons.
    levels = all.filter((l) => l.level === 1 || l.units.some((u) => u.lesson_count > 0));
  } catch (error) {
    if (error instanceof ContentUnavailableError) return <SetupNotice detail={error.message} />;
    throw error;
  }

  return (
    <div className="space-y-10">
      {levels.map(({ level, units }) => (
        <section key={level} aria-labelledby={`level-${level}`}>
          <h2 id={`level-${level}`} className="text-lg font-semibold tracking-tight">
            {LEVELS[level].title}
          </h2>
          <p className="mt-1 text-sm leading-relaxed text-muted">{LEVELS[level].canDo}</p>
          <ol className="mt-4 space-y-3">
            {units.map((unit) => (
              <UnitRow key={unit.slug} unit={unit} />
            ))}
          </ol>
        </section>
      ))}
    </div>
  );
}

export default function LearnPage() {
  return (
    <Screen title="Learn" lead="Spoken Bengaluru Kannada, one unit at a time. Each level builds on the one before.">
      <Suspense fallback={<ListSkeleton />}>
        <UnitList />
      </Suspense>
    </Screen>
  );
}
