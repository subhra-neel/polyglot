import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { ListSkeleton } from "@/components/screen";
import { type LabSentence, SentenceLab } from "@/components/sentence-lab";
import { getCurrentUser } from "@/lib/auth";
import { PATTERNS, build, getPattern } from "@/lib/patterns";
import { getProgress } from "@/lib/progress";
import { getTtsProvider, labAudioUrls } from "@/lib/tts";

export const metadata: Metadata = { title: "Build" };

export function generateStaticParams() {
  return PATTERNS.patterns.map((p) => ({ pattern: p.id }));
}

async function Lab({ params }: { params: Promise<{ pattern: string }> }) {
  const { pattern: id } = await params;
  const pattern = getPattern(id);
  if (!pattern) notFound();
  await getCurrentUser();

  const showScript = await getProgress()
    .then((p) => p.show_script)
    .catch(() => false);

  const tts = getTtsProvider();
  const sentences: Record<string, LabSentence> = {};
  for (const slot of pattern.words) {
    for (const ending of pattern.endings) {
      const s = build(pattern.id, slot.word, ending.id)!;
      sentences[`${slot.word}|${ending.id}`] = {
        ...s,
        audio: labAudioUrls(pattern.id, slot.word, ending.id, s.script, tts),
      };
    }
  }

  return (
    <>
      <h1 className="mt-4 text-3xl font-semibold tracking-tight">{pattern.title}</h1>
      <div className="mt-6">
        <SentenceLab pattern={pattern} words={PATTERNS.words} sentences={sentences} showScript={showScript} />
      </div>
    </>
  );
}

export default function PatternPage({ params }: PageProps<"/build/[pattern]">) {
  return (
    <>
      <Link href="/build" className="text-sm font-medium text-accent">
        ‹ All patterns
      </Link>
      <Suspense fallback={<ListSkeleton rows={3} />}>
        <Lab params={params} />
      </Suspense>
    </>
  );
}
