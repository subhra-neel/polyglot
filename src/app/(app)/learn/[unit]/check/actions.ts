"use server";

import { isSlug, LANGUAGE } from "@/lib/lessons";
import { createSupabaseServerClient } from "@/lib/supabase/server";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;

/** Saves a finished unit check; missed sentences go back into revision. */
export async function saveUnitCheck(
  unitSlug: string,
  score: number,
  total: number,
  missedIds: string[],
): Promise<{ ok: true; backToRevision: number } | { ok: false }> {
  if (!isSlug(unitSlug) || !Number.isInteger(score) || !Number.isInteger(total) || total < 1 || score < 0 || score > total) {
    return { ok: false };
  }
  const supabase = await createSupabaseServerClient();
  if (!supabase) return { ok: false };
  const { data, error } = await supabase.rpc("record_unit_check", {
    p_unit_slug: unitSlug,
    p_score: score,
    p_total: total,
    p_missed: missedIds.filter((id) => UUID.test(id)).slice(0, 50),
    p_language: LANGUAGE,
  });
  if (error) {
    console.error("[unit check]", error.message);
    return { ok: false };
  }
  return { ok: true, backToRevision: (data as { back_to_revision: number }).back_to_revision };
}
