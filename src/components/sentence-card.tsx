"use client";

import { useActionState, useState } from "react";
import { flagSentence, type FlagState } from "@/app/(app)/learn/actions";
import type { Sentence } from "@/lib/lessons";
import { SayIt } from "./say-it";
import { type AudioUrls, SpeakButtons } from "./speak-buttons";

export const RELATION_LABEL: Record<string, string> = {
  casual: "Casual",
  respectful: "Respectful",
  more_natural: "More natural",
  alternative: "Also said",
  negative: "Negative",
  question: "Question",
};

export function Chip({ children }: { children: React.ReactNode }) {
  return <span className="rounded-full bg-accent-soft px-2.5 py-0.5 text-xs font-medium text-accent">{children}</span>;
}

export function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="border-t border-line pt-4">
      <h3 className="text-xs font-medium uppercase tracking-wider text-muted">{title}</h3>
      <div className="mt-2">{children}</div>
    </div>
  );
}

export function FlagForm({ sentenceId }: { sentenceId: string }) {
  const [state, action, pending] = useActionState<FlagState, FormData>(flagSentence, {});
  if (state.sent) return <p className="text-sm text-accent">Thanks. This sentence will be checked again.</p>;

  return (
    <form action={action} className="space-y-2">
      <input type="hidden" name="sentence" value={sentenceId} />
      <label className="block text-sm">
        What did you hear instead? (optional)
        <textarea
          name="note"
          rows={2}
          maxLength={500}
          className="mt-1 w-full rounded-xl border border-line bg-paper p-3 text-base"
        />
      </label>
      {state.error ? <p className="text-sm text-danger">{state.error}</p> : null}
      <button
        type="submit"
        disabled={pending}
        className="h-10 rounded-full border border-line px-4 text-sm font-medium disabled:opacity-50"
      >
        {pending ? "Sending…" : "Send"}
      </button>
    </form>
  );
}

type CardProps = {
  sentence: Sentence;
  audio: AudioUrls | null;
  index: number;
  total: number;
  showEnglish?: boolean;
  showScript?: boolean;
};

export function SentenceCard({ sentence, audio, index, total, showEnglish = true, showScript = false }: CardProps) {
  const [open, setOpen] = useState(false);
  const [meaningShown, setMeaningShown] = useState(showEnglish);
  const [flagging, setFlagging] = useState(false);
  const detailsId = `details-${sentence.id}`;

  return (
    <article className="rounded-2xl border border-line bg-surface p-5" aria-label={`Sentence ${index} of ${total}`}>
      <div className="flex items-start justify-between gap-3">
        <p className="text-2xl font-medium leading-snug tracking-tight" lang="kn-Latn">
          {sentence.roman}
        </p>
        <span className="pt-1.5 text-xs text-muted">
          {index}/{total}
        </span>
      </div>
      {showScript && sentence.script ? (
        <p className="mt-0.5 text-lg text-muted" lang="kn">
          {sentence.script}
        </p>
      ) : null}
      {meaningShown ? (
        <p className="mt-1 text-muted">{sentence.meaning}</p>
      ) : (
        <button type="button" onClick={() => setMeaningShown(true)} className="mt-1 text-sm font-medium text-accent">
          Show meaning
        </button>
      )}

      {sentence.formality !== "neutral" || sentence.register === "colloquial" || sentence.region ? (
        <div className="mt-3 flex flex-wrap gap-1.5">
          {sentence.formality !== "neutral" ? <Chip>{sentence.formality === "respectful" ? "Respectful" : "Casual"}</Chip> : null}
          {sentence.register === "colloquial" ? <Chip>Spoken</Chip> : null}
          {sentence.region ? <Chip>{sentence.region}</Chip> : null}
        </div>
      ) : null}

      <div className="mt-4 flex items-start justify-between gap-2">
        <SpeakButtons script={sentence.script} audio={audio} />
        <button
          type="button"
          aria-expanded={open}
          aria-controls={detailsId}
          onClick={() => setOpen(!open)}
          className="h-11 px-2 text-sm font-medium text-accent"
        >
          {open ? "Less" : "How it works"}
        </button>
      </div>

      {sentence.script ? <SayIt roman={sentence.roman} /> : null}

      {open ? (
        <div id={detailsId} className="mt-4 space-y-4">
          <Section title="Word by word">
            <dl className="space-y-2">
              {sentence.tokens.map((token, i) => (
                <div key={i}>
                  <dt className="inline font-medium">{token.word}</dt>
                  <dd className="inline text-muted"> — {token.gloss}</dd>
                  {token.breakdown ? <dd className="text-sm text-muted">{token.breakdown}</dd> : null}
                </div>
              ))}
            </dl>
          </Section>

          {sentence.why ? (
            <Section title="Why it's built this way">
              <p className="leading-relaxed">{sentence.why}</p>
            </Section>
          ) : null}

          {sentence.pronunciation ? (
            <Section title="Saying it">
              <p className="leading-relaxed">{sentence.pronunciation}</p>
            </Section>
          ) : null}

          {sentence.variants.length ? (
            <Section title="Other ways to say it">
              <ul className="space-y-2">
                {sentence.variants.map((v) => (
                  <li key={v.roman}>
                    <span className="text-xs font-medium uppercase tracking-wider text-muted">
                      {RELATION_LABEL[v.relation] ?? v.relation}
                    </span>
                    <p>
                      <span className="font-medium">{v.roman}</span> <span className="text-muted">· {v.meaning}</span>
                    </p>
                  </li>
                ))}
              </ul>
            </Section>
          ) : null}

          <Section title="Checked against">
            <p className="text-sm text-muted">
              {sentence.status === "native_verified"
                ? "Confirmed by a native speaker."
                : `Published sources (${sentence.sources ?? "listed in the content file"}). Not yet confirmed by a native speaker.`}
            </p>
            {flagging ? (
              <div className="mt-3">
                <FlagForm sentenceId={sentence.id} />
              </div>
            ) : (
              <button
                type="button"
                onClick={() => setFlagging(true)}
                className="mt-2 text-sm font-medium text-accent"
              >
                I heard it differently
              </button>
            )}
          </Section>
        </div>
      ) : null}
    </article>
  );
}
