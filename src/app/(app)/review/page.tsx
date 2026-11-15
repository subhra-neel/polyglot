import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { ReviewSession, type SessionCard } from "@/components/review-session";
import { ListSkeleton } from "@/components/screen";
import { SetupNotice } from "@/components/setup-notice";
import { getCurrentUser } from "@/lib/auth";
import { ContentUnavailableError } from "@/lib/lessons";
import { getProgress, getReviewQueue } from "@/lib/progress";
import { previewIntervals } from "@/lib/srs";
import { audioUrlsFor, getTtsProvider } from "@/lib/tts";

export const metadata: Metadata = { title: "Revise" };

async function Session() {
  await getCurrentUser();
  let cards, progress;
  try {
    [cards, progress] = await Promise.all([getReviewQueue(20), getProgress()]);
  } catch (error) {
    if (error instanceof ContentUnavailableError) return <SetupNotice detail={error.message} />;
    throw error;
  }

  if (cards.length === 0) {
    return (
      <div className="rounded-2xl border border-line bg-surface p-6">
        <p className="text-xl font-medium">Nothing to revise right now</p>
        <p className="mt-2 leading-relaxed text-muted">
          {progress.sentences_started === 0
            ? "Finish a lesson and its sentences will come back here for practice."
            : "Every sentence is scheduled for later. Come back when they are due."}
        </p>
        <Link
          href={progress.next_lesson ? `/learn/${progress.next_lesson.unit_slug}/${progress.next_lesson.lesson_slug}` : "/learn"}
          className="mt-6 flex h-12 items-center justify-center rounded-full bg-accent font-medium text-accent-ink"
        >
          {progress.next_lesson ? `Next lesson: ${progress.next_lesson.lesson_title}` : "Go to lessons"}
        </Link>
      </div>
    );
  }

  const tts = getTtsProvider();
  const now = new Date();
  const initial: SessionCard[] = cards.map((card) => ({
    card,
    previews: previewIntervals(card, now),
    audio: audioUrlsFor(card.sentence.id, card.sentence.script, tts),
  }));
  return <ReviewSession initial={initial} showScript={progress.show_script} />;
}

export default function ReviewPage() {
  return (
    <>
      <Link href="/today" className="text-sm font-medium text-accent">
        ‹ Today
      </Link>
      <h1 className="mt-4 text-3xl font-semibold tracking-tight">Revise</h1>
      <div className="mt-6">
        <Suspense fallback={<ListSkeleton rows={1} />}>
          <Session />
        </Suspense>
      </div>
    </>
  );
}
