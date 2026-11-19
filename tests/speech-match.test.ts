import { describe, expect, it } from "vitest";
import { compareSpoken, sameWord, soundKey } from "@/lib/speech-match";

describe("soundKey", () => {
  it("ignores accents, case, aspiration and doubled letters", () => {
    expect(soundKey("dhanyavādagaLu")).toBe(soundKey("danyavadagalu"));
    expect(soundKey("chennāgiddīni")).toBe(soundKey("chenagidini"));
    expect(soundKey("kāfi")).toBe(soundKey("kaaphi"));
  });
});

describe("sameWord", () => {
  it("accepts small recogniser differences", () => {
    expect(sameWord("hēgiddīrā", "hegidira")).toBe(true);
    expect(sameWord("namaskāra", "namaskara")).toBe(true);
    expect(sameWord("bēku", "beku")).toBe(true);
  });
  it("tells different words apart", () => {
    expect(sameWord("bēku", "bēDa")).toBe(false);
    expect(sameWord("nanage", "nānu")).toBe(false);
    expect(sameWord("alla", "illa")).toBe(false);
  });
});

describe("compareSpoken", () => {
  it("is clear when every word was heard", () => {
    expect(compareSpoken("nanage nīru bēku", "nanage neeru beku")).toMatchObject({ matched: 3, verdict: "clear" });
  });
  it("marks the missed word and says nearly", () => {
    const r = compareSpoken("nanage nīru bēku", "nanage nīru bēDa");
    expect(r.words).toEqual([
      { word: "nanage", heard: true },
      { word: "nīru", heard: true },
      { word: "bēku", heard: false },
    ]);
    expect(r.verdict).toBe("nearly");
  });
  it("asks to try again when little was heard, and ignores punctuation", () => {
    expect(compareSpoken("hēgiddīrā?", "")).toMatchObject({ matched: 0, verdict: "again" });
    expect(compareSpoken("chennāgiddīni, nīvu?", "chennagiddini neevu")).toMatchObject({ verdict: "clear" });
  });
  it("counts each heard word once", () => {
    expect(compareSpoken("sari sari", "sari").matched).toBe(1);
  });
});
