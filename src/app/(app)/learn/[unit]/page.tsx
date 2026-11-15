import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { ListSkeleton } from "@/components/screen";
import { SetupNotice } from "@/components/setup-notice";
import { getCurrentUser } from "@/lib/auth";
import { ContentUnavailableError, getUnit, isSlug, type Unit } from "@/lib/lessons";

export const metadata: Metadata = { title: "Unit" };

async function UnitView({ params }: { params: Promise<{ unit: string }> }) {
  const { unit: unitSlug } = await params;
  if (!isSlug(unitSlug)) notFound();
  await getCurrentUser();

  let unit: Unit | null;
  try {
    unit = await getUnit(unitSlug);
  } catch (error) {
    if (error instanceof ContentUnavailableError) return <SetupNotice detail={error.message} />;
    throw error;
  }
  if (!unit) notFound();

  return (
    <>
      <header>
        <p className="text-sm text-muted">
          Level {unit.level} · Unit {unit.position}
        </p>
        <h1 className="mt-1 text-3xl font-semibold tracking-tight">{unit.title}</h1>
      </header>

      {unit.lessons.length === 0 ? (
        <p className="mt-8 text-muted">Lessons for this unit are coming soon.</p>
      ) : (
        <ol className="mt-8 space-y-3">
          {unit.lessons.map((lesson) => (
            <li key={lesson.slug}>
              <Link
                href={`/learn/${unit.slug}/${lesson.slug}`}
                className="flex items-center gap-4 rounded-2xl border border-line bg-surface p-4"
              >
                <span
                  className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-full font-medium ${
                    lesson.completed ? "bg-accent text-accent-ink" : "bg-accent-soft text-accent"
                  }`}
                >
                  {lesson.completed ? "✓" : lesson.position}
                </span>
                <span className="flex-1">
                  <span className="block font-medium leading-snug">{lesson.title}</span>
                  <span className="mt-0.5 block text-sm text-muted">
                    {lesson.sentence_count} sentences{lesson.completed ? " · done" : ""}
                  </span>
                </span>
                <span aria-hidden="true" className="text-muted">
                  ›
                </span>
              </Link>
            </li>
          ))}
        </ol>
      )}
    </>
  );
}

export default function UnitPage({ params }: PageProps<"/learn/[unit]">) {
  return (
    <>
      <Link href="/learn" className="text-sm font-medium text-accent">
        ‹ All units
      </Link>
      <div className="mt-4">
        <Suspense fallback={<ListSkeleton rows={2} />}>
          <UnitView params={params} />
        </Suspense>
      </div>
    </>
  );
}
