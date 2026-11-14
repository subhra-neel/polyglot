import Link from "next/link";

export default function WelcomePage() {
  return (
    <main className="mx-auto flex w-full max-w-md flex-1 flex-col justify-between px-6 pb-10 pt-16">
      <div>
        <p className="text-sm font-medium tracking-wide text-accent">Polyglot</p>
        <h1 className="mt-6 text-4xl font-semibold leading-tight tracking-tight">
          Speak Kannada the way Bengaluru does.
        </h1>
        <p className="mt-5 text-lg leading-relaxed text-muted">
          Real sentences, written in English letters, with audio. Build your own, then practise them in
          conversation.
        </p>

        <figure className="mt-10 rounded-2xl border border-line bg-surface p-5">
          <p className="text-2xl font-medium tracking-tight">nanage ondu kāfi bēku</p>
          <figcaption className="mt-2 text-muted">I want a coffee</figcaption>
          <p className="mt-4 border-t border-line pt-4 text-sm leading-relaxed text-muted">
            Kannada says “to me, one coffee is wanted”. The verb comes last.
          </p>
        </figure>
      </div>

      <div className="mt-12">
        <Link
          href="/sign-in"
          className="flex h-14 items-center justify-center rounded-full bg-accent text-lg font-medium text-accent-ink"
        >
          Get started
        </Link>
        <p className="mt-4 text-center text-sm text-muted">Tamil and Telugu come later.</p>
      </div>
    </main>
  );
}
