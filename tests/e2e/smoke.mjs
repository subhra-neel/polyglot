/**
 * End-to-end smoke test on a phone-sized screen.
 *
 *   node tests/e2e/smoke.mjs unconfigured   # app built with no Supabase settings
 *   node tests/e2e/smoke.mjs configured     # app built against the mock below
 *
 * "configured" expects the app to have been built and started with
 *   NEXT_PUBLIC_SUPABASE_URL=http://127.0.0.1:54399
 *   NEXT_PUBLIC_SUPABASE_ANON_KEY=mock-key
 *   SARVAM_API_KEY=test-sarvam-key
 *   SARVAM_API_BASE=http://127.0.0.1:54399
 * Set SMOKE_NO_TTS=1 (and leave out the SARVAM_ settings) to test the app
 * without a voice service.
 *
 * Requires Playwright with a Chromium browser. Screenshots go to the
 * directory named in SMOKE_SHOTS, when set.
 */
import assert from "node:assert/strict";
import { createRequire } from "node:module";
import { join } from "node:path";
import { fakeAudio, startMockSupabase } from "./mock-supabase.mjs";

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
    await page.getByText("0 of 2 lessons done").waitFor();
    assert.equal(await page.getByText("Coming soon").count(), 7);
    await assertFitsScreen("learn");
    await shot("04-learn");
    step("Learn lists the eight Level 1 units; Unit 1 is open, the rest say coming soon");

    await page.getByRole("link", { name: /Greetings and politeness/ }).click();
    await page.waitForURL("**/learn/greetings");
    await page.getByText("Hello and how are you").waitFor();
    await page.getByText("6 sentences").waitFor();
    await page.getByText("9 sentences").waitFor();
    await shot("09-unit");
    step("Unit 1 shows two lessons, counting only checked sentences");

    await page.getByRole("link", { name: /Hello and how are you/ }).click();
    await page.waitForURL("**/learn/greetings/hello-how-are-you");
    await page.getByRole("heading", { name: "Hello and how are you" }).waitFor();
    assert.equal(await page.locator("article:visible").count(), 6);
    await page.getByText("namaskāra", { exact: true }).waitFor();
    assert.equal(await page.getByText("āytu", { exact: true }).count(), 0, "draft sentence is visible");
    await assertFitsScreen("lesson");
    await shot("10-lesson");
    step("lesson shows six sentence cards and hides the draft");

    if (process.env.SMOKE_NO_TTS) {
      // App built without a voice service: Play depends on the phone's voice,
      // and headless Chromium has none.
      await page.getByText("No Kannada voice on this device").waitFor();
      assert.equal(await page.getByRole("button", { name: "Play" }).first().isDisabled(), true);
      step("without a voice service or phone voice, Play is off and the reason is shown");
    } else {
    // Recorded audio (the stand-in Sarvam). Headless Chromium has no Kannada
    // voice, so Play working here proves it does not depend on the phone.
    assert.equal(await page.getByText("No Kannada voice on this device").count(), 0);
    const hello = page.locator("article:visible").first();
    await page.evaluate(() => {
      window.__played = [];
      HTMLMediaElement.prototype.play = function () {
        window.__played.push(new URL(this.src).pathname + new URL(this.src).search);
        return Promise.resolve();
      };
    });
    await hello.getByRole("button", { name: "Play" }).click();
    await hello.getByRole("button", { name: "Slow" }).click();
    const played = await page.evaluate(() => window.__played);
    assert.equal(played.length, 2);
    assert.match(played[0], /^\/api\/audio\/[0-9a-f-]{36}\/normal\?v=[0-9a-f]{12}$/);
    assert.match(played[1], /^\/api\/audio\/[0-9a-f-]{36}\/slow\?v=[0-9a-f]{12}$/);
    step("Play and Slow use recorded audio, with no phone voice needed");

    const normal = await page.request.get(played[0]);
    assert.equal(normal.status(), 200);
    assert.equal(normal.headers()["content-type"], "audio/mpeg");
    assert.match(normal.headers()["cache-control"], /immutable/);
    assert.ok(!normal.headers()["set-cookie"], "audio response must not set cookies, or it cannot be cached");
    assert.deepEqual(await normal.body(), fakeAudio("ನಮಸ್ಕಾರ", 1));
    const slow = await page.request.get(played[1]);
    assert.deepEqual(await slow.body(), fakeAudio("ನಮಸ್ಕಾರ", 0.75));
    const asked = mock.speechRequests.at(-1);
    assert.equal(asked.key, "test-sarvam-key");
    assert.equal(asked.language_code, "kn-IN");
    step("the audio is Sarvam's reading of the Kannada script, at pace 1 and 0.75, and can be cached");

    const anonymous = await browser.newContext({ baseURL: BASE });
    assert.equal((await anonymous.request.get(played[0])).status(), 401);
    await anonymous.close();
    const draftId = "00000000-0000-5000-8000-000000000000";
    assert.equal((await page.request.get(`/api/audio/${draftId}/normal`)).status(), 404);
    assert.equal((await page.request.get(played[0].replace("/normal", "/fast"))).status(), 404);
    const draft = await mock.db.query("select id from public.sentences where validation_status = 'draft' limit 1");
    assert.equal((await page.request.get(`/api/audio/${draft.rows[0].id}/normal`)).status(), 404);
    step("audio is refused when signed out, and for unknown or draft sentences");

    // If recorded audio fails to load, Play falls back to the phone's voice.
    const voicePage = await context.newPage();
    await voicePage.addInitScript(() => {
      const spoken = [];
      window.__spoken = spoken;
      const voice = { name: "Kannada (test)", lang: "kn-IN" };
      class FakeUtterance {
        constructor(text) {
          this.text = text;
        }
      }
      window.SpeechSynthesisUtterance = FakeUtterance;
      Object.defineProperty(window, "speechSynthesis", {
        value: {
          getVoices: () => [voice],
          speak: (u) => spoken.push({ text: u.text, rate: u.rate, lang: u.lang }),
          cancel: () => {},
          addEventListener: () => {},
          removeEventListener: () => {},
        },
      });
      HTMLMediaElement.prototype.play = () => Promise.reject(new Error("network down"));
    });
    await voicePage.goto("/learn/greetings/hello-how-are-you");
    const firstCard = voicePage.locator("article:visible").first();
    await firstCard.getByRole("button", { name: "Play" }).click();
    await firstCard.getByRole("button", { name: "Slow" }).click();
    assert.deepEqual(await voicePage.evaluate(() => window.__spoken), [
      { text: "ನಮಸ್ಕಾರ", rate: 0.9, lang: "kn-IN" },
      { text: "ನಮಸ್ಕಾರ", rate: 0.6, lang: "kn-IN" },
    ]);
    await voicePage.close();
    step("if recorded audio fails, the phone's Kannada voice takes over");
    }

    const card = page.locator("article:visible").filter({ hasText: "hēgiddīrā?" });
    await card.getByRole("button", { name: "How it works" }).click();
    await card.getByText("hēge (how) + iddīri (you are, respectful)").waitFor();
    await card.getByText("hēgiddīyā?").waitFor();
    await card.getByText("hēgiddīri?").waitFor();
    await shot("11-card-open");
    step("a card opens to word-by-word meanings, the reason, and other ways to say it");

    await card.getByRole("button", { name: "I heard it differently" }).click();
    await card.getByLabel(/What did you hear instead/).fill("heard hēgidīra");
    await card.getByRole("button", { name: "Send" }).click();
    await card.getByText("Thanks. This sentence will be checked again.").waitFor();
    const flags = await mock.db.query("select note from public.sentence_flags");
    assert.deepEqual(flags.rows, [{ note: "heard hēgidīra" }]);
    step("a flagged sentence is saved with the learner's note");

    await page.getByRole("button", { name: "I've learned these" }).click();
    await page.getByText("Lesson done. 6 sentences added to your revision.").waitFor();
    await shot("12-done");
    const cards = await mock.db.query("select count(*)::int as n from public.review_cards");
    assert.equal(cards.rows[0].n, 6);
    step("finishing the lesson queues its six sentences for revision");

    await page.getByRole("link", { name: "Next: Thanks, sorry and goodbye" }).click();
    await page.getByRole("heading", { name: "Thanks, sorry and goodbye" }).waitFor();
    assert.equal(await page.locator("article:visible").count(), 9);
    step("the next lesson opens with nine cards");

    await page.goto("/learn/greetings");
    await page.getByText("6 sentences · done").waitFor();
    await page.goto("/learn/greetings/no-such-lesson");
    await page.getByText(/could not be found|404/i).first().waitFor();
    step("progress shows on the unit page; an unknown lesson gives a not-found page");

    await page.goto("/learn");

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

    // An unknown email, from a separate browser so it does not replace this
    // browser's pending reset (only the newest reset link works).
    const stranger = await browser.newContext({ ...devices["Pixel 7"], baseURL: BASE });
    const strangerPage = await stranger.newPage();
    await strangerPage.goto("/forgot-password");
    await strangerPage.getByLabel("Email").fill("nobody@example.com");
    await strangerPage.getByRole("button", { name: "Send reset link" }).click();
    await strangerPage.getByText("If an account exists for nobody@example.com").waitFor();
    await stranger.close();
    mock.recoveries.length = 0;
    step("an unknown email gets the same answer, so accounts cannot be discovered");

    // Forgot password, following the link from Supabase's default email.
    await page.goto("/me");
    await page.getByRole("button", { name: "Sign out" }).click();
    await page.waitForURL(BASE + "/");
    await page.goto("/sign-in");
    await page.getByRole("link", { name: "Forgot password?" }).click();
    await page.waitForURL("**/forgot-password");
    // Next keeps the sign-in page mounted but hidden, so pick the visible field.
    await page.getByLabel("Email").filter({ visible: true }).fill(email);
    await page.getByRole("button", { name: "Send reset link" }).click();
    await page.getByText("Check your email").waitFor();
    await shot("13-forgot-sent");
    assert.equal(mock.recoveries.length, 1);
    assert.equal(mock.recoveries[0].email, email);
    assert.equal(mock.recoveries[0].redirectTo, `${BASE}/auth/confirm?next=%2Freset-password`);
    step("Forgot password sends a reset email that returns to this app");

    await page.goto(mock.codeLinkFor(mock.recoveries[0]));
    await page.waitForURL("**/reset-password");
    await page.getByText(`Choose a new password for ${email}`).waitFor();
    await page.getByLabel("New password").fill("brand-new-password");
    await page.getByLabel("Type it again").fill("brand-new-passwrod");
    await page.getByRole("button", { name: "Save new password" }).click();
    await page.getByText("The two passwords do not match.").waitFor();
    await page.getByLabel("New password").fill("brand-new-password");
    await page.getByLabel("Type it again").fill("brand-new-password");
    await shot("14-new-password");
    await page.getByRole("button", { name: "Save new password" }).click();
    await page.waitForURL("**/today");
    step("the email link opens Set new password, which checks the two entries match");

    await page.goto("/me");
    await page.getByRole("button", { name: "Sign out" }).click();
    await page.waitForURL(BASE + "/");
    await page.goto("/sign-in");
    await page.getByLabel("Email").fill(email);
    await page.getByLabel("Password").fill(password);
    await page.getByRole("button", { name: "Sign in" }).click();
    await page.getByText("Email or password is incorrect.").waitFor();
    await page.getByLabel("Password").fill("brand-new-password");
    await page.getByRole("button", { name: "Sign in" }).click();
    await page.waitForURL("**/today");
    step("afterwards the old password fails and the new one works");

    // The recommended email template (token_hash), opened in a fresh browser,
    // as when the email is read on another device.
    const otherDevice = await browser.newContext({ ...devices["Pixel 7"], baseURL: BASE });
    const other = await otherDevice.newPage();
    const link = mock.tokenHashLinkFor(email, BASE);
    await other.goto(link);
    await other.waitForURL("**/reset-password");
    await other.getByText(`Choose a new password for ${email}`).waitFor();
    step("the recommended email link works even on another device");

    await other.goto(link);
    await other.waitForURL("**/forgot-password?link=expired");
    await other.getByText("That reset link has expired or was already used.").waitFor();
    await otherDevice.close();
    step("a used link is refused and offers to send a new one");

    const fresh = await browser.newContext({ ...devices["Pixel 7"], baseURL: BASE });
    const freshPage = await fresh.newPage();
    await freshPage.goto("/reset-password");
    await freshPage.getByText("This link has expired or was already used").waitFor();
    await fresh.close();
    step("Set new password cannot be used without an email link");
  } finally {
    await mock.close();
  }
}

try {
  console.log(`Smoke test (${mode}) against ${BASE}`);
  if (mode === "unconfigured") await unconfigured();
  else if (mode === "configured") await configured();
  else throw new Error("Usage: node tests/e2e/smoke.mjs <unconfigured|configured>");

  const unexpected = errors.filter((line) => !/status of 40[014]/.test(line));
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
