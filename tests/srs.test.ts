import { describe, expect, it } from "vitest";
import { describeInterval, previewIntervals, schedule, type StoredCard } from "@/lib/srs";

const NOW = new Date("2026-11-15T09:00:00Z");

const newCard: StoredCard = {
  id: 1,
  due: NOW.toISOString(),
  stability: 0,
  difficulty: 0,
  elapsed_days: 0,
  scheduled_days: 0,
  learning_steps: 0,
  reps: 0,
  lapses: 0,
  state: 0,
  last_review: null,
};

describe("schedule", () => {
  it("brings a forgotten new sentence back within minutes", () => {
    const next = schedule(newCard, "again", NOW);
    const minutes = (next.due.getTime() - NOW.getTime()) / 60_000;
    expect(minutes).toBeGreaterThan(0);
    expect(minutes).toBeLessThanOrEqual(10);
    expect(next.reps).toBe(1);
  });

  it("spaces a sentence further the better it was remembered", () => {
    const due = (answer: "again" | "hard" | "good" | "easy") => schedule(newCard, answer, NOW).due.getTime();
    expect(due("again")).toBeLessThanOrEqual(due("hard"));
    expect(due("hard")).toBeLessThanOrEqual(due("good"));
    expect(due("good")).toBeLessThan(due("easy"));
  });

  it("moves a well-known sentence days away and counts a lapse when forgotten", () => {
    let card: StoredCard = newCard;
    let now = NOW;
    for (let i = 0; i < 4; i++) {
      const next = schedule(card, "good", now);
      card = { ...card, ...next, due: next.due.toISOString(), last_review: now.toISOString() };
      now = next.due;
    }
    expect(card.state).toBe(2); // Review
    expect(card.scheduled_days).toBeGreaterThanOrEqual(1);

    const forgotten = schedule(card, "again", now);
    expect(forgotten.lapses).toBe(1);
    expect(forgotten.state).toBe(3); // Relearning
  });
});

describe("describeInterval", () => {
  it.each([
    [0.2, "1 min"],
    [10, "10 min"],
    [90, "2 h"],
    [60 * 24, "1 day"],
    [60 * 24 * 4, "4 days"],
    [60 * 24 * 60, "2 mo"],
    [60 * 24 * 365 * 2, "2 yr"],
  ])("%s minutes reads as %s", (minutes, label) => {
    expect(describeInterval(NOW, new Date(NOW.getTime() + minutes * 60_000))).toBe(label);
  });
});

describe("previewIntervals", () => {
  it("labels every answer for a new card", () => {
    const labels = previewIntervals(newCard, NOW);
    expect(Object.keys(labels)).toEqual(["again", "hard", "good", "easy"]);
    expect(labels.again).toMatch(/min$/);
    expect(labels.easy).toMatch(/day/);
  });
});
