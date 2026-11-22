import type { Metadata } from "next";
import { Suspense } from "react";
import { LearningPathView } from "@/components/learning-path";
import { ListSkeleton } from "@/components/screen";
import { SetupNotice } from "@/components/setup-notice";
import { getCurrentUser } from "@/lib/auth";
import { ContentUnavailableError } from "@/lib/lessons";
import { getLearningPath, type LearningPath } from "@/lib/path";

export const metadata: Metadata = { title: "Home" };

async function Path() {
  await getCurrentUser();
  let path: LearningPath;
  try {
    path = await getLearningPath();
  } catch (error) {
    if (error instanceof ContentUnavailableError) return <SetupNotice detail={error.message} />;
    throw error;
  }
  return <LearningPathView path={path} />;
}

export default function HomePage() {
  return (
    <>
      <header className="mb-6">
        <p className="text-sm font-semibold uppercase tracking-wider text-accent">Polyglot · Kannada</p>
        <h1 className="mt-1 text-3xl font-semibold tracking-tight">Your path</h1>
      </header>
      <Suspense fallback={<ListSkeleton rows={3} />}>
        <Path />
      </Suspense>
    </>
  );
}
