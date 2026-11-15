import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { NewPasswordForm } from "./new-password-form";

export const metadata: Metadata = { title: "New password" };

/** Only reachable with the session the email link created. */
async function ResetGate() {
  const supabase = await createSupabaseServerClient();
  const { data } = (await supabase?.auth.getClaims()) ?? { data: null };

  if (!data?.claims?.sub) {
    return (
      <div className="mt-8 rounded-2xl border border-line bg-surface p-5 leading-relaxed">
        <p className="font-medium">This link has expired or was already used</p>
        <p className="mt-2 text-muted">Reset links work once and only for a short time.</p>
        <Link
          href="/forgot-password"
          className="mt-5 flex h-12 items-center justify-center rounded-full bg-accent font-medium text-accent-ink"
        >
          Send a new link
        </Link>
      </div>
    );
  }

  return (
    <>
      <p className="mt-3 text-muted">
        Choose a new password for {typeof data.claims.email === "string" ? data.claims.email : "your account"}.
      </p>
      <NewPasswordForm />
    </>
  );
}

export default function ResetPasswordPage() {
  return (
    <main className="mx-auto w-full max-w-md flex-1 px-6 pb-10 pt-10">
      <p className="text-sm font-medium tracking-wide text-accent">Polyglot</p>
      <h1 className="mt-6 text-3xl font-semibold tracking-tight">Set a new password</h1>
      <Suspense fallback={<div className="mt-8 h-60 rounded-2xl border border-line bg-surface" aria-hidden="true" />}>
        <ResetGate />
      </Suspense>
    </main>
  );
}
