"use client";

import { useSearchParams } from "next/navigation";
import { useActionState } from "react";
import { requestPasswordReset, type ResetRequestState } from "./actions";

export function ForgotForm({ disabled }: { disabled: boolean }) {
  const [state, action, pending] = useActionState<ResetRequestState, FormData>(requestPasswordReset, {});
  const expired = useSearchParams().get("link") === "expired";

  if (state.sent) {
    return (
      <div role="status" className="mt-8 rounded-2xl border border-line bg-surface p-5 leading-relaxed">
        <p className="font-medium">Check your email</p>
        <p className="mt-2 text-muted">
          If an account exists for {state.email}, a link to set a new password is on its way. It can take a few
          minutes; check spam too. Open the link on this phone if you can.
        </p>
      </div>
    );
  }

  return (
    <form action={action} className="mt-8 space-y-5">
      {expired ? (
        <p role="status" className="rounded-xl bg-accent-soft p-4 text-sm leading-relaxed">
          That reset link has expired or was already used. Send a new one below.
        </p>
      ) : null}
      <label className="block text-sm font-medium">
        Email
        <input
          className="mt-2 h-13 w-full rounded-xl border border-line bg-surface px-4 text-base"
          type="email"
          name="email"
          autoComplete="email"
          inputMode="email"
          defaultValue={state.email ?? ""}
          required
          disabled={disabled || pending}
        />
      </label>
      <div aria-live="polite">{state.error ? <p className="text-sm text-danger">{state.error}</p> : null}</div>
      <button
        type="submit"
        disabled={disabled || pending}
        className="h-14 w-full rounded-full bg-accent text-lg font-medium text-accent-ink disabled:opacity-50"
      >
        {pending ? "Sending…" : "Send reset link"}
      </button>
    </form>
  );
}
