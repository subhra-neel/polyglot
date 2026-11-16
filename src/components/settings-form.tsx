"use client";

import { useActionState } from "react";
import { saveSettings, type SettingsState } from "@/app/(app)/me/actions";

type Props = { showEnglish: boolean; showScript: boolean; dailyReviewGoal: number };

function Toggle({ name, label, hint, defaultChecked }: { name: string; label: string; hint: string; defaultChecked: boolean }) {
  return (
    <label className="flex items-start justify-between gap-4 py-3">
      <span>
        <span className="block font-medium">{label}</span>
        <span className="mt-0.5 block text-sm text-muted">{hint}</span>
      </span>
      <input type="checkbox" name={name} defaultChecked={defaultChecked} className="mt-1 h-6 w-6 shrink-0 accent-accent" />
    </label>
  );
}

export function SettingsForm({ showEnglish, showScript, dailyReviewGoal }: Props) {
  const [state, action, pending] = useActionState<SettingsState, FormData>(saveSettings, {});

  return (
    <form action={action} className="divide-y divide-line">
      <Toggle
        name="show_english"
        label="Show English meanings"
        hint="Turn off to test yourself: tap a card to see its meaning."
        defaultChecked={showEnglish}
      />
      <Toggle
        name="show_script"
        label="Show Kannada script"
        hint="Adds the Kannada letters under each sentence."
        defaultChecked={showScript}
      />
      <label className="flex items-center justify-between gap-4 py-3">
        <span>
          <span className="block font-medium">Daily review goal</span>
          <span className="mt-0.5 block text-sm text-muted">Reviews to aim for each day.</span>
        </span>
        <input
          type="number"
          name="daily_review_goal"
          min={1}
          max={500}
          defaultValue={dailyReviewGoal}
          className="h-11 w-20 rounded-xl border border-line bg-paper px-3 text-center text-base"
        />
      </label>
      <div className="pt-4">
        <button
          type="submit"
          disabled={pending}
          className="h-12 w-full rounded-full bg-accent font-medium text-accent-ink disabled:opacity-50"
        >
          {pending ? "Saving…" : "Save settings"}
        </button>
        <p aria-live="polite" className="mt-2 text-center text-sm">
          {state.saved ? <span className="text-accent">Saved.</span> : null}
          {state.error ? <span className="text-danger">{state.error}</span> : null}
        </p>
      </div>
    </form>
  );
}
