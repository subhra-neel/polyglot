import type { Metadata } from "next";
import { Card, ComingNext, Screen } from "@/components/screen";

export const metadata: Metadata = { title: "Build" };

export default function BuildPage() {
  return (
    <Screen title="Build" lead="Make your own sentences from patterns.">
      <Card>
        <p className="text-xs font-medium uppercase tracking-wider text-muted">Example pattern</p>
        <p className="mt-2 text-xl font-medium tracking-tight">
          nanage <span className="rounded-md bg-accent-soft px-2 py-0.5 text-accent">thing</span> bēku
        </p>
        <p className="mt-2 text-muted">I want (thing)</p>
      </Card>
      <ComingNext milestone="Coming in milestone 3">
        Swap the word in a slot, change who is speaking, or turn a sentence into a question or a negative.
      </ComingNext>
    </Screen>
  );
}
