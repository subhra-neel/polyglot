import type { Metadata } from "next";
import { Suspense } from "react";
import { Card, ComingNext, Screen } from "@/components/screen";
import { getCurrentUser } from "@/lib/auth";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export const metadata: Metadata = { title: "Learn" };

type Unit = { position: number; title: string };

/** Level 1 units, read from the database with the learner's own session. */
async function UnitList() {
  await getCurrentUser();
  const supabase = await createSupabaseServerClient();
  if (!supabase) return null;

  const { data, error } = await supabase
    .from("units")
    .select("position, title, levels!inner(language_code, number)")
    .eq("levels.language_code", "kn")
    .eq("levels.number", 1)
    .order("position");

  if (error) {
    return (
      <Card>
        <p className="font-medium">The database is not set up yet</p>
        <p className="mt-2 text-sm leading-relaxed text-muted">
          Run <code className="font-mono">supabase/migrations/0001_init.sql</code> in the Supabase SQL editor.
          Steps are in <code className="font-mono">docs/SETUP.md</code>.
        </p>
        <p className="mt-3 font-mono text-xs text-muted">{error.message}</p>
      </Card>
    );
  }

  const units: Unit[] = data ?? [];

  return (
    <ol className="space-y-3">
      {units.map((unit) => (
        <li key={unit.position} className="flex items-center gap-4 rounded-2xl border border-line bg-surface p-4">
          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-accent-soft font-medium text-accent">
            {unit.position}
          </span>
          <span className="font-medium leading-snug">{unit.title}</span>
        </li>
      ))}
    </ol>
  );
}

function UnitListSkeleton() {
  return (
    <div className="space-y-3" aria-hidden="true">
      {[0, 1, 2, 3].map((row) => (
        <div key={row} className="h-18 rounded-2xl border border-line bg-surface" />
      ))}
    </div>
  );
}

export default function LearnPage() {
  return (
    <Screen title="Learn" lead="Level 1 · Greet, introduce yourself, ask for things, ask where and how much.">
      <Suspense fallback={<UnitListSkeleton />}>
        <UnitList />
      </Suspense>
      <ComingNext milestone="Coming in milestone 2">
        Each unit opens into sentence cards with audio once the first lesson content is loaded.
      </ComingNext>
    </Screen>
  );
}
