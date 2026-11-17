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
import { readFileSync } from "node:fs";
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
    await page.getByText("Who I am, who you are").waitFor();
    assert.equal(await page.getByText("0 of 2 lessons done").count(), 8);
    assert.equal(await page.getByText("Coming soon").count(), 0);
    await assertFitsScreen("learn");
    await shot("04-learn");
    step("Learn lists the eight Level 1 units; all eight are open");

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

    // Today now leads with revision, because six sentences are due.
    await page.goto("/today");
    await page.getByText("6 sentences are ready to practise").waitFor();
    await page.getByText("Thanks, sorry and goodbye").waitFor();
    await shot("15-today-due");
    step("Today puts the six due sentences first and suggests the next lesson");

    await page.getByRole("link", { name: "Revise now" }).click();
    await page.waitForURL("**/review");
    const reviewCard = page.getByRole("article", { name: "Review card" }).filter({ visible: true });
    await reviewCard.getByText("Say it in Kannada").waitFor();
    assert.equal(await reviewCard.getByText("namaskāra").count(), 0, "answer shown before asking");
    await page.getByText("6 left · 0 done").waitFor();
    await shot("16-review-question");
    await page.getByRole("button", { name: "Show answer" }).click();
    await reviewCard.getByRole("button", { name: "Play" }).waitFor();
    await page.getByRole("group", { name: "How well did you remember?" }).waitFor();
    await shot("17-review-answer");
    step("a review card asks for the Kannada first, then shows it with audio and four answers");

    // "Again" brings the card back in this session; the rest are "Good".
    await page.getByRole("button", { name: /^Again/ }).click();
    await page.getByText("6 left · 1 done").waitFor();
    for (let i = 0; i < 6; i++) {
      await page.getByRole("button", { name: "Show answer" }).click();
      await page.getByRole("button", { name: /^Good/ }).click();
    }
    await page.getByText("All done for now").waitFor();
    await page.getByText("7 reviews finished").waitFor();
    const logs = await mock.db.query("select rating, count(*)::int as n from public.review_logs group by rating order by rating");
    assert.deepEqual(logs.rows, [{ rating: 1, n: 1 }, { rating: 3, n: 6 }]);
    const due = await mock.db.query("select count(*)::int as n from public.review_cards where due <= now()");
    assert.equal(due.rows[0].n, 0);
    step("a forgotten card returns in the same session; afterwards nothing is due and every answer is logged");

    await page.goto("/today");
    await page.getByText("7 / 20").waitFor();
    step("Today counts the seven reviews toward the daily goal");

    await page.goto("/me");
    await page.getByText("sentences learning").waitFor();
    await page.getByText("86%").waitFor();
    await page.getByLabel("Show English meanings").uncheck();
    await page.getByLabel("Show Kannada script").check();
    await page.getByRole("button", { name: "Save settings" }).click();
    await page.getByText("Saved.").waitFor();
    await shot("18-me");
    await page.goto("/learn/greetings/hello-how-are-you");
    const firstLessonCard = page.locator("article:visible").first();
    await firstLessonCard.getByText("ನಮಸ್ಕಾರ").waitFor();
    assert.equal(await firstLessonCard.getByText("Hello", { exact: true }).count(), 0);
    await firstLessonCard.getByRole("button", { name: "Show meaning" }).click();
    await firstLessonCard.getByText("Hello", { exact: true }).waitFor();
    step("Me shows progress (6 of 7 recalled, 86%); settings hide English and show the script on lesson cards");

    // Sentence lab.
    await page.goto("/build");
    await page.getByRole("link", { name: /I want … \/ I don't want …/ }).click();
    await page.waitForURL("**/build/want");
    const lab = page.getByRole("region", { name: "Build a sentence" }).filter({ visible: true });
    await lab.getByRole("button", { name: /^Tī/ }).click();
    await lab.getByRole("button", { name: /^bēDa/ }).click();
    await lab.getByText("nanage Tī bēDa").waitFor();
    await lab.getByText("I don't want tea").waitFor();
    await lab.getByText("ನನಗೆ ಟೀ ಬೇಡ").waitFor(); // script is switched on in settings above
    await shot("19-lab");
    await page.evaluate(() => {
      window.__played = [];
      HTMLMediaElement.prototype.play = function () {
        window.__played.push(new URL(this.src).pathname + new URL(this.src).search);
        return Promise.resolve();
      };
    });
    await lab.getByRole("button", { name: "Play" }).click();
    const [labUrl] = await page.evaluate(() => window.__played);
    assert.match(labUrl, /^\/api\/audio\/lab\/want\/tea\/negative\/normal\?v=[0-9a-f]{12}$/);
    assert.deepEqual(await (await page.request.get(labUrl)).body(), fakeAudio("ನನಗೆ ಟೀ ಬೇಡ", 1));
    assert.equal((await page.request.get("/api/audio/lab/want/rent/statement/normal")).status(), 404);
    step("the lab builds 'nanage Tī bēDa' from chosen parts and speaks it; unbuildable sentences are refused");

    const patterns = JSON.parse(readFileSync(new URL("../../src/content/kn-patterns.json", import.meta.url), "utf8"));
    const want = patterns.patterns.find((p) => p.id === "want");
    const practise = page.getByRole("region", { name: "Practise" }).filter({ visible: true });
    await practise.getByRole("button", { name: "Start practising" }).click();
    for (let round = 0; round < 2; round++) {
      const english = await practise.locator("p.text-xl").innerText();
      const ending = want.endings.find((e) => english.startsWith(e.english.split("{word}")[0].replace(/^./, (c) => c.toUpperCase())));
      const slot = want.words.find((w) => english.endsWith(w.english));
      const wordRoman = patterns.words.find((w) => w.id === slot.word).roman;
      if (round === 0) {
        // Build it correctly.
        await lab.getByRole("button", { name: new RegExp(`^${wordRoman}`) }).click();
        await lab.getByRole("button", { name: new RegExp(`^${ending.roman}`) }).click();
        await practise.getByRole("button", { name: "Check" }).click();
        await practise.getByText(/^Right:/).waitFor();
      } else {
        // Build it with the wrong ending, and get told why.
        const wrong = want.endings.find((e) => e.id !== ending.id);
        await lab.getByRole("button", { name: new RegExp(`^${wordRoman}`) }).click();
        await lab.getByRole("button", { name: new RegExp(`^${wrong.roman}`) }).click();
        await practise.getByRole("button", { name: "Check" }).click();
        await practise.getByText(new RegExp(`end with ${ending.roman}`)).waitFor();
      }
      await practise.getByRole("button", { name: "Next" }).click();
    }
    await practise.getByText("1 / 2 right").waitFor();
    await shot("20-lab-practice");
    step("practice checks a built sentence and explains a wrong ending");

    await page.goto("/learn/greetings/hello-how-are-you");
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
    await page.getByText(email).filter({ visible: true }).waitFor();
    await assertFitsScreen("me");
    await shot("08-me");
    step("all five tabs open, and Me shows the signed-in email");

    await page.reload();
    await page.getByText(email).waitFor();
    step("session survives a reload");

    await page.goto("/sign-in");
    await page.waitForURL("**/today");
    step("a signed-in learner is sent from /sign-in to /today");

    await page.goto("/learn/this-and-that");
    await page.getByRole("link", { name: /What is this\?/ }).filter({ visible: true }).click();
    await page.waitForURL("**/learn/this-and-that/what-is-this");
    await page.locator("article:visible").first().getByText("idu ēnu?").waitFor();
    await assertFitsScreen("unit 3 lesson");
    await shot("10-unit3-lesson");
    step("Unit 3 opens: 'What is this?' starts with idu ēnu?");

    // AI tutor: the stand-in chat model opens the scene, corrects "nānu", and remembers it.
    await page.goto("/talk");
    const teaStall = page.locator("form").filter({ hasText: "At a tea stall" }).filter({ visible: true });
    await teaStall.getByRole("button", { name: "Start" }).click();
    await page.waitForURL(/\/talk\/c\/[0-9a-f-]{36}$/);
    await page.getByText(/^namaskāra! ēnu bēku\?$/).filter({ visible: true }).waitFor();
    await page.getByText("Try: ondu kāfi koDi").filter({ visible: true }).waitFor();
    const opened = mock.chatRequests.at(-1);
    assert.equal(opened.key, "test-sarvam-key");
    assert.equal(opened.model, "sarvam-105b-conversations");
    assert.equal(opened.response_format.json_schema.name, "tutor_turn");
    assert.match(opened.messages[0].content, /Manju/);
    await assertFitsScreen("talk");
    step("starting a scene opens the chat with the tutor's first line");

    const say = page.getByLabel(/Your reply in Kannada/).filter({ visible: true });
    await say.fill("nānu kāfi bēku");
    await page.getByRole("button", { name: "Send" }).filter({ visible: true }).click();
    await page.getByText("sari, kāfi koDtīni.").filter({ visible: true }).waitFor();
    await page.getByRole("button", { name: /Correction/ }).filter({ visible: true }).click();
    await page.getByText("nanage kāfi bēku").filter({ visible: true }).first().waitFor();
    await page.getByText("bēku takes the person who wants").filter({ visible: true }).first().waitFor();
    await shot("09-tutor-correction");
    step("a mistake gets a correction that explains why, and the scene carries on");

    await say.fill("ondu kāfi koDi");
    await page.getByRole("button", { name: "Send" }).filter({ visible: true }).click();
    await page.getByText("sari. innēnu bēku?").filter({ visible: true }).waitFor();
    assert.equal(await page.getByRole("button", { name: /Correction/ }).filter({ visible: true }).count(), 1);
    step("a correct sentence gets no correction");

    if (!process.env.SMOKE_NO_TTS) {
      const { rows } = await mock.db.query("select id from public.messages where role = 'tutor' order by id desc limit 1");
      const line = await page.request.get(`/api/audio/message/${rows[0].id}/slow`);
      assert.equal(line.status(), 200);
      assert.equal(mock.speechRequests.at(-1).text, "ಸರಿ. ಇನ್ನೇನು ಬೇಕು?");
      step("the tutor's lines can be played aloud");
    }

    await page.reload();
    await page.getByText("sari. innēnu bēku?").filter({ visible: true }).waitFor();
    await page.getByRole("button", { name: "Finish conversation" }).filter({ visible: true }).click();
    const summary = page.getByRole("region", { name: "Summary" });
    await summary.getByText("Conversation finished").waitFor();
    await summary.getByText("nanage kāfi bēku").waitFor();
    step("the conversation is saved, and finishing lists what to practise");

    await page.goto("/talk");
    await page.getByText("Recent conversations").filter({ visible: true }).waitFor();
    await page.getByText("1 corrections").filter({ visible: true }).waitFor();
    const neighbour = page.locator("form").filter({ hasText: "Meeting a new neighbour" }).filter({ visible: true });
    await neighbour.getByRole("button", { name: "Start" }).click();
    await page.waitForURL(/\/talk\/c\/[0-9a-f-]{36}$/);
    assert.match(mock.chatRequests.at(-1).messages[0].content, /wrong_case_ending \(1 times\)/);
    step("the next conversation remembers the learner's mistake");

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
