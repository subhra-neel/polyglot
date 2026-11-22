import Link from "next/link";
import { startConversation } from "@/app/(app)/talk/actions";
import type { LearningPath, PathUnit } from "@/lib/path";
import { primaryButton } from "./bottom-bar";

/** A gentle zigzag, so the path reads as a path rather than a list. */
const OFFSETS = [0, 48, 72, 48, 0, -48, -72, -48];
const shift = (i: number) => ({ transform: `translateX(${OFFSETS[i % OFFSETS.length]}px)` });

type Next = { unit: string; lesson: string } | null;

function Node({
  href,
  label,
  caption,
  state,
  i,
  symbol,
}: {
  href: string;
  label: string;
  caption: string;
  state: "done" | "next" | "open";
  i: number;
  symbol: string;
}) {
  const size = state === "next" ? "h-20 w-20 text-3xl" : "h-16 w-16 text-2xl";
  const look =
    state === "done"
      ? "bg-accent text-accent-ink shadow-[0_5px_0_0_rgba(0,0,0,0.22)]"
      : state === "next"
        ? "bg-accent text-accent-ink ring-8 ring-accent-soft shadow-[0_5px_0_0_rgba(0,0,0,0.22)]"
        : "border-4 border-line bg-surface text-muted shadow-[0_5px_0_0_var(--line)]";
  return (
    <li className="flex flex-col items-center" style={shift(i)}>
      {state === "next" ? (
        <span className="mb-3 rounded-xl border-2 border-accent bg-surface px-3 py-1 text-sm font-bold uppercase tracking-wider text-accent">
          Start
        </span>
      ) : null}
      <Link
        href={href}
        id={state === "next" ? "next-lesson" : undefined}
        aria-label={`${label}${state === "done" ? " (done)" : state === "next" ? " (next)" : ""}`}
        className={`flex items-center justify-center rounded-full font-semibold transition active:translate-y-1 active:shadow-none ${size} ${look}`}
      >
        {state === "done" ? "✓" : symbol}
      </Link>
      <span className={`mt-2 max-w-40 text-center text-sm leading-snug ${state === "open" ? "text-muted" : "font-medium"}`}>{caption}</span>
    </li>
  );
}

function UnitSection({ unit, next, unitNumber }: { unit: PathUnit; next: Next; unitNumber: number }) {
  let i = 0;
  const allDone = unit.lessons.length > 0 && unit.lessons.every((l) => l.completed);
  return (
    <section aria-labelledby={`unit-${unit.slug}`} className="mt-10">
      <div className="flex items-center justify-between gap-3 rounded-2xl bg-accent px-5 py-4 text-accent-ink">
        <div className="min-w-0">
          <p className="text-xs font-semibold uppercase tracking-wider opacity-80">Unit {unitNumber}</p>
          <h3 id={`unit-${unit.slug}`} className="text-lg font-semibold leading-snug">
            {unit.title}
          </h3>
        </div>
        <Link
          href={`/learn/${unit.slug}`}
          className="shrink-0 rounded-xl border-2 border-white/40 px-3 py-1.5 text-sm font-semibold"
        >
          Guide
        </Link>
      </div>
      <ol className="mt-8 flex flex-col items-center gap-7">
        {unit.lessons.map((lesson) => {
          const isNext = next?.unit === unit.slug && next.lesson === lesson.slug;
          return (
            <Node
              key={lesson.slug}
              href={`/learn/${unit.slug}/${lesson.slug}`}
              label={`Lesson: ${lesson.title}`}
              caption={lesson.title}
              state={lesson.completed ? "done" : isNext ? "next" : "open"}
              i={i++}
              symbol={String(lesson.position)}
            />
          );
        })}
        <li className="flex flex-col items-center" style={shift(i++)}>
          <Link
            href={`/learn/${unit.slug}/check`}
            aria-label={`Unit check: ${unit.title}`}
            className={`flex h-16 w-16 items-center justify-center rounded-2xl text-2xl font-semibold shadow-[0_5px_0_0_var(--line)] transition active:translate-y-1 active:shadow-none ${
              allDone ? "border-4 border-accent bg-surface text-accent" : "border-4 border-line bg-surface text-muted"
            }`}
          >
            ✎
          </Link>
          <span className="mt-2 text-sm text-muted">Unit check</span>
        </li>
        {unit.scenes.map((scene) => (
          <li key={scene.slug} className="flex flex-col items-center" style={shift(i++)}>
            <form action={startConversation}>
              <input type="hidden" name="scenario" value={scene.slug} />
              <button
                type="submit"
                aria-label={`Talk to the tutor: ${scene.title}`}
                className="flex h-16 w-16 items-center justify-center rounded-full border-4 border-accent bg-accent-soft text-accent shadow-[0_5px_0_0_var(--line)] transition active:translate-y-1 active:shadow-none"
              >
                <svg viewBox="0 0 24 24" className="h-7 w-7" aria-hidden="true" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                  <path d="M4 5h16v10H9l-5 4z" />
                </svg>
              </button>
            </form>
            <span className="mt-2 max-w-44 text-center text-sm leading-snug">
              <span className="block font-medium text-accent">Talk</span>
              {scene.title}
            </span>
          </li>
        ))}
      </ol>
    </section>
  );
}

