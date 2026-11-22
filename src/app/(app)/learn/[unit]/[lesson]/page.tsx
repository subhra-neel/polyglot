import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { LessonSession } from "@/components/lesson-session";
import { ListSkeleton } from "@/components/screen";
import { SetupNotice } from "@/components/setup-notice";
import { getCurrentUser } from "@/lib/auth";
import { buildSession } from "@/lib/lesson-session";
import { ContentUnavailableError, getLesson, isSlug, type Lesson } from "@/lib/lessons";
import { getProgress } from "@/lib/progress";
import { audioUrlsFor, getTtsProvider } from "@/lib/tts";
import { freshSeed, seeded } from "@/lib/unit-check";

export const metadata: Metadata = { title: "Lesson" };

type Params = Promise<{ unit: string; lesson: string }>;

async function Session({ params }: { params: Params }) {
  const { unit: unitSlug, lesson: lessonSlug } = await params;
  if (!isSlug(unitSlug) || !isSlug(lessonSlug)) notFound();
  await getCurrentUser();

  let data: Lesson | null;
  let settings: { show_english: boolean; show_script: boolean };
  try {
    [data, settings] = await Promise.all([getLesson(unitSlug, lessonSlug), getProgress()]);
  } catch (error) {
    if (error instanceof ContentUnavailableError) return <SetupNotice detail={error.message} />;
    throw error;
  }
  if (!data) notFound();
  if (data.sentences.length === 0) return <p className="text-muted">No checked sentences in this lesson yet.</p>;

  const tts = getTtsProvider();
  const sentences = data.sentences.map((s) => ({ ...s, audio: audioUrlsFor(s.id, s.script, tts) }));
  const steps = buildSession(
    sentences.map((s) => ({
      id: s.id,
      roman: s.roman,
      meaning: s.meaning,
      why: s.why,
      tokens: s.tokens,
      variants: s.variants,
      audio: s.audio,
    })),
    seeded(freshSeed()),
  );

  return (
    <LessonSession
      unitSlug={data.unit.slug}
      lessonSlug={data.lesson.slug}
      unitTitle={data.unit.title}
      lessonTitle={data.lesson.title}
      lessonPosition={data.lesson.position}
      lessonCount={data.lesson_count}
      next={data.next_lesson}
      sentences={sentences}
      steps={steps}
      showEnglish={settings.show_english}
      showScript={settings.show_script}
    />
  );
}

export default function LessonPage({ params }: PageProps<"/learn/[unit]/[lesson]">) {
  return (
    <Suspense fallback={<ListSkeleton rows={2} />}>
      <Session params={params} />
    </Suspense>
  );
}
