import type { Metadata } from "next";
import { Suspense } from "react";
import { Card, ComingNext, Screen } from "@/components/screen";
import { getCurrentUser } from "@/lib/auth";
import { signOut } from "@/app/sign-in/actions";

export const metadata: Metadata = { title: "Me" };

async function Account() {
  const user = await getCurrentUser();

  return (
    <Card>
      <p className="text-xs font-medium uppercase tracking-wider text-muted">Signed in as</p>
      <p className="mt-2 break-all font-medium">{user.email ?? "Unknown email"}</p>
      <form action={signOut} className="mt-5">
        <button type="submit" className="h-12 w-full rounded-full border border-line font-medium">
          Sign out
        </button>
      </form>
    </Card>
  );
}

export default function MePage() {
  return (
    <Screen title="Me">
      <Suspense fallback={<div className="h-40 rounded-2xl border border-line bg-surface" aria-hidden="true" />}>
        <Account />
      </Suspense>
      <ComingNext milestone="Coming in milestone 4">
        Sentences you have retained, review accuracy, recurring mistakes, and settings.
      </ComingNext>
    </Screen>
  );
}
