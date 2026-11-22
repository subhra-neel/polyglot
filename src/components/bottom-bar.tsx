import type { ReactNode } from "react";

/**
 * The bar pinned to the bottom of a lesson or check screen: one big button,
 * and after an answer, the verdict in green or red above it.
 */
export function BottomBar({ tone = "plain", children }: { tone?: "plain" | "right" | "wrong"; children: ReactNode }) {
  const look =
    tone === "right" ? "border-accent/30 bg-accent-soft" : tone === "wrong" ? "border-danger/30 bg-danger-soft" : "border-line bg-paper";
  return (
    <div className={`fixed inset-x-0 bottom-0 z-20 border-t ${look} pb-[env(safe-area-inset-bottom)]`}>
      <div className="mx-auto w-full max-w-md px-6 pb-5 pt-4">{children}</div>
    </div>
  );
}

export const bigButton =
  "flex h-14 w-full items-center justify-center rounded-2xl text-lg font-semibold shadow-[0_4px_0_0_rgba(0,0,0,0.18)] transition active:translate-y-1 active:shadow-none disabled:opacity-40 disabled:shadow-none";

export const primaryButton = `${bigButton} bg-accent text-accent-ink`;
export const dangerButton = `${bigButton} bg-danger text-white`;
