import type { Metadata } from "next";
import { Suspense } from "react";
import { Card, ListSkeleton, Screen } from "@/components/screen";
import { SettingsForm } from "@/components/settings-form";
import { SetupNotice } from "@/components/setup-notice";
import { signOut } from "@/app/sign-in/actions";
import { getCurrentUser } from "@/lib/auth";
import { ContentUnavailableError } from "@/lib/lessons";
import Link from "next/link";
import { getProgress, getWeakSpots, MISTAKE_LABELS, type WeakSpots } from "@/lib/progress";

export const metadata: Metadata = { title: "Me" };

function Stat({ value, label }: { value: string | number; label: string }) {
  return (
    <div className="rounded-xl bg-accent-soft p-4">
      <p className="text-2xl font-semibold tracking-tight">{value}</p>
      <p className="mt-1 text-sm text-muted">{label}</p>
    </div>
  );
}

async function MeContent() {
  const user = await getCurrentUser();
  let progress;
  let spots: WeakSpots;
  try {
    [progress, spots] = await Promise.all([getProgress(), getWeakSpots()]);
  } catch (error) {
    if (error instanceof ContentUnavailableError) return <SetupNotice detail={error.message} />;
    throw error;
  }

  return (
    <>
      <Card>
        <h2 className="text-xs font-medium uppercase tracking-wider text-muted">Progress</h2>
        <div className="mt-3 grid grid-cols-2 gap-3">
          <Stat value={progress.sentences_started} label="sentences learning" />
          <Stat value={progress.sentences_retained} label="known for a week or more" />
          <Stat
            value={progress.recall_rate_30d === null ? "–" : `${progress.recall_rate_30d}%`}
            label="recalled, last 30 days"
          />
          <Stat value={progress.lessons_completed} label="lessons finished" />
        </div>
        <p className="mt-3 text-sm leading-relaxed text-muted">
          {progress.reviews_30d} reviews in the last 30 days.
          {progress.flags_open > 0
            ? ` ${progress.flags_open} ${progress.flags_open === 1 ? "sentence" : "sentences"} you flagged await re-checking.`
            : ""}
        </p>
      </Card>

      <Card>
        <h2 className="text-xs font-medium uppercase tracking-wider text-muted">Weak spots</h2>
        {spots.units.length === 0 && spots.mistakes.length === 0 ? (
          <p className="mt-3 leading-relaxed text-muted">
            Take a Unit check (at the end of each unit in Learn) or talk to the tutor, and the areas to work on will
            show here.
          </p>
        ) : null}
        {spots.units.length ? (
          <>
            <p className="mt-3 text-sm text-muted">Unit checks, weakest first</p>
            <ul className="mt-2 space-y-2">
              {spots.units.map((u) => (
                <li key={u.slug}>
                  <Link
                    href={`/learn/${u.slug}/check`}
                    className="flex items-center justify-between gap-3 rounded-xl border border-line p-3"
                  >
                    <span className="min-w-0">
                      <span className="block font-medium leading-snug">{u.title}</span>
                      <span className="block text-sm text-muted">
                        Level {u.level} · best {u.best_pct}% · {u.attempts} {u.attempts === 1 ? "try" : "tries"}
                      </span>
                    </span>
                    <span
                      className={`shrink-0 text-lg font-semibold ${u.last_pct >= 80 ? "text-accent" : u.last_pct < 50 ? "text-danger" : ""}`}
                    >
                      {u.last_score}/{u.last_total}
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          </>
        ) : null}
        {spots.mistakes.length ? (
          <>
            <p className="mt-5 text-sm text-muted">Mistakes the tutor keeps seeing</p>
            <ul className="mt-2 space-y-2">
              {spots.mistakes.map((m) => (
                <li key={m.tag} className="rounded-xl bg-accent-soft p-3 text-sm leading-relaxed">
                  <span className="font-medium">{MISTAKE_LABELS[m.tag] ?? m.tag}</span>
                  <span className="text-muted"> · {m.occurrences}×</span>
                  {m.example?.said ? (
                    <span className="block text-muted">
                      e.g. “{m.example.said}”{m.example.corrected ? ` → ${m.example.corrected}` : ""}
                    </span>
                  ) : null}
                </li>
              ))}
            </ul>
          </>
        ) : null}
      </Card>

      <Card>
        <h2 className="text-xs font-medium uppercase tracking-wider text-muted">Settings</h2>
        <div className="mt-1">
          <SettingsForm
            showEnglish={progress.show_english}
            showScript={progress.show_script}
            dailyReviewGoal={progress.daily_review_goal}
          />
        </div>
      </Card>

      <Card>
        <p className="text-xs font-medium uppercase tracking-wider text-muted">Signed in as</p>
        <p className="mt-2 break-all font-medium">{user.email ?? "Unknown email"}</p>
        <form action={signOut} className="mt-5">
          <button type="submit" className="h-12 w-full rounded-full border border-line font-medium">
            Sign out
          </button>
        </form>
      </Card>
    </>
  );
}

export default function MePage() {
  return (
    <Screen title="Me">
      <Suspense fallback={<ListSkeleton rows={3} />}>
        <MeContent />
      </Suspense>
    </Screen>
  );
}
