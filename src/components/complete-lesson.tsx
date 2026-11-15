"use client";

import Link from "next/link";
import { useActionState } from "react";
import { completeLesson, type CompleteState } from "@/app/(app)/learn/actions";

type Props = {
  unit: string;
  lesson: string;
  alreadyDone: boolean;
  next: { slug: string; title: string } | null;
};

export function CompleteLesson({ unit, lesson, alreadyDone, next }: Props) {
  const [state, action, pending] = useActionState<CompleteState, FormData>(completeLesson, {});
  const done = alreadyDone || state.done;

  const nextLink = next ? (
    <Link
      href={`/learn/${unit}/${next.slug}`}
      className="flex h-14 items-center justify-center rounded-full bg-accent text-lg font-medium text-accent-ink"
    >
      Next: {next.title}
    </Link>
  ) : (
    <Link
      href={`/learn/${unit}`}
      className="flex h-14 items-center justify-center rounded-full bg-accent text-lg font-medium text-accent-ink"
    >
      Back to the unit
    </Link>
  );

  if (done) {
    return (
      <div className="space-y-4">
        <p role="status" className="text-center text-muted">
          {state.done
            ? state.queued
              ? `Lesson done. ${state.queued} sentences added to your revision.`
              : "Lesson done."
            : "You have finished this lesson. Read through again any time."}
        </p>
        {nextLink}
      </div>
    );
  }

  return (
    <form action={action} className="space-y-3">
      <input type="hidden" name="unit" value={unit} />
      <input type="hidden" name="lesson" value={lesson} />
      {state.error ? <p className="text-center text-sm text-danger">{state.error}</p> : null}
      <button
        type="submit"
        disabled={pending}
        className="h-14 w-full rounded-full bg-accent text-lg font-medium text-accent-ink disabled:opacity-50"
      >
        {pending ? "Saving…" : "I've learned these"}
      </button>
      <p className="text-center text-sm text-muted">They will come back for revision.</p>
    </form>
  );
}
