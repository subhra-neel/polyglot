"use server";

import { redirect } from "next/navigation";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { safeNextPath } from "@/lib/routes";

/** `email` is echoed back because React clears a form after its action runs. */
export type AuthState = { error?: string; notice?: string; email?: string };

const MIN_PASSWORD_LENGTH = 8;

/** One form, two buttons: the button pressed arrives as `intent`. */
export async function authenticate(_previous: AuthState, formData: FormData): Promise<AuthState> {
  const email = String(formData.get("email") ?? "").trim().toLowerCase();
  const password = String(formData.get("password") ?? "");
  const intent = formData.get("intent") === "sign-up" ? "sign-up" : "sign-in";
  const next = safeNextPath(String(formData.get("next") ?? ""));

  if (!/^\S+@\S+\.\S+$/.test(email)) {
    return { error: "Enter a valid email address.", email };
  }
  if (password.length < MIN_PASSWORD_LENGTH) {
    return { error: `Password must be at least ${MIN_PASSWORD_LENGTH} characters.`, email };
  }

  const supabase = await createSupabaseServerClient();
  if (!supabase) {
    return { error: "The app is not connected to Supabase yet. See docs/SETUP.md.", email };
  }

  if (intent === "sign-up") {
    const { data, error } = await supabase.auth.signUp({ email, password });
    if (error) return { error: error.message, email };
    // With email confirmation switched on, there is no session until the
    // learner clicks the link in their inbox.
    if (!data.session) {
      return { notice: "Check your email for a confirmation link, then sign in.", email };
    }
  } else {
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) {
      return {
        error: error.code === "invalid_credentials" ? "Email or password is incorrect." : error.message,
        email,
      };
    }
  }

  redirect(next);
}

export async function signOut() {
  const supabase = await createSupabaseServerClient();
  await supabase?.auth.signOut();
  redirect("/");
}
