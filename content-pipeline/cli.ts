/**
 * npm run content:check   — validate every file in content/
 * npm run content:build   — validate, then write supabase/content.sql
 */
import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { loadContentDir, unitsToSql } from "./build.ts";
import { loadPatterns } from "./patterns.ts";
import { loadScenes, scenesToSql } from "./scenes.ts";

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

const patternFiles = [];
for (const language of languages) {
  const path = join(root, "content", language, "patterns.yaml");
  const { file, problems } = loadPatterns(path);
  for (const p of problems) console.error(`✗ content/${language}/patterns.yaml · ${p}`);
  if (problems.length || !file) failed = true;
  else {
    patternFiles.push({ language, file });
    const combos = file.patterns.reduce((n, p) => n + p.words.length * p.endings.length, 0);
    console.log(`✓ ${language} sentence lab: ${file.patterns.length} patterns, ${file.words.length} words, ${combos} sentences`);
  }
}

const sceneFiles = [];
for (const language of languages) {
  const { file, problems } = loadScenes(join(root, "content", language, "scenes.yaml"));
  for (const p of problems) console.error(`✗ content/${language}/scenes.yaml · ${p}`);
  if (problems.length || !file) failed = true;
  else {
    sceneFiles.push(file);
    console.log(`✓ ${language} tutor scenes: ${file.scenes.length}`);
  }
}

if (failed) {
  console.error("\nContent has problems. Nothing was written.");
  process.exit(1);
}

if (command === "build") {
  const out = join(root, "supabase", "content.sql");
  mkdirSync(dirname(out), { recursive: true });
  writeFileSync(out, unitsToSql(allUnits) + "\n" + sceneFiles.map(scenesToSql).join("\n"));
  console.log(`\nWrote ${out.replace(root + "/", "")}`);
  for (const file of sceneFiles) {
    // Which units each scene practises, so the path can offer it after them.
    const target = join(root, "src", "content", `${file.language}-scenes.json`);
    const scenes = file.scenes.map((s) => ({ slug: s.slug, title: s.title, min_level: s.min_level, uses_units: s.uses_units }));
    writeFileSync(target, JSON.stringify(scenes, null, 2) + "\n");
    console.log(`Wrote ${target.replace(root + "/", "")}`);
  }
  for (const { language, file } of patternFiles) {
    const target = join(root, "src", "content", `${language}-patterns.json`);
    mkdirSync(dirname(target), { recursive: true });
    writeFileSync(target, JSON.stringify(file, null, 2) + "\n");
    console.log(`Wrote ${target.replace(root + "/", "")}`);
  }
} else if (command !== "check") {
  console.error("Usage: node content-pipeline/cli.ts <check|build>");
  process.exit(1);
}
