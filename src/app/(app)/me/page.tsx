import type { Metadata } from "next";
import { Suspense } from "react";
import { Card, ListSkeleton, Screen } from "@/components/screen";
import { SettingsForm } from "@/components/settings-form";
import { SetupNotice } from "@/components/setup-notice";
import { signOut } from "@/app/sign-in/actions";
import { getCurrentUser } from "@/lib/auth";
import { ContentUnavailableError } from "@/lib/lessons";
import Link from "next/link";
import { getPracticeStats, type PracticeStats } from "@/lib/practice-stats";
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
  let practice: PracticeStats;
  try {
    [progress, spots, practice] = await Promise.all([getProgress(), getWeakSpots(), getPracticeStats()]);
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
        <h2 className="text-xs font-medium uppercase tracking-wider text-muted">Practice · last {practice.days} days</h2>
        <p className="mt-2 text-muted">
          Active on {practice.activeDays} {practice.activeDays === 1 ? "day" : "days"}
        </p>
        <ul className="mt-3 space-y-3">
          <SkillRow
            label="Speaking"
            detail={`${practice.speaking.attempts} Say it tries · ${practice.conversation.spoken} spoken tutor replies`}
            right={practice.speaking.clear}
            total={practice.speaking.attempts}
            note="clear"
          />
          <SkillRow label="Listening" detail="Unit check listening questions" right={practice.listening.right} total={practice.listening.total} />
          <SkillRow label="Building sentences" detail="Word order and missing words" right={practice.building.right} total={practice.building.total} />
          <SkillRow label="English → Kannada" detail="Unit check translations" right={practice.translating.right} total={practice.translating.total} />
          <SkillRow
            label="Conversation"
            detail={`${practice.conversation.conversations} conversations · ${practice.conversation.replies} replies`}
            right={practice.conversation.correct}
            total={practice.conversation.replies}
            note="correct"
          />
        </ul>
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

function SkillRow({
  label,
  detail,
  right,
  total,
  note = "right",
}: {
  label: string;
  detail: string;
  right: number;
  total: number;
  note?: string;
}) {
  const pct = total ? Math.round((right / total) * 100) : null;
  return (
    <li>
      <div className="flex items-baseline justify-between gap-3">
        <span className="font-medium">{label}</span>
        <span className="text-sm text-muted">{pct === null ? "not yet" : `${pct}% ${note}`}</span>
      </div>
      <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-line" aria-hidden="true">
        <div className="h-full rounded-full bg-accent" style={{ width: `${pct ?? 0}%` }} />
      </div>
      <p className="mt-1 text-xs text-muted">{detail}</p>
    </li>
  );
}
