import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { getSupabaseEnv } from "@/lib/env";
import { ForgotForm } from "./forgot-form";

export const metadata: Metadata = { title: "Forgot password" };

export default function ForgotPasswordPage() {
  return (
    <main className="mx-auto w-full max-w-md flex-1 px-6 pb-10 pt-10">
      <Link href="/sign-in" className="text-sm font-medium text-accent">
        ‹ Back to sign in
      </Link>
      <h1 className="mt-6 text-3xl font-semibold tracking-tight">Forgot your password?</h1>
      <p className="mt-3 text-muted">Enter the email you signed up with and we&apos;ll send a link to set a new one.</p>
      {/* useSearchParams() needs a Suspense boundary when prerendering. */}
      <Suspense fallback={null}>
        <ForgotForm disabled={getSupabaseEnv() === null} />
      </Suspense>
    </main>
  );
}
