/**
 * End-to-end smoke test on a phone-sized screen.
 *
 *   node tests/e2e/smoke.mjs unconfigured   # app built with no Supabase settings
 *   node tests/e2e/smoke.mjs configured     # app built against the mock below
 *
 * "configured" expects the app to have been built and started with
 *   NEXT_PUBLIC_SUPABASE_URL=http://127.0.0.1:54399
 *   NEXT_PUBLIC_SUPABASE_ANON_KEY=mock-key
 *
 * Requires Playwright with a Chromium browser. Screenshots go to the
 * directory named in SMOKE_SHOTS, when set.
 */
import assert from "node:assert/strict";
import { createRequire } from "node:module";
import { join } from "node:path";
import { startMockSupabase } from "./mock-supabase.mjs";

const { chromium, devices } = createRequire(import.meta.url)("playwright");

const mode = process.argv[2];
const BASE = process.env.SMOKE_BASE_URL ?? "http://127.0.0.1:3100";
const SHOTS = process.env.SMOKE_SHOTS;
const MOCK_PORT = 54399;

const browser = await chromium.launch();
const context = await browser.newContext({ ...devices["Pixel 7"], baseURL: BASE });
const page = await context.newPage();

const errors = [];
page.on("pageerror", (error) => errors.push(`page error: ${error.message}`));
page.on("console", (message) => {
  if (message.type() === "error") errors.push(`console: ${message.text()}`);
});

const path = () => new URL(page.url()).pathname;
const shot = async (name) => {
  if (SHOTS) await page.screenshot({ path: join(SHOTS, `${name}.png`) });
};
const step = (label) => console.log(`  ✓ ${label}`);

/** No sideways scrolling on a phone. */
async function assertFitsScreen(label) {
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
  assert.ok(overflow <= 0, `${label}: page is ${overflow}px wider than the screen`);
}

async function unconfigured() {
  await page.goto("/");
  await page.getByRole("heading", { name: /Speak Kannada/ }).waitFor();
  await assertFitsScreen("welcome");
  await shot("01-welcome");
  step("welcome page renders");

  await page.goto("/today");
  await page.waitForURL("**/sign-in");
  step("signed-out visitor is sent from /today to /sign-in");

  await page.getByText("Setup needed").waitFor();
  assert.equal(await page.getByRole("button", { name: "Sign in" }).isDisabled(), true);
  await shot("02-sign-in-setup-needed");
  step("sign-in explains setup and keeps the form disabled");

  const manifest = await page.request.get("/manifest.webmanifest");
  assert.equal(manifest.status(), 200);
  assert.equal((await manifest.json()).display, "standalone");
  step("web app manifest is served");
}

async function configured() {
  const mock = await startMockSupabase(MOCK_PORT);
  const email = "learner@example.com";
  const password = "correct-horse-battery";

  try {
    await page.goto("/learn");
    await page.waitForURL("**/sign-in?next=%2Flearn");
    step("signed-out visitor is sent to sign-in, remembering where they were going");

    await page.getByLabel("Email").fill(email);
    await page.getByLabel("Password").fill("short");
    await page.getByRole("button", { name: "Sign in" }).click();
    assert.equal(path(), "/sign-in");
    step("browser blocks a password that is too short");

    await page.getByLabel("Password").fill("wrong-password");
    await page.getByRole("button", { name: "Sign in" }).click();
    await page.getByText("Email or password is incorrect.").waitFor();
    await shot("03-sign-in-error");
    step("wrong password shows a clear error");

    await page.getByLabel("Password").fill(password);
    await page.getByRole("button", { name: "Create account" }).click();
    await page.waitForURL("**/learn");
    step("creating an account signs in and returns to /learn");

    await page.getByText("Greetings and politeness").waitFor();
    assert.equal(await page.getByRole("listitem").count(), 8);
    await assertFitsScreen("learn");
    await shot("04-learn");
    step("Learn lists the eight Level 1 units from the database");

    await page.getByRole("link", { name: "Today" }).click();
    await page.waitForURL("**/today");
    await assertFitsScreen("today");
    await shot("05-today");
    await page.getByRole("link", { name: "Talk to the tutor" }).click();
    await page.waitForURL("**/talk");
    await shot("06-talk");
    await page.getByRole("link", { name: "Build" }).click();
    await page.waitForURL("**/build");
    await shot("07-build");
    await page.getByRole("link", { name: "Me", exact: true }).click();
    await page.waitForURL("**/me");
    await page.getByText(email).waitFor();
    await assertFitsScreen("me");
    await shot("08-me");
    step("all five tabs open, and Me shows the signed-in email");

    await page.reload();
    await page.getByText(email).waitFor();
    step("session survives a reload");

    await page.goto("/sign-in");
    await page.waitForURL("**/today");
    step("a signed-in learner is sent from /sign-in to /today");

    await page.goto("/me");
    await page.getByRole("button", { name: "Sign out" }).click();
    await page.waitForURL(BASE + "/");
    await page.goto("/today");
    await page.waitForURL("**/sign-in?next=%2Ftoday");
    step("signing out ends the session");

    await page.getByLabel("Email").fill(email);
    await page.getByLabel("Password").fill(password);
    await page.getByRole("button", { name: "Sign in" }).click();
    await page.waitForURL("**/today");
    step("signing back in with the same password works");
  } finally {
    mock.close();
  }
}

try {
  console.log(`Smoke test (${mode}) against ${BASE}`);
  if (mode === "unconfigured") await unconfigured();
  else if (mode === "configured") await configured();
  else throw new Error("Usage: node tests/e2e/smoke.mjs <unconfigured|configured>");

  const unexpected = errors.filter((line) => !/status of 40[01]/.test(line));
  assert.deepEqual(unexpected, [], "browser reported errors");
  step("no browser errors");
  console.log("PASS");
} catch (error) {
  console.error("FAIL:", error.message);
  if (errors.length) console.error(errors.join("\n"));
  process.exitCode = 1;
} finally {
  await browser.close();
}
