"use server";

import { redirect } from "next/navigation";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { HOME_AFTER_SIGN_IN } from "@/lib/routes";

export type NewPasswordState = { error?: string };

const MIN_PASSWORD_LENGTH = 8;

export async function setNewPassword(_previous: NewPasswordState, formData: FormData): Promise<NewPasswordState> {
  const password = String(formData.get("password") ?? "");
  const confirm = String(formData.get("confirm") ?? "");

  if (password.length < MIN_PASSWORD_LENGTH) {
    return { error: `Password must be at least ${MIN_PASSWORD_LENGTH} characters.` };
  }
  if (password !== confirm) return { error: "The two passwords do not match." };

  const supabase = await createSupabaseServerClient();
  if (!supabase) return { error: "The app is not connected to Supabase yet." };

  // The email link signed the learner in; without that session there is
  // nothing to update.
  const { data } = await supabase.auth.getClaims();
  if (!data?.claims?.sub) return { error: "This reset link has expired. Request a new one." };

  const { error } = await supabase.auth.updateUser({ password });
  if (error) {
    return {
      error:
        error.code === "same_password"
          ? "That is your current password. Choose a different one."
          : error.code === "weak_password"
            ? "That password is too weak. Try a longer one."
            : error.message,
    };
  }

  redirect(HOME_AFTER_SIGN_IN);
}