/** Home: what to do next, then the whole course as a path. */
export function LearningPathView({ path }: { path: LearningPath }) {
  const p = path.progress;
  const next: Next = p.next_lesson ? { unit: p.next_lesson.unit_slug, lesson: p.next_lesson.lesson_slug } : null;
  let unitNumber = 0;
  return (
    <>
      {p.next_lesson ? (
        <section aria-label="Up next" className="rounded-3xl border-2 border-line bg-surface p-5">
          <p className="text-xs font-semibold uppercase tracking-wider text-accent">
            {p.lessons_completed === 0 ? "Start here" : "Up next"}
          </p>
          <p className="mt-2 text-2xl font-semibold leading-tight tracking-tight">{p.next_lesson.lesson_title}</p>
          <p className="mt-1 text-muted">{p.next_lesson.unit_title}</p>
          <Link href={`/learn/${p.next_lesson.unit_slug}/${p.next_lesson.lesson_slug}`} className={`mt-5 ${primaryButton}`}>
            {p.lessons_completed === 0 ? "Start the first lesson" : "Continue"}
          </Link>
        </section>
      ) : (
        <section className="rounded-3xl border-2 border-line bg-surface p-5">
          <p className="text-xl font-semibold">You&apos;ve finished every lesson so far.</p>
          <p className="mt-1 text-muted">Revise, take unit checks, or talk to the tutor while new units are written.</p>
        </section>
      )}

      {p.due_now > 0 ? (
        <Link
          href="/review"
          className="mt-4 flex items-center justify-between gap-3 rounded-2xl border-2 border-accent bg-accent-soft p-4"
        >
          <span>
            <span className="block font-semibold text-accent">
              {p.due_now} {p.due_now === 1 ? "sentence" : "sentences"} to revise
            </span>
            <span className="block text-sm text-muted">Keeping old sentences matters more than adding new ones.</span>
          </span>
          <span className="shrink-0 rounded-xl bg-accent px-3 py-2 text-sm font-semibold text-accent-ink">Revise</span>
        </Link>
      ) : null}

      {path.levels.map((level) => (
        <div key={level.level} className="mt-12">
          <div className="flex items-center gap-3">
            <span className="h-px flex-1 bg-line" />
            <h2 className="text-center text-sm font-semibold uppercase tracking-wider text-muted">
              Level {level.level} · {level.title}
            </h2>
            <span className="h-px flex-1 bg-line" />
          </div>
          <p className="mt-2 text-center text-sm text-muted">{level.canDo}</p>
          {level.units.map((unit) => (
            <UnitSection key={unit.slug} unit={unit} next={next} unitNumber={++unitNumber} />
          ))}
        </div>
      ))}
    </>
  );
}
