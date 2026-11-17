import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { Card, ListSkeleton, Screen } from "@/components/screen";
import { SetupNotice } from "@/components/setup-notice";
import { getCurrentUser } from "@/lib/auth";
import { ContentUnavailableError } from "@/lib/lessons";
import { type Progress, getProgress } from "@/lib/progress";

export const metadata: Metadata = { title: "Today" };

const primary = "mt-5 flex h-12 items-center justify-center rounded-full bg-accent font-medium text-accent-ink";
const secondary = "mt-5 flex h-12 items-center justify-center rounded-full border border-line font-medium";

function GoalBar({ done, goal }: { done: number; goal: number }) {
  const share = Math.min(100, Math.round((done / goal) * 100));
  return (
    <div>
      <div className="flex items-baseline justify-between text-sm">
        <span className="text-muted">Today&apos;s reviews</span>
        <span className="font-medium">
          {done} / {goal}
        </span>
      </div>
      <div
        className="mt-2 h-2 overflow-hidden rounded-full bg-accent-soft"
        role="progressbar"
        aria-valuenow={done}
        aria-valuemin={0}
        aria-valuemax={goal}
        aria-label="Reviews done today"
      >
        <div className="h-full rounded-full bg-accent" style={{ width: `${share}%` }} />
      </div>
    </div>
  );
}

function TodayCards({ progress }: { progress: Progress }) {
  const next = progress.next_lesson;
  const due = progress.due_now;
  // Revision first when anything is due: keeping old sentences beats adding new ones.
  const reviseFirst = due > 0;

  const reviseCard = (
    <Card>
      <p className="text-xs font-medium uppercase tracking-wider text-muted">Revise</p>
      <p className="mt-2 text-xl font-medium tracking-tight">
        {due > 0 ? `${due} ${due === 1 ? "sentence is" : "sentences are"} ready to practise` : "Nothing due right now"}
      </p>
      {due === 0 && progress.due_today > 0 ? (
        <p className="mt-1 text-muted">{progress.due_today} more come due later today.</p>
      ) : null}
      <div className="mt-4">
        <GoalBar done={progress.reviewed_today} goal={progress.daily_review_goal} />
      </div>
      {due > 0 ? (
        <Link href="/review" className={reviseFirst ? primary : secondary}>
          Revise now
        </Link>
      ) : null}
    </Card>
  );

  const lessonCard = (
    <Card>
      <p className="text-xs font-medium uppercase tracking-wider text-muted">{next ? "Next lesson" : "Lessons"}</p>
      {next ? (
        <>
          <p className="mt-2 text-xl font-medium tracking-tight">{next.lesson_title}</p>
          <p className="mt-1 text-muted">
            Unit {next.unit_position} · {next.unit_title}
          </p>
          <Link href={`/learn/${next.unit_slug}/${next.lesson_slug}`} className={reviseFirst ? secondary : primary}>
            {progress.lessons_completed === 0 ? "Start" : "Continue"}
          </Link>
        </>
      ) : (
        <p className="mt-2 leading-relaxed text-muted">
          You have finished every lesson available so far. More units are on the way.
        </p>
      )}
    </Card>
  );

  const tutorCard = (
    <Card>
      <p className="text-xs font-medium uppercase tracking-wider text-muted">AI tutor</p>
      <p className="mt-2 text-xl font-medium tracking-tight">Practise a real conversation</p>
      <p className="mt-1 leading-relaxed text-muted">
        Chat with a tea-stall owner, an auto driver or a new neighbour. Type Kannada in English letters; mistakes are
        corrected gently.
      </p>
      <Link href="/talk" className={secondary}>
        Talk to the tutor
      </Link>
    </Card>
  );

  return reviseFirst ? (
    <>
      {reviseCard}
      {lessonCard}
      {tutorCard}
    </>
  ) : (
    <>
      {lessonCard}
      {progress.sentences_started > 0 ? reviseCard : null}
      {tutorCard}
    </>
  );
}

async function TodayContent() {
  await getCurrentUser();
  let progress: Progress;
  try {
    progress = await getProgress();
  } catch (error) {
    if (error instanceof ContentUnavailableError) return <SetupNotice detail={error.message} />;
    throw error;
  }
  return <TodayCards progress={progress} />;
}

export default function TodayPage() {
  return (
    <Screen title="Today" lead="Kannada · Level 1 · Absolute beginner">
      <Suspense fallback={<ListSkeleton rows={2} />}>
        <TodayContent />
      </Suspense>
    </Screen>
  );
}
