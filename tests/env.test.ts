import { describe, expect, it } from "vitest";
import { readSupabaseEnv } from "@/lib/env";

const URL = "https://abcd.supabase.co";

describe("readSupabaseEnv", () => {
  it("returns null when nothing is configured", () => {
    expect(readSupabaseEnv({})).toBeNull();
  });

  it("returns null when only one of the two settings is present", () => {
    expect(readSupabaseEnv({ NEXT_PUBLIC_SUPABASE_URL: URL })).toBeNull();
    expect(readSupabaseEnv({ NEXT_PUBLIC_SUPABASE_ANON_KEY: "key" })).toBeNull();
  });

  it("accepts the publishable key, or the older anon key name", () => {
    expect(
      readSupabaseEnv({ NEXT_PUBLIC_SUPABASE_URL: URL, NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: "pk" }),
    ).toEqual({ url: URL, key: "pk" });
    expect(readSupabaseEnv({ NEXT_PUBLIC_SUPABASE_URL: URL, NEXT_PUBLIC_SUPABASE_ANON_KEY: "anon" })).toEqual({
      url: URL,
      key: "anon",
    });
  });

  it("trims stray whitespace from pasted values", () => {
    expect(
      readSupabaseEnv({ NEXT_PUBLIC_SUPABASE_URL: ` ${URL}\n`, NEXT_PUBLIC_SUPABASE_ANON_KEY: " key " }),
    ).toEqual({ url: URL, key: "key" });
  });

  it("rejects a value that is not a secure web address", () => {
    expect(readSupabaseEnv({ NEXT_PUBLIC_SUPABASE_URL: "not a url", NEXT_PUBLIC_SUPABASE_ANON_KEY: "k" })).toBeNull();
    expect(
      readSupabaseEnv({ NEXT_PUBLIC_SUPABASE_URL: "http://abcd.supabase.co", NEXT_PUBLIC_SUPABASE_ANON_KEY: "k" }),
    ).toBeNull();
  });

  it("allows a local Supabase during development", () => {
    expect(
      readSupabaseEnv({ NEXT_PUBLIC_SUPABASE_URL: "http://127.0.0.1:54321", NEXT_PUBLIC_SUPABASE_ANON_KEY: "k" }),
    ).not.toBeNull();
  });
});
