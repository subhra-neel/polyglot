"use client";

import { useActionState } from "react";
import { setNewPassword, type NewPasswordState } from "./actions";

const inputClass = "mt-2 h-13 w-full rounded-xl border border-line bg-surface px-4 text-base";

export function NewPasswordForm() {
  const [state, action, pending] = useActionState<NewPasswordState, FormData>(setNewPassword, {});

  return (
    <form action={action} className="mt-8 space-y-5">
      <label className="block text-sm font-medium">
        New password
        <input
          className={inputClass}
          type="password"
          name="password"
          autoComplete="new-password"
          minLength={8}
          required
          disabled={pending}
        />
        <span className="mt-2 block text-sm font-normal text-muted">At least 8 characters.</span>
      </label>
      <label className="block text-sm font-medium">
        Type it again
        <input
          className={inputClass}
          type="password"
          name="confirm"
          autoComplete="new-password"
          minLength={8}
          required
          disabled={pending}
        />
      </label>
      <div aria-live="polite">{state.error ? <p className="text-sm text-danger">{state.error}</p> : null}</div>
      <button
        type="submit"
        disabled={pending}
        className="h-14 w-full rounded-full bg-accent text-lg font-medium text-accent-ink disabled:opacity-50"
      >
        {pending ? "Saving…" : "Save new password"}
      </button>
    </form>
  );
}
