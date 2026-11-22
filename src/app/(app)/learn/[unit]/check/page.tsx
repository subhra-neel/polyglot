import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { ListSkeleton } from "@/components/screen";
import { SetupNotice } from "@/components/setup-notice";
import { UnitCheck } from "@/components/unit-check";
import { getCurrentUser } from "@/lib/auth";
import { ContentUnavailableError, getLesson, getUnit, isSlug } from "@/lib/lessons";
import { audioUrlsFor, getTtsProvider } from "@/lib/tts";
import { buildCheck, type CheckSentence, freshSeed, seeded } from "@/lib/unit-check";

export const metadata: Metadata = { title: "Unit check" };

async function Check({ params }: { params: Promise<{ unit: string }> }) {
  const { unit: unitSlug } = await params;
  if (!isSlug(unitSlug)) notFound();
  await getCurrentUser();

  let sentences: CheckSentence[];
  let title: string;
  try {
    const unit = await getUnit(unitSlug);
    if (!unit || unit.lessons.length === 0) notFound();
    title = unit.title;
    const tts = getTtsProvider();
    const lessons = await Promise.all(unit.lessons.map((l) => getLesson(unitSlug, l.slug)));
    sentences = lessons.flatMap((lesson) =>
      (lesson?.sentences ?? []).map((s) => ({
        id: s.id,
        roman: s.roman,
        meaning: s.meaning,
        why: s.why,
        tokens: s.tokens,
        variants: s.variants,
        audio: audioUrlsFor(s.id, s.script, tts),
      })),
    );
  } catch (error) {
    if (error instanceof ContentUnavailableError) return <SetupNotice detail={error.message} />;
    throw error;
  }

  // A fresh mix every visit.
  const questions = buildCheck(sentences, seeded(freshSeed()));

  return <UnitCheck questions={questions} unitSlug={unitSlug} unitTitle={title} />;
}

export default function UnitCheckPage({ params }: PageProps<"/learn/[unit]/check">) {
  return (
    <Suspense fallback={<ListSkeleton rows={2} />}>
      <Check params={params} />
    </Suspense>
  );
}
