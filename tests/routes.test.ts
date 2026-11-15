import { describe, expect, it } from "vitest";
import { isAppRoute, safeNextPath } from "@/lib/routes";

describe("isAppRoute", () => {
  it("covers the five tabs and anything beneath them", () => {
    for (const path of ["/today", "/learn", "/learn/unit/1", "/review", "/talk", "/build", "/me"]) {
      expect(isAppRoute(path)).toBe(true);
    }
  });

  it("leaves public pages open", () => {
    for (const path of ["/", "/sign-in", "/auth/confirm", "/learning", "/meow"]) {
      expect(isAppRoute(path)).toBe(false);
    }
  });
});

describe("safeNextPath", () => {
  it("keeps a same-site app path, including its query", () => {
    expect(safeNextPath("/learn")).toBe("/learn");
    expect(safeNextPath("/learn/unit/2?card=3")).toBe("/learn/unit/2?card=3");
  });

  it("allows the reset-password page, which email links lead to", () => {
    expect(safeNextPath("/reset-password")).toBe("/reset-password");
  });

  it("falls back to Today for anything else", () => {
    for (const next of [null, undefined, "", "/", "/sign-in", "/forgot-password", "learn", "https://evil.example", "//evil.example", "/\\evil.example"]) {
      expect(safeNextPath(next)).toBe("/today");
    }
  });
});
