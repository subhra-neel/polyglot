"use client";

import { useState } from "react";

type Result = {
  id: string;
  said: string;
  tutor: string;
  expect: string[];
  note: string;
  got: string;
  pass: boolean;
  corrected: string | null;
  explanation: string;
};
type Report = { model: string; passed: number; total: number; ms: number; results: Result[] };

const LABEL: Record<string, string> = {
  none: "correct",
  valid_variant: "correct (spoken form)",
  error: "mistake",
  unnatural: "unnatural",
  register: "wrong formality",
  unclear: "unclear",
  failed: "no answer",
};

export function TutorSelfTest() {
  const [report, setReport] = useState<Report | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [running, setRunning] = useState(false);

  async function run() {
    setRunning(true);
    setError(null);
    setReport(null);
    try {
      const res = await fetch("/api/tutor/self-test", { method: "POST" });
      const body = await res.json();
      if (!res.ok) setError(body.error ?? `Failed (${res.status}).`);
      else setReport(body);
    } catch {
      setError("The test didn't finish. Check your connection and try again.");
    } finally {
      setRunning(false);
    }
  }

  return (
    <div>
      <button
        type="button"
        onClick={run}
        disabled={running}
        className="h-12 w-full rounded-full bg-accent font-medium text-accent-ink disabled:opacity-50"
      >
        {running ? "Testing… (up to a minute)" : report ? "Run again" : "Run the test"}
      </button>
      {error ? <p className="mt-3 text-sm text-danger">{error}</p> : null}
      {report ? (
        <section className="mt-6" aria-label="Results">
          <p className="text-2xl font-semibold tracking-tight">
            {report.passed} of {report.total} right
          </p>
          <p className="mt-1 text-sm text-muted">
            {report.model} · {(report.ms / 1000).toFixed(0)} s
          </p>
          <ul className="mt-4 space-y-3">
            {report.results.map((r) => (
              <li key={r.id} className="rounded-xl border border-line bg-surface p-4 text-sm leading-relaxed">
                <p className="font-medium">
                  {r.pass ? "✓" : "✗"} &ldquo;{r.said}&rdquo;
                </p>
                <p className="text-muted">Reply to: {r.tutor}</p>
                <p className="mt-1">
                  Said: <span className={r.pass ? "text-accent" : "text-danger"}>{LABEL[r.got] ?? r.got}</span>
                  {r.pass ? null : <> · should be {r.expect.map((e) => LABEL[e] ?? e).join(" or ")}</>}
                </p>
                {r.corrected ? <p>Its correction: {r.corrected}</p> : null}
                {r.explanation ? <p className="text-muted">{r.explanation}</p> : null}
                <p className="mt-1 text-xs text-muted">Why this line: {r.note}</p>
              </li>
            ))}
          </ul>
        </section>
      ) : null}
    </div>
  );
}
