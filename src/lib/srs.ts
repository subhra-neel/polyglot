/**
 * Spaced repetition with FSRS (the ts-fsrs library).
 *
 * The database stores each card's state; this file turns a stored card into
 * the library's shape, schedules the next review, and labels how long each
 * answer would push the card away ("10 min", "3 days").
 */
import { type Card, type Grade, Rating, State, fsrs, generatorParameters } from "ts-fsrs";

// FSRS defaults aim for 90% recall. Short-term steps (1 min, 10 min) keep new
// sentences coming back within the same sitting until they stick.
const scheduler = fsrs(generatorParameters({ enable_fuzz: true }));

export type StoredCard = {
  id: number;
  due: string;
  stability: number;
  difficulty: number;
  elapsed_days: number;
  scheduled_days: number;
  learning_steps: number;
  reps: number;
  lapses: number;
  state: number;
  last_review: string | null;
};

export type Answer = "again" | "hard" | "good" | "easy";

export const ANSWERS: Answer[] = ["again", "hard", "good", "easy"];

const RATING: Record<Answer, Grade> = {
  again: Rating.Again,
  hard: Rating.Hard,
  good: Rating.Good,
  easy: Rating.Easy,
};

export function toFsrsCard(stored: StoredCard): Card {
  return {
    due: new Date(stored.due),
    stability: stored.stability,
    difficulty: stored.difficulty,
    elapsed_days: stored.elapsed_days,
    scheduled_days: stored.scheduled_days,
    learning_steps: stored.learning_steps,
    reps: stored.reps,
    lapses: stored.lapses,
    state: stored.state as State,
    last_review: stored.last_review ? new Date(stored.last_review) : undefined,
  };
}

export type Scheduled = {
  rating: number;
  due: Date;
  stability: number;
  difficulty: number;
  elapsed_days: number;
  scheduled_days: number;
  learning_steps: number;
  reps: number;
  lapses: number;
  state: number;
};

export function schedule(stored: StoredCard, answer: Answer, now = new Date()): Scheduled {
  const { card } = scheduler.next(toFsrsCard(stored), now, RATING[answer]);
  return {
    rating: RATING[answer],
    due: card.due,
    stability: card.stability,
    difficulty: card.difficulty,
    elapsed_days: card.elapsed_days,
    scheduled_days: card.scheduled_days,
    learning_steps: card.learning_steps,
    reps: card.reps,
    lapses: card.lapses,
    state: card.state,
  };
}

/** "1 min", "10 min", "3 h", "4 days", "2 mo". */
export function describeInterval(from: Date, to: Date): string {
  const minutes = Math.max(1, Math.round((to.getTime() - from.getTime()) / 60_000));
  if (minutes < 60) return `${minutes} min`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `${hours} h`;
  const days = Math.round(hours / 24);
  if (days < 31) return days === 1 ? "1 day" : `${days} days`;
  const months = Math.round(days / 30);
  if (months < 12) return `${months} mo`;
  return `${(days / 365).toFixed(1).replace(/\.0$/, "")} yr`;
}

/**
 * How far each answer would push the card. Fuzz is left out so the labels
 * are stable; the real schedule adds a little randomness so reviews spread out.
 */
const previewScheduler = fsrs(generatorParameters({ enable_fuzz: false }));

export function previewIntervals(stored: StoredCard, now = new Date()): Record<Answer, string> {
  const card = toFsrsCard(stored);
  const out = {} as Record<Answer, string>;
  for (const answer of ANSWERS) {
    out[answer] = describeInterval(now, previewScheduler.next(card, now, RATING[answer]).card.due);
  }
  return out;
}
