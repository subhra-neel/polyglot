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

async function UnitList() {
  await getCurrentUser();
  let units: UnitSummary[];
  try {
    units = await getUnits();
  } catch (error) {
    if (error instanceof ContentUnavailableError) return <SetupNotice detail={error.message} />;
    throw error;
  }

  return (
    <ol className="space-y-3">
      {units.map((unit) => (
        <UnitRow key={unit.slug} unit={unit} />
      ))}
    </ol>
  );
}

export default function LearnPage() {
  return (
    <Screen title="Learn" lead="Level 1 · Greet, introduce yourself, ask for things, ask where and how much.">
      <Suspense fallback={<ListSkeleton />}>
        <UnitList />
      </Suspense>
    </Screen>
  );
}
