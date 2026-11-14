"use client";

import { useActionState } from "react";
import { useSearchParams } from "next/navigation";
import { authenticate, type AuthState } from "./actions";

const INITIAL_STATE: AuthState = {};

const inputClass =
  "mt-2 h-13 w-full rounded-xl border border-line bg-surface px-4 text-base placeholder:text-muted";

export function SignInForm({ disabled }: { disabled: boolean }) {
  const [state, formAction, pending] = useActionState(authenticate, INITIAL_STATE);
  const next = useSearchParams().get("next") ?? "";
  const locked = disabled || pending;

  return (
    <form action={formAction} className="mt-8 space-y-5">
      <input type="hidden" name="next" value={next} />

      <label className="block text-sm font-medium">
        Email
        <input
          className={inputClass}
          type="email"
          name="email"
          autoComplete="email"
          inputMode="email"
          defaultValue={state.email ?? ""}
          required
          disabled={locked}
        />
      </label>

      <label className="block text-sm font-medium">
        Password
        <input
          className={inputClass}
          type="password"
          name="password"
          autoComplete="current-password"
          minLength={8}
          required
          disabled={locked}
        />
        <span className="mt-2 block text-sm font-normal text-muted">At least 8 characters.</span>
      </label>

      <div aria-live="polite">
        {state.error ? <p className="text-sm text-danger">{state.error}</p> : null}
        {state.notice ? <p className="text-sm text-accent">{state.notice}</p> : null}
      </div>

      <div className="space-y-3 pt-1">
        <button
          type="submit"
          name="intent"
          value="sign-in"
          disabled={locked}
          className="h-14 w-full rounded-full bg-accent text-lg font-medium text-accent-ink disabled:opacity-50"
        >
          {pending ? "One moment…" : "Sign in"}
        </button>
        <button
          type="submit"
          name="intent"
          value="sign-up"
          disabled={locked}
          className="h-14 w-full rounded-full border border-line bg-surface text-lg font-medium disabled:opacity-50"
        >
          Create account
        </button>
      </div>
    </form>
  );
}
