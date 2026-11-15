import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { CompleteLesson } from "@/components/complete-lesson";
import { ListSkeleton } from "@/components/screen";
import { SentenceCard } from "@/components/sentence-card";
import { SetupNotice } from "@/components/setup-notice";
import { VoiceStatus } from "@/components/speak-buttons";
import { getCurrentUser } from "@/lib/auth";
import { ContentUnavailableError, getLesson, isSlug, type Lesson } from "@/lib/lessons";
import { audioUrlsFor, getTtsProvider } from "@/lib/tts";

export const metadata: Metadata = { title: "Lesson" };

type Params = Promise<{ unit: string; lesson: string }>;

async function LessonView({ params }: { params: Params }) {
  const { unit: unitSlug, lesson: lessonSlug } = await params;
  if (!isSlug(unitSlug) || !isSlug(lessonSlug)) notFound();
  await getCurrentUser();

  let data: Lesson | null;
  try {
    data = await getLesson(unitSlug, lessonSlug);
  } catch (error) {
    if (error instanceof ContentUnavailableError) return <SetupNotice detail={error.message} />;
    throw error;
  }
  if (!data) notFound();

  const total = data.sentences.length;
  const tts = getTtsProvider();

  return (
    <>
      <Link href={`/learn/${data.unit.slug}`} className="text-sm font-medium text-accent">
        ‹ {data.unit.title}
      </Link>
      <header className="mt-4">
        <p className="text-sm text-muted">
          Lesson {data.lesson.position} of {data.lesson_count}
        </p>
        <h1 className="mt-1 text-3xl font-semibold tracking-tight">{data.lesson.title}</h1>
        <div className="mt-3">
          <VoiceStatus recordedAudio={tts !== null} />
        </div>
      </header>

      {total === 0 ? (
        <p className="mt-8 text-muted">No checked sentences in this lesson yet.</p>
      ) : (
        <>
          <div className="mt-8 space-y-4">
            {data.sentences.map((sentence, i) => (
              <SentenceCard
                key={sentence.id}
                sentence={sentence}
                audio={audioUrlsFor(sentence.id, sentence.script, tts)}
                index={i + 1}
                total={total}
              />
            ))}
          </div>
          <div className="mt-10">
            <CompleteLesson
              unit={data.unit.slug}
              lesson={data.lesson.slug}
              alreadyDone={data.completed}
              next={data.next_lesson}
            />
          </div>
        </>
      )}
    </>
  );
}

export default function LessonPage({ params }: PageProps<"/learn/[unit]/[lesson]">) {
  return (
    <Suspense fallback={<ListSkeleton rows={3} />}>
      <LessonView params={params} />
    </Suspense>
  );
}
