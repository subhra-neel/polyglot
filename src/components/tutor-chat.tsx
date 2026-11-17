"use client";

import Link from "next/link";
import { useEffect, useRef, useState, useTransition } from "react";
import { endConversation, sendMessage } from "@/app/(app)/talk/actions";
import type { ConversationMessage } from "@/lib/conversations";
import { SpeakButtons } from "./speak-buttons";

const CATEGORY: Record<string, { label: string; tone: string } | undefined> = {
  error: { label: "Correction", tone: "text-danger" },
  unnatural: { label: "More natural", tone: "text-accent" },
  register: { label: "Formality", tone: "text-accent" },
  valid_variant: { label: "✓ Correct · another way to say it", tone: "text-accent" },
  unclear: { label: "Unclear: did you mean…?", tone: "text-danger" },
};

function Correction({ message }: { message: ConversationMessage }) {
  const [open, setOpen] = useState(false);
  const c = message.correction;
  const kind = c ? CATEGORY[c.category] : undefined;
  if (!c) return null;
  const accepted = c.category === "none" && c.checked !== false;
  if (!kind && !accepted && !c.aside) return null;

  return (
    <div className="mt-1.5 max-w-[85%] self-end text-sm">
      {accepted ? <p className="font-medium text-accent">✓ Correct</p> : null}
      {kind ? (
        <button type="button" onClick={() => setOpen(!open)} aria-expanded={open} className={`font-medium ${kind.tone}`}>
          {kind.label} {open ? "▴" : "▾"}
        </button>
      ) : null}
      {open && kind ? (
        <dl className="mt-2 space-y-2 rounded-xl border border-line bg-surface p-3 leading-relaxed">
          <div>
            <dt className="text-xs uppercase tracking-wider text-muted">You said</dt>
            <dd>{message.roman}</dd>
          </div>
          {c.category === "unclear" && c.meant ? (
            <div>
              <dt className="text-xs uppercase tracking-wider text-muted">Best guess</dt>
              <dd>{c.meant}</dd>
            </div>
          ) : null}
          {c.corrected_roman ? (
            <div>
              <dt className="text-xs uppercase tracking-wider text-muted">
                {c.category === "valid_variant" ? "Also said" : c.category === "unclear" ? "You could say" : "Better"}
              </dt>
              <dd className="font-medium">{c.corrected_roman}</dd>
            </div>
          ) : null}
          {c.what_was_wrong ? (
            <div>
              <dt className="text-xs uppercase tracking-wider text-muted">What changed</dt>
              <dd>{c.what_was_wrong}</dd>
            </div>
          ) : null}
          {c.why ? (
            <div>
              <dt className="text-xs uppercase tracking-wider text-muted">Why</dt>
              <dd>{c.why}</dd>
            </div>
          ) : null}
          {c.natural_roman && c.natural_roman !== c.corrected_roman ? (
            <div>
              <dt className="text-xs uppercase tracking-wider text-muted">How locals say it</dt>
              <dd className="font-medium">{c.natural_roman}</dd>
            </div>
          ) : null}
        </dl>
      ) : null}
      {c.aside ? <p className="mt-2 rounded-xl bg-accent-soft p-3 leading-relaxed">{c.aside}</p> : null}
    </div>
  );
}

function TutorBubble({
  message,
  name,
  showEnglish,
  showScript,
  audio,
}: {
  message: ConversationMessage;
  name: string;
  showEnglish: boolean;
  showScript: boolean;
  audio: { normal: string; slow: string } | null;
}) {
  const [english, setEnglish] = useState(showEnglish);
  return (
    <div className="max-w-[88%] self-start rounded-2xl rounded-tl-sm border border-line bg-surface p-4">
      <p className="text-xs font-medium text-muted">{name}</p>
      <p className="mt-1 text-lg font-medium leading-snug" lang="kn-Latn">
        {message.roman}
      </p>
      {showScript && message.script ? (
        <p className="mt-0.5 text-muted" lang="kn">
          {message.script}
        </p>
      ) : null}
      {english ? (
        <p className="mt-1 text-sm text-muted">{message.english}</p>
      ) : (
        <button type="button" onClick={() => setEnglish(true)} className="mt-1 text-sm font-medium text-accent">
          Show English
        </button>
      )}
      <div className="mt-3">
        <SpeakButtons script={message.script} audio={audio} />
      </div>
    </div>
  );
}

type Props = {
  conversationId: string;
  personaName: string;
  hint: string;
  initial: ConversationMessage[];
  ended: boolean;
  showEnglish: boolean;
  showScript: boolean;
  audioEnabled: boolean;
};

