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

const browser = await chromium.launch({
  args: ["--use-fake-ui-for-media-stream", "--use-fake-device-for-media-stream"],
});
const context = await browser.newContext({ ...devices["Pixel 7"], baseURL: BASE, permissions: ["microphone"] });
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

    await page.getByText("Start here").waitFor();
    await page.getByRole("link", { name: "Start the first lesson" }).waitFor();
    assert.equal(await page.locator("h3[id^=unit-]").count(), 21);
    await page.getByRole("heading", { name: "Level 1 · Absolute beginner" }).waitFor();
    await page.getByRole("heading", { name: "Level 2 · Basic communication" }).waitFor();
    await page.getByRole("heading", { name: "Level 3 · Conversational" }).waitFor();
    await page.getByRole("link", { name: "Lesson: Hello and how are you (next)" }).waitFor();
    assert.equal(await page.getByRole("link", { name: /^Unit check:/ }).count(), 21);
    assert.equal(await page.getByRole("button", { name: /^Talk to the tutor:/ }).count(), 11);
    await page.getByRole("navigation", { name: "Main" }).getByRole("link", { name: "Home", exact: true }).waitFor();
    await assertFitsScreen("home path");
    await shot("04-home");
    step("Home is one path: a Start card, then 21 units over three levels, each with lessons, a unit check and tutor scenes");

    await page.getByRole("link", { name: "Guide" }).first().click();
    await page.waitForURL("**/learn/greetings");
    await page.getByText("6 sentences").waitFor();
    await page.getByText("9 sentences").waitFor();
    await page.getByText("Hello and how are you").first().waitFor();
    await shot("09-unit");
    step("Unit 1 shows two lessons, counting only checked sentences");

    await page.goto("/learn/greetings/hello-how-are-you/sentences");
    await page.getByRole("heading", { name: "Hello and how are you" }).waitFor();
    assert.equal(await page.locator("article:visible").count(), 6);
    await page.getByText("namaskāra", { exact: true }).waitFor();
    assert.equal(await page.getByText("āytu", { exact: true }).count(), 0, "draft sentence is visible");
    await assertFitsScreen("lesson");
    await shot("10-lesson");
    step("All sentences shows the lesson's six cards and hides the draft");

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

    await hello.getByRole("button", { name: "Say it" }).click();
    await hello.getByText("Listening… say the sentence, then tap Stop.").waitFor();
    await page.waitForTimeout(1200);
    await hello.getByRole("button", { name: "Stop" }).click();
    await hello.getByText("Clear! Every word came through.").waitFor();
    await hello.getByText("Heard: namaskāra").waitFor();
    assert.equal(mock.sttRequests.at(-1).mode, "transcribe");
    await hello.getByRole("button", { name: "Say it again" }).waitFor();
    await shot("13-say-it");
    step("Say it: the learner repeats the sentence and sees which words came through");

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
    await voicePage.goto("/learn/greetings/hello-how-are-you/sentences");
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

    // The lesson itself: one step per screen.
    const meanings = new Map();
    for (const r of (await mock.db.query("select text_roman, meaning_en from public.sentences")).rows) {
      meanings.set(r.meaning_en, [...(meanings.get(r.meaning_en) ?? []), r.text_roman]);
    }
    const words = (roman) => roman.replace(/[?!.,]/g, "").split(" ").filter(Boolean);
    await page.goto("/learn/greetings/hello-how-are-you");
    await page.getByRole("heading", { name: "Hello and how are you" }).waitFor();
    await page.getByText(/^6 new sentences/).waitFor();
    assert.equal(await page.getByRole("navigation", { name: "Main" }).count(), 0, "the tab bar is hidden during a lesson");
    await shot("10-lesson-start");
    await page.getByRole("button", { name: "Start" }).click();
    await page.getByRole("article", { name: "New sentence 1 of 6" }).getByText("namaskāra", { exact: true }).first().waitFor();
    await assertFitsScreen("lesson step");
    await shot("11-new-sentence");
    const seen = { learn: 0, nice: 0, wrong: 0, prompts: [], missed: null };
    for (let guard = 0; guard < 40; guard++) {
      if (await page.getByRole("region", { name: "Lesson complete" }).isVisible()) break;
      const learn = page.getByRole("article", { name: /^New sentence \d of 6$/ });
      if (await learn.isVisible()) {
        seen.learn++;
        await page.getByRole("button", { name: "Continue" }).click();
        continue;
      }
      const prompt = (await page.locator("h2").first().textContent()).trim();
      const quoted = (await page.getByText(/^“.*”$/).first().textContent().catch(() => "")).replace(/[“”]/g, "");
      seen.prompts.push(`${prompt}|${quoted}`);
      // Answer right where the answer is known, except one deliberate miss
      // on the first question after the first one whose answer we control.
      const romans = meanings.get(quoted) ?? [];
      let missing = false;
      if (prompt === "Which is the Kannada?") {
        const options = await page.locator("main ul button").allTextContents();
        missing = seen.prompts.length > 1 && !seen.missed;
        const pick = missing ? options.find((o) => !romans.includes(o)) : options.find((o) => romans.includes(o));
        await page.locator("main ul button", { hasText: pick }).first().click();
      } else if (prompt === "Put the words in order") {
        const chips = page.locator("main button.rounded-xl.border-2:not([disabled])");
        const have = (await chips.allTextContents()).map((c) => c.trim()).sort().join(" ");
        const right = words(romans.find((r) => words(r).sort().join(" ") === have) ?? "");
        missing = seen.prompts.length > 1 && !seen.missed && new Set(right).size > 1;
        for (const w of missing ? [...right].reverse() : right) {
          await chips.filter({ hasText: new RegExp(`^${w}$`) }).first().click();
        }
        while ((await chips.count()) > 0) await chips.first().click();
      } else if (await page.locator("#typed").isVisible()) {
        missing = seen.prompts.length > 1 && !seen.missed;
        let answer = romans[0] ?? "xyz";
        if (prompt === "Fill in the missing word") {
          const before = words((await page.locator("main p.text-2xl").textContent()).split("____")[0]);
          const full = words(romans.find((r) => words(r).slice(0, before.length).join(" ") === before.join(" ")) ?? "");
          answer = full[before.length] ?? "xyz";
        }
        await page.locator("#typed").fill(missing ? "xyz" : answer);
      } else {
        await page.locator("main ul button").first().click();
      }
      if (missing) seen.missed = `${prompt}|${quoted}`;
      await page.getByRole("button", { name: "Check" }).click();
      const verdict = (await page.getByText(/^(✓ Nice!|Not quite)$/).textContent()).trim();
      if (verdict === "Not quite") seen.wrong++;
      else seen.nice++;
      if (missing) {
        assert.equal(verdict, "Not quite", "a deliberately wrong answer is marked wrong");
        await shot("12-feedback-wrong");
      }
      await page.getByRole("button", { name: "Continue" }).click();
    }
    assert.equal(seen.learn, 6, "each sentence is introduced once");
    assert.ok(seen.nice >= 1 && seen.wrong >= 1, `saw right and wrong answers (${seen.nice}/${seen.wrong})`);
    assert.ok(seen.missed, "one question was answered wrong on purpose");
    const missedAt = seen.prompts.indexOf(seen.missed);
    assert.ok(seen.prompts.slice(missedAt + 1).includes(seen.missed), "a missed question comes back before the end");
    await page.getByText("Saved. 6 sentences join your revision.").waitFor();
    await shot("13-lesson-complete");
    const cards = await mock.db.query("select count(*)::int as n from public.review_cards");
    assert.equal(cards.rows[0].n, 6);
    step("a lesson runs one step per screen: six new sentences, quick questions with feedback, a missed one comes back, and finishing queues six sentences for revision");

    await page.getByRole("link", { name: "Back to the path" }).click();
    await page.waitForURL("**/learn");
    await page.getByText("Up next").waitFor();
    await page.getByRole("link", { name: "Lesson: Hello and how are you (done)" }).waitFor();
    await page.getByRole("link", { name: "Lesson: Thanks, sorry and goodbye (next)" }).waitFor();
    await shot("15-home-due");
    step("back home, lesson 1 is ticked, lesson 2 is next, and six sentences are waiting to revise");

    await page.getByRole("link", { name: /6 sentences to revise/ }).click();
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

    await page.goto("/practice");
    await page.getByText("Nothing due right now · 7 done today").waitFor();
    await page.getByRole("link", { name: /Greetings and politeness/ }).waitFor();
    await assertFitsScreen("practice");
    step("Practice counts the seven reviews and offers the started unit's check");

    await page.goto("/me");
    await page.getByText("sentences learning").waitFor();
    await page.getByText("86%").waitFor();
    await page.getByLabel("Show English meanings").uncheck();
    await page.getByLabel("Show Kannada script").check();
    await page.getByRole("button", { name: "Save settings" }).click();
    await page.getByText("Saved.").waitFor();
    await shot("18-me");
    await page.goto("/learn/greetings/hello-how-are-you");
    await page.getByRole("button", { name: "Start" }).click();
    const firstLessonCard = page.getByRole("article", { name: "New sentence 1 of 6" });
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

    await page.goto("/learn/greetings/hello-how-are-you/sentences");
    await page.getByRole("link", { name: "Next: Thanks, sorry and goodbye" }).click();
    await page.getByRole("heading", { name: "Thanks, sorry and goodbye" }).waitFor();
    await page.getByText(/^9 new sentences/).waitFor();
    step("the next lesson opens with nine new sentences");

    await page.goto("/learn/greetings");
    await page.getByText("6 sentences · done").waitFor();
    await page.goto("/learn/greetings/no-such-lesson");
    await page.getByText(/could not be found|404/i).first().waitFor();
    step("progress shows on the unit page; an unknown lesson gives a not-found page");

    await page.goto("/learn");

    const nav = page.getByRole("navigation", { name: "Main" });
    await nav.getByRole("link", { name: "Practice", exact: true }).click();
    await page.waitForURL("**/practice");
    await shot("05-practice");
    await nav.getByRole("link", { name: "Tutor", exact: true }).click();
    await page.waitForURL("**/talk");
    await shot("06-talk");
    await nav.getByRole("link", { name: "Me", exact: true }).click();
    await page.waitForURL("**/me");
    await page.getByText(email).filter({ visible: true }).waitFor();
    await assertFitsScreen("me");
    await shot("08-me");
    await nav.getByRole("link", { name: "Home", exact: true }).click();
    await page.waitForURL("**/learn");
    assert.equal(await nav.getByRole("link").count(), 4);
    step("all four tabs open (Home, Practice, Tutor, Me), and Me shows the signed-in email");

    await page.goto("/me");
    await page.reload();
    await page.getByText(email).waitFor();
    step("session survives a reload");

    await page.goto("/sign-in");
    await page.waitForURL("**/learn");
    step("a signed-in learner is sent from /sign-in to the path");

    await page.goto("/today");
    await page.waitForURL("**/learn");
    step("the old Today address now opens the path");

    await page.goto("/learn/this-and-that");
    await page.getByRole("link", { name: /What is this\?/ }).filter({ visible: true }).click();
    await page.waitForURL("**/learn/this-and-that/what-is-this");
    await page.getByRole("button", { name: "Start" }).click();
    await page.getByRole("article", { name: /^New sentence 1 of/ }).getByText("idu ēnu?").first().waitFor();
    await assertFitsScreen("unit 3 lesson");
    await shot("10-unit3-lesson");
    step("Unit 3 opens: 'What is this?' starts with idu ēnu?");

    await page.goto("/learn/yesterday");
    await page.getByRole("link", { name: /I went, I came, I did/ }).filter({ visible: true }).click();
    await page.waitForURL("**/learn/yesterday/i-went-i-came");
    await page.getByRole("button", { name: "Start" }).click();
    await page.getByRole("article", { name: /^New sentence 1 of/ }).getByText("nānu ninne manege hōde").first().waitFor();
    await assertFitsScreen("level 2 lesson");
    step("Level 2 opens: 'Yesterday' starts with nānu ninne manege hōde");

    await page.goto("/learn/i-want");
    await page.getByRole("link", { name: /Unit check/ }).filter({ visible: true }).click();
    await page.waitForURL("**/learn/i-want/check");
    const total = Number((await page.getByText(/^Unit check · 1 of \d+$/).textContent()).match(/of (\d+)$/)[1]);
    assert.ok(total >= 6, `a unit check has at least 6 questions (got ${total})`);
    const kinds = new Set();
    for (let n = 0; n < total; n++) {
      await page.getByText(new RegExp(`^Unit check · ${n + 1} of ${total}$`)).waitFor();
      const prompt = (await page.locator("h2").first().textContent()).trim();
      kinds.add(prompt);
      if (prompt === "Put the words in order") {
        const chips = page.locator("main button.rounded-xl.border-2:not([disabled])");
        while ((await chips.count()) > 0) await chips.first().click();
      } else if (await page.locator("#typed").isVisible()) {
        await page.locator("#typed").fill("nanage");
      } else {
        await page.locator("main ul button").first().click();
      }
      await page.getByRole("button", { name: "Check" }).click();
      await page.getByText(/^(✓ Nice!|Not quite)$/).waitFor();
      if (n === 0) await shot("14-unit-check");
      await page.getByRole("button", { name: "Continue" }).click();
    }
    await page.getByText(new RegExp(`^\\d+ of ${total}$`)).waitFor();
    await page.getByRole("button", { name: "New check" }).waitFor();
    assert.ok(kinds.size >= 3, `the check mixes question kinds (${[...kinds].join(", ")})`);
    await page.getByText(/^Saved\./).waitFor();
    step("a unit check mixes word order, listening, gaps and translation, ends with a score, and is saved");

    await page.goto("/me");
    const weak = page.getByRole("link", { name: /I want, I do not want/ }).filter({ visible: true });
    await weak.waitFor();
    assert.match(await weak.textContent(), /\d+\/\d+/);
    await assertFitsScreen("me with weak spots");
    await page.getByText(/^Practice · last 30 days$/).waitFor();
    await page.getByText(/^Active on [1-9]\d* days?$/).waitFor();
    assert.notEqual(await page.locator("li", { hasText: "Building sentences" }).getByText("not yet").count(), 1);
    step("Me lists the checked unit under Weak spots with its score, and practice by skill");

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
    assert.equal(opened.response_format.json_schema.name, "tutor_reply");
    assert.match(opened.messages[0].content, /Manju/);
    await assertFitsScreen("talk");
    step("starting a scene opens the chat with the tutor's first line");

    const say = page.getByLabel(/Your reply in Kannada/).filter({ visible: true });
    await say.fill("nānu kāfi bēku");
    await page.getByRole("button", { name: "Send" }).filter({ visible: true }).click();
    await page.getByText("sari, kāfi koDtīni.").filter({ visible: true }).waitFor();
    const checked = mock.chatRequests.at(-2);
    assert.equal(checked.response_format.json_schema.name, "line_check");
    assert.equal(checked.reasoning_effort, "medium");
    assert.match(checked.messages.at(-1).content, /Tutor: ನಮಸ್ಕಾರ! ಏನು ಬೇಕು\?\nLearner: nānu kāfi bēku/);
    await page.getByRole("button", { name: /Correction/ }).filter({ visible: true }).click();
    await page.getByText("nanage kāfi bēku").filter({ visible: true }).first().waitFor();
    await page.getByText("bēku takes the person who wants").filter({ visible: true }).first().waitFor();
    await shot("09-tutor-correction");
    step("a mistake gets a correction that explains why, and the scene carries on");

    const speechBefore = mock.speechRequests.length;
    await page.getByRole("switch", { name: /Voice mode/ }).click();
    assert.equal(await page.getByRole("switch", { name: /Voice mode/ }).getAttribute("aria-checked"), "true");
    await say.fill("ondu kāfi koDi");
    await page.getByRole("button", { name: "Send" }).filter({ visible: true }).click();
    await page.getByText("sari. innēnu bēku?").filter({ visible: true }).waitFor();
    assert.equal(await page.getByRole("button", { name: /Correction/ }).filter({ visible: true }).count(), 1);
    await page.getByText("✓ Correct").filter({ visible: true }).waitFor();
    for (let i = 0; i < 20 && mock.speechRequests.length === speechBefore; i++) await page.waitForTimeout(250);
    assert.ok(mock.speechRequests.length > speechBefore, "voice mode played the reply");
    await page.getByRole("switch", { name: /Voice mode/ }).click();
    step("a correct sentence is marked ✓ Correct, and voice mode plays the reply aloud");

    await say.fill("ūTa martara");
    await page.getByRole("button", { name: "Send" }).filter({ visible: true }).click();
    await page.getByText("kshamisi, innomme hēLi.").filter({ visible: true }).waitFor();
    await page.getByRole("button", { name: /Unclear/ }).filter({ visible: true }).click();
    await page.getByText("Yes, I have eaten").filter({ visible: true }).waitFor();
    await page.getByText("haudu, ūTa āytu").filter({ visible: true }).first().waitFor();
    step("an unclear line shows a best guess, and the character asks again");

    if (!process.env.SMOKE_NO_TTS) {
      const { rows } = await mock.db.query("select id from public.messages where role = 'tutor' order by id desc limit 1");
      const line = await page.request.get(`/api/audio/message/${rows[0].id}/slow`);
      assert.equal(line.status(), 200);
      assert.equal(mock.speechRequests.at(-1).text, "ಕ್ಷಮಿಸಿ, ಇನ್ನೊಮ್ಮೆ ಹೇಳಿ.");
      step("the tutor's lines can be played aloud");
    }

    await page.getByRole("button", { name: "Speak your reply" }).filter({ visible: true }).click();
    await page.getByText("Listening… tap ■ when you're done").filter({ visible: true }).waitFor();
    await page.waitForTimeout(1200);
    await page.getByRole("button", { name: "Stop and use what I said" }).filter({ visible: true }).click();
    await page.waitForFunction(() => document.querySelector("#say")?.value === "nanage coffee bēku");
    const heard = mock.sttRequests.at(-1);
    assert.deepEqual(
      { key: heard.key, model: heard.model, mode: heard.mode, language: heard.language, hasFile: heard.hasFile },
      { key: "test-sarvam-key", model: "saaras:v3", mode: "codemix", language: "kn-IN", hasFile: true },
    );
    assert.ok(heard.bytes > 1000, "a real recording was sent");
    await shot("12-voice-input");
    await page.getByRole("button", { name: "Send" }).filter({ visible: true }).click();
    await page.getByText("✓ Correct").filter({ visible: true }).nth(1).waitFor();
    await page.getByText("sari. innēnu bēku?").filter({ visible: true }).nth(1).waitFor();
    step("speaking a reply records it, writes it into the box in English letters, and it can be sent");

    const signedOut = await fetch(`${BASE}/api/stt`, { method: "POST", headers: { "content-type": "audio/webm" }, body: "x" });
    assert.equal(signedOut.status, 401);
    const notAudio = await page.request.post("/api/stt", { headers: { "content-type": "text/plain" }, data: "hello" });
    assert.equal(notAudio.status(), 415);
    step("voice input refuses visitors who aren't signed in, and anything that isn't audio");

    await page.reload();
    await page.getByText("kshamisi, innomme hēLi.").filter({ visible: true }).waitFor();
    await page.getByRole("button", { name: "Finish conversation" }).filter({ visible: true }).click();
    const summary = page.getByRole("region", { name: "Summary" });
    await summary.getByText("Conversation finished").waitFor();
    await summary.getByText("nanage kāfi bēku").waitFor();
    step("the conversation is saved, and finishing lists what to practise");

    await page.goto("/talk");
    await page.getByText("Recent conversations").filter({ visible: true }).waitFor();
    await page.getByText(/ 1 corrections$/).filter({ visible: true }).waitFor();
    await page.getByRole("link", { name: "Check the tutor's accuracy" }).filter({ visible: true }).waitFor();
    await page.getByRole("link", { name: "Check the tutor's accuracy" }).filter({ visible: true }).click();
    await page.waitForURL("**/talk/self-test");
    const before = mock.chatRequests.length;
    await page.getByRole("button", { name: "Run the test" }).click();
    await page.getByText(/^\d+ of 14 right$/).waitFor({ timeout: 60_000 });
    assert.equal(mock.chatRequests.length - before, 14);
    await page.getByText("✓ “nange coffee beku”").waitFor();
    await assertFitsScreen("self-test");
    await shot("11-self-test");
    step("the self-test runs 14 known lines through the checker and shows each verdict");
    await page.goto("/talk");
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
    await page.waitForURL("**/learn");
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
    await page.waitForURL("**/learn");
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
    await page.waitForURL("**/learn");
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
  if (SHOTS) await page.screenshot({ path: `${SHOTS}/failure.png`, fullPage: true }).catch(() => {});
  process.exitCode = 1;
} finally {
  await browser.close();
}
