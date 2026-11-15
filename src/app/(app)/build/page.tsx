import type { Metadata } from "next";
import Link from "next/link";
import { Screen } from "@/components/screen";
import { PATTERNS, getWord } from "@/lib/patterns";

export const metadata: Metadata = { title: "Build" };

export default function BuildPage() {
  return (
    <Screen title="Build" lead="Make your own sentences from patterns, then practise them.">
      <ul className="space-y-3">
        {PATTERNS.patterns.map((pattern) => {
          const example = pattern.template
            .replace("{word}", getWord(pattern.words[0].word)!.roman)
            .replace("{ending}", pattern.endings[0].roman);
          return (
            <li key={pattern.id}>
              <Link href={`/build/${pattern.id}`} className="flex items-center gap-4 rounded-2xl border border-line bg-surface p-4">
                <span className="flex-1">
                  <span className="block font-medium leading-snug">{pattern.title}</span>
                  <span className="mt-1 block text-sm text-muted">
                    {example} · {pattern.words.length * pattern.endings.length} sentences
                  </span>
                </span>
                <span aria-hidden="true" className="text-muted">
                  ›
                </span>
              </Link>
            </li>
          );
        })}
      </ul>
    </Screen>
  );
}
