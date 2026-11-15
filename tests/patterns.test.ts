import { describe, expect, it } from "vitest";
import { build, PATTERNS } from "@/lib/patterns";
import { checkPatterns } from "../content-pipeline/patterns.ts";
import { loadPatterns } from "../content-pipeline/patterns.ts";
import { join } from "node:path";
import { ROOT } from "./helpers/db.mjs";

describe("sentence lab patterns", () => {
  it("have no problems, and the app's copy matches content/kn/patterns.yaml", () => {
    const { file, problems } = loadPatterns(join(ROOT, "content", "kn", "patterns.yaml"));
    expect(problems).toEqual([]);
    expect(PATTERNS).toEqual(file);
  });

  it("build the attested sentences", () => {
    expect(build("want", "water", "statement")).toEqual({
      roman: "nanage nīru bēku",
      script: "ನನಗೆ ನೀರು ಬೇಕು",
      english: "I want water",
    });
    expect(build("there-is", "water", "question")?.roman).toBe("nīru ideyā?");
    expect(build("there-is", "power", "negative")?.english).toBe("There is no power");
    expect(build("please-give", "bill", "statement")?.roman).toBe("bil koDi");
    expect(build("how-much", "rent", "question")?.english).toBe("How much is the rent?");
  });

  it("refuse combinations a pattern does not allow", () => {
    expect(build("want", "rent", "statement")).toBeNull();
    expect(build("want", "water", "question")).toBeNull();
    expect(build("nope", "water", "statement")).toBeNull();
  });

  it("catch a mismatched word", () => {
    const broken = structuredClone(PATTERNS);
    broken.words[0].roman = "nero";
    expect(checkPatterns(broken).problems[0]).toMatch(/does not match script/);
  });
});
