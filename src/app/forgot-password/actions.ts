"use server";

import { createSupabaseServerClient } from "@/lib/supabase/server";
import { RESET_PASSWORD_ROUTE } from "@/lib/routes";
import { getSiteOrigin } from "@/lib/site-origin";

export type ResetRequestState = { sent?: boolean; error?: string; email?: string };

export async function requestPasswordReset(_previous: ResetRequestState, formData: FormData): Promise<ResetRequestState> {
  const email = String(formData.get("email") ?? "").trim().toLowerCase();
  if (!/^\S+@\S+\.\S+$/.test(email)) return { error: "Enter a valid email address.", email };

  const supabase = await createSupabaseServerClient();
  if (!supabase) return { error: "The app is not connected to Supabase yet. See docs/SETUP.md.", email };

  const origin = await getSiteOrigin();
  const { error } = await supabase.auth.resetPasswordForEmail(email, {
    redirectTo: `${origin}/auth/confirm?next=${encodeURIComponent(RESET_PASSWORD_ROUTE)}`,
  });

  if (error) {
    if (error.status === 429) {
      return { error: "Too many reset emails were sent recently. Wait a while and try again.", email };
    }
    if (/not authori[sz]ed/i.test(error.message)) {
      return {
        error:
          "Supabase's built-in email service would not send to this address. It only delivers to members of your Supabase organisation. See docs/SETUP.md.",
        email,
      };
    }
    return { error: error.message, email };
  }

  // Same answer whether or not the account exists, so the form cannot be
  // used to find out who has an account.
  return { sent: true, email };
}
