import { Card } from "@/components/screen";

/** Shown when the database is missing the tables or functions a screen needs. */
export function SetupNotice({ detail }: { detail: string }) {
  return (
    <Card>
      <p className="font-medium">The database needs an update</p>
      <p className="mt-2 text-sm leading-relaxed text-muted">
        Run the SQL files listed in <code className="font-mono">docs/SETUP.md</code> in the Supabase SQL editor,
        then reload this page.
      </p>
      <p className="mt-3 break-words font-mono text-xs text-muted">{detail}</p>
    </Card>
  );
}
