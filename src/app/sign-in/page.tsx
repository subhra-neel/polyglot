import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { getSupabaseEnv } from "@/lib/env";
import { SignInForm } from "./sign-in-form";

export const metadata: Metadata = { title: "Sign in" };

export default function SignInPage() {
  const connected = getSupabaseEnv() !== null;

  return (
    <main className="mx-auto w-full max-w-md flex-1 px-6 pb-10 pt-10">
      <Link href="/" className="text-sm font-medium tracking-wide text-accent">
        Polyglot
      </Link>
      <h1 className="mt-6 text-3xl font-semibold tracking-tight">Sign in</h1>
      <p className="mt-3 text-muted">Your progress and revision schedule are saved to your account.</p>

      {connected ? null : (
        <div role="status" className="mt-6 rounded-xl border border-line bg-accent-soft p-4 text-sm leading-relaxed">
          <p className="font-medium">Setup needed</p>
          <p className="mt-1">
            This deployment is not connected to Supabase yet. Add the two Supabase settings in Vercel and
            redeploy. Steps are in <code className="font-mono">docs/SETUP.md</code>.
          </p>
        </div>
      )}

      {/* useSearchParams() needs a Suspense boundary when prerendering. */}
      <Suspense fallback={null}>
        <SignInForm disabled={!connected} />
      </Suspense>
    </main>
  );
}