const audioFor = (m: ConversationMessage, enabled: boolean) =>
  enabled && m.id > 0 ? { normal: `/api/audio/message/${m.id}/normal`, slow: `/api/audio/message/${m.id}/slow` } : null;

export function TutorChat({ conversationId, personaName, hint, initial, ended, showEnglish, showScript, audioEnabled }: Props) {
  const [messages, setMessages] = useState(initial);
  const [draft, setDraft] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [finished, setFinished] = useState(ended);
  const [pending, startTransition] = useTransition();
  const end = useRef<HTMLDivElement>(null);

  useEffect(() => {
    end.current?.scrollIntoView({ block: "end" });
  }, [messages.length, pending]);

  function send(text: string) {
    setError(null);
    const said = text.trim();
    startTransition(async () => {
      const result = await sendMessage(conversationId, said);
      if (!result.ok) {
        setError(result.error);
        return;
      }
      setDraft("");
      setMessages((prev) => (said ? [...prev, result.learner, result.tutor] : [...prev, result.tutor]));
    });
  }

  function finish() {
    startTransition(async () => {
      await endConversation(conversationId);
      setFinished(true);
    });
  }

  const corrections = messages.filter(
    (m) => m.role === "learner" && m.correction && ["error", "unnatural", "register", "unclear"].includes(m.correction.category),
  );

  return (
    <div className="flex flex-col">
      {hint ? <p className="mb-4 rounded-xl bg-accent-soft p-3 text-sm leading-relaxed">{hint}</p> : null}

      <div className="flex flex-col gap-3" aria-live="polite">
        {messages.map((m) =>
          m.role === "tutor" ? (
            <TutorBubble
              key={m.id}
              message={m}
              name={personaName}
              showEnglish={showEnglish}
              showScript={showScript}
              audio={audioFor(m, audioEnabled)}
            />
          ) : (
            <div key={m.id} className="flex flex-col">
              <p className="max-w-[85%] self-end rounded-2xl rounded-tr-sm bg-accent px-4 py-3 text-accent-ink">{m.roman}</p>
              <Correction message={m} />
            </div>
          ),
        )}
        {pending && !finished ? <p className="self-start text-sm text-muted">{personaName} is replying…</p> : null}
        {messages.length === 0 && !pending ? (
          <div className="self-start">
            <p className="text-muted">The scene hasn&apos;t started.</p>
            <button type="button" onClick={() => send("")} className="mt-2 font-medium text-accent">
              Start the conversation
            </button>
          </div>
        ) : null}
        <div ref={end} />
      </div>

      {error ? <p className="mt-3 text-sm text-danger">{error}</p> : null}

      {finished ? (
        <section className="mt-6 rounded-2xl border border-line bg-surface p-5" aria-label="Summary">
          <p className="text-xl font-medium">Conversation finished</p>
          {corrections.length ? (
            <>
              <p className="mt-2 text-muted">Worth practising from this conversation:</p>
              <ul className="mt-3 space-y-3">
                {corrections.map((m) => (
                  <li key={m.id} className="leading-relaxed">
                    <span className="text-muted line-through">{m.roman}</span>
                    <br />
                    <span className="font-medium">{m.correction!.corrected_roman ?? m.correction!.natural_roman}</span>
                    {m.correction!.why ? <span className="block text-sm text-muted">{m.correction!.why}</span> : null}
                  </li>
                ))}
              </ul>
            </>
          ) : (
            <p className="mt-2 text-muted">No corrections this time.</p>
          )}
          <Link href="/talk" className="mt-5 flex h-12 items-center justify-center rounded-full bg-accent font-medium text-accent-ink">
            Back to scenes
          </Link>
        </section>
      ) : (
        <form
          className="sticky bottom-20 mt-6 flex gap-2 bg-paper pb-2 pt-2"
          onSubmit={(e) => {
            e.preventDefault();
            if (draft.trim()) send(draft);
          }}
        >
          <label className="sr-only" htmlFor="say">
            Your reply in Kannada (English letters are fine)
          </label>
          <input
            id="say"
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            maxLength={300}
            autoComplete="off"
            autoCapitalize="off"
            placeholder="Reply in Kannada…"
            disabled={pending}
            className="h-12 min-w-0 flex-1 rounded-full border border-line bg-surface px-4 text-base"
          />
          <button
            type="submit"
            disabled={pending || !draft.trim()}
            className="h-12 rounded-full bg-accent px-5 font-medium text-accent-ink disabled:opacity-50"
          >
            Send
          </button>
        </form>
      )}

      {!finished && messages.length > 1 ? (
        <button type="button" onClick={finish} disabled={pending} className="mt-2 self-center text-sm font-medium text-muted">
          Finish conversation
        </button>
      ) : null}
    </div>
  );
}
