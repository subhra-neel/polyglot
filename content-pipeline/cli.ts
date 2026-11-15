/**
 * npm run content:check   — validate every file in content/
 * npm run content:build   — validate, then write supabase/content.sql
 */
import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { loadContentDir, unitsToSql } from "./build.ts";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const command = process.argv[2];
const languages = ["kn"];

let failed = false;
const allUnits = [];

for (const language of languages) {
  const { units, problems } = loadContentDir(join(root, "content", language));
  for (const p of problems) {
    console.error(`✗ ${p.file.replace(root + "/", "")} · ${p.where}: ${p.message}`);
  }
  if (problems.length) failed = true;
  allUnits.push(...units);

  for (const unit of units) {
    const sentences = unit.lessons.flatMap((l) => l.sentences);
    const shown = sentences.filter((s) => s.status !== "draft").length;
    console.log(
      `${problems.length ? "!" : "✓"} ${language} level ${unit.level} · ${unit.unit}: ${unit.lessons.length} lessons, ${sentences.length} sentences (${shown} shown, ${sentences.length - shown} draft)`,
    );
  }
}

if (failed) {
  console.error("\nContent has problems. Nothing was written.");
  process.exit(1);
}

if (command === "build") {
  const out = join(root, "supabase", "content.sql");
  mkdirSync(dirname(out), { recursive: true });
  writeFileSync(out, unitsToSql(allUnits));
  console.log(`\nWrote ${out.replace(root + "/", "")}`);
} else if (command !== "check") {
  console.error("Usage: node content-pipeline/cli.ts <check|build>");
  process.exit(1);
}
