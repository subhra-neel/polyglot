import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { Card, ListSkeleton, Screen } from "@/components/screen";
import { SetupNotice } from "@/components/setup-notice";
import { startConversation } from "./actions";
import { getCurrentUser } from "@/lib/auth";
import { getScenarios, listConversations } from "@/lib/conversations";
import { ContentUnavailableError } from "@/lib/lessons";
import { getChatProvider } from "@/lib/llm";

export const metadata: Metadata = { title: "Talk" };

const ERRORS: Record<string, string> = {
  setup: "The tutor isn't set up yet.",
  start: "That conversation couldn't start. Try again.",
};

async function Scenes({ searchParams }: { searchParams: Promise<{ error?: string | string[] }> }) {
  await getCurrentUser();
  const { error: code } = await searchParams;
  const problem = typeof code === "string" ? ERRORS[code] : undefined;
  let scenarios, recent;
  try {
    [scenarios, recent] = await Promise.all([getScenarios(), listConversations(5)]);
  } catch (error) {
    if (error instanceof ContentUnavailableError) return <SetupNotice detail={error.message} />;
    throw error;
  }
  const ready = getChatProvider() !== null;

  return (
    <>
      {problem ? <p className="mb-4 text-sm text-danger">{problem}</p> : null}
      {ready ? null : (
        <Card>
          <p className="font-medium">The tutor isn&apos;t set up yet</p>
          <p className="mt-2 text-sm text-muted">Add SARVAM_API_KEY in Vercel. See docs/SETUP.md.</p>
        </Card>
      )}
      <ul className="space-y-3">
        {scenarios.map((s) => (
          <li key={s.slug}>
            <form action={startConversation} className="rounded-2xl border border-line bg-surface p-5">
              <input type="hidden" name="scenario" value={s.slug} />
              <p className="text-lg font-medium">
                {s.title}
                {s.min_level > 1 ? (
                  <span className="ml-2 rounded-full bg-accent-soft px-2 py-0.5 align-middle text-xs font-medium text-accent">
                    Level {s.min_level}
                  </span>
                ) : null}
              </p>
              <p className="mt-1 leading-relaxed text-muted">{s.setting}</p>
              <p className="mt-2 text-sm text-muted">Goal: {s.goals}</p>
              <button
                type="submit"
                disabled={!ready}
                className="mt-4 h-12 w-full rounded-full bg-accent font-medium text-accent-ink disabled:opacity-50"
              >
                {s.conversations ? "Start again" : "Start"}
              </button>
            </form>
          </li>
        ))}
      </ul>
      <Link href="/talk/self-test" className="mt-6 block text-center text-sm font-medium text-muted">
        Check the tutor&apos;s accuracy
      </Link>
      {recent.length ? (
        <section className="mt-8">
          <h2 className="text-xs font-medium uppercase tracking-wider text-muted">Recent conversations</h2>
          <ul className="mt-3 space-y-2">
            {recent.map((c) => (
              <li key={c.id}>
                <Link href={`/talk/c/${c.id}`} className="flex justify-between rounded-xl border border-line bg-surface p-4">
                  <span className="font-medium">{c.title}</span>
                  <span className="text-sm text-muted">
                    {c.turns} replies · {c.corrections} corrections
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        </section>
      ) : null}
    </>
  );
}

export default function TalkPage({ searchParams }: PageProps<"/talk">) {
  return (
    <Screen title="Talk" lead="Practise real situations. Type Kannada in English letters; the tutor corrects you gently.">
      <Suspense fallback={<ListSkeleton rows={3} />}>
        <Scenes searchParams={searchParams} />
      </Suspense>
    </Screen>
  );
}
