"use server";

import { createSupabaseServerClient } from "@/lib/supabase/server";

export type SettingsState = { saved?: boolean; error?: string };

export async function saveSettings(_previous: SettingsState, formData: FormData): Promise<SettingsState> {
  const goal = Number(formData.get("daily_review_goal"));
  if (!Number.isInteger(goal) || goal < 1 || goal > 500) return { error: "Choose a goal from 1 to 500." };

  const supabase = await createSupabaseServerClient();
  if (!supabase) return { error: "Not connected." };

  const { error } = await supabase.rpc("update_settings", {
    p_show_english: formData.get("show_english") === "on",
    p_show_script: formData.get("show_script") === "on",
    p_daily_review_goal: goal,
  });
  return error ? { error: "Could not save. Try again." } : { saved: true };
}
