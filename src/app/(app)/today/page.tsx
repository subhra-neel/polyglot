import type { Metadata } from "next";
import Link from "next/link";
import { Card, ComingNext, Screen } from "@/components/screen";

export const metadata: Metadata = { title: "Today" };

export default function TodayPage() {
  return (
    <Screen title="Today" lead="Kannada · Level 1 · Absolute beginner">
      <Card>
        <p className="text-xs font-medium uppercase tracking-wider text-muted">Start here</p>
        <p className="mt-2 text-xl font-medium tracking-tight">Greetings and politeness</p>
        <p className="mt-1 text-muted">Unit 1 of 8</p>
        <Link
          href="/learn/greetings"
          className="mt-5 flex h-12 items-center justify-center rounded-full bg-accent font-medium text-accent-ink"
        >
          Start Unit 1
        </Link>
      </Card>
      <ComingNext milestone="Coming in milestone 4">
        Sentences due for revision and your daily target will show here.
      </ComingNext>
    </Screen>
  );
}
