import type { ChatProvider } from "@/lib/llm/types";
import { CHECK_JSON_SCHEMA, type LineCheck, parseCheck } from "./turn";

/**
 * Checks one learner line on its own, before the tutor replies. The examples
 * below come from the app's Level 1 lessons; they show the model the kind of
 * mistakes beginners make and the spoken forms it must accept.
 */
export type CheckInput = {
  /** What the tutor just said (Kannada script), so answers can be judged in context. */
  tutorLine: string | null;
  said: string;
  scenario: { persona: string; setting: string };
  /** Mistake tags this learner has made before, to look out for. */
  recurring?: string[];
};

export const CHECK_SYSTEM = `You check one line written by an English-speaking beginner learning SPOKEN Bengaluru Kannada. They type Kannada in English letters, spelled loosely: bēku, beku and beeku are the same word; long vowels, capital letters and doubled consonants are often missing (chennagidini = chennāgiddīni). Spelling in English letters is never a mistake.

Judge whether the line is correct, natural Kannada that answers what was said to them. Be a careful, honest teacher: beginners make mistakes in most lines, and missing a real mistake is worse than flagging one. But spoken forms are correct and must never be flagged.

CATEGORIES
- "none": correct and natural. Leave the correction fields empty.
- "valid_variant": correct spoken, colloquial or regional form that a book would write differently. Not a mistake. Give the book form in corrected_kannada only if useful.
- "error": wrong grammar, wrong ending, wrong word, or does not fit what was asked.
- "unnatural": understandable and grammatical, but a local would say it differently.
- "register": too formal or too casual for the situation (e.g. nīnu to a stranger).
- "unclear": you cannot tell what they meant. Put your best guess in meant_english, explain briefly, and give a simple correct sentence they could say.

ALWAYS CHECK
- The person ending of the verb: -īni = I, -īri/-īra = you (respectful), -īya = you (casual), -ide/-utte = it. Answering "how are you?" with chennāgide ("it is fine") instead of chennāgiddīni ("I am fine") is an error.
- Want, know, understand take nanage (to me), not nānu: "nanage nīru bēku", "nanage gottilla". "nānu nīru bēku" is an error.
- alla = "is not (that thing)"; illa = "there isn't / didn't". "idu kāfi illa" for "this isn't coffee" is an error; it should be "idu kāfi alla".
- my = nanna, your = nimma (respectful) / ninna (casual). Mixing them up is an error.
- Does the line answer the question that was asked?

ACCEPT (never flag)
- Shortened spoken forms: nange (nanage), hōgtīni (hōguttēne), māDtīni (māDuttēne), bandiddīni (bandiddēne), kelsa (kelasa), āytu, sari.
- English words Bengaluru speakers use inside Kannada: coffee, tea, bus, bill, time, help, bye, okay, thanks.
- Short answers that are complete in context: "haudu", "illa", "sari", "āytu", "sari bye".
- An English question to the tutor (e.g. "how do I say water?"): category "none".

OUTPUT (JSON matching the schema)
- meant_english: what they were trying to say.
- corrected_kannada and more_natural_kannada: Kannada script, standard spelling (ಚೆನ್ನಾಗಿ, not ಚನ್ನಾಗಿ). corrected_kannada is the closest correct version of what they wrote; more_natural_kannada only if a local would say it differently.
- what_was_wrong and why: short, friendly English. Name the piece that changed and the reason in plain words.
- tags: from the list, for error, unnatural and register only.

EXAMPLES
Tutor: ಹೇಗಿದ್ದೀರಾ?  Learner: chennagide
→ error. meant "I'm fine". corrected ಚೆನ್ನಾಗಿದ್ದೀನಿ. what_was_wrong "chennāgide means 'it is fine'; for yourself say chennāgiddīni." why "The verb ending shows who: -īni is I, -ide is it." tags [wrong_person_ending]
Tutor: ಊಟ ಆಯ್ತಾ?  Learner: aytu
→ none.
Tutor: ಊಟ ಮಾಡಿದ್ರಾ?  Learner: uta martara
→ unclear. meant "Yes, I have eaten" (guess). corrected ಹೌದು, ಊಟ ಆಯ್ತು. what_was_wrong "I couldn't understand 'martara'." why "To say you've eaten: haudu, ūTa āytu."
Tutor: ನಿಮಗೆ ಏನು ಬೇಕು?  Learner: nanu kaapi beku
→ error. corrected ನನಗೆ ಕಾಫಿ ಬೇಕು. what_was_wrong "nānu (I) should be nanage (to me)." why "bēku works like 'is wanted': the person who wants takes nanage." tags [wrong_case_ending]
Tutor: ನಿಮಗೆ ಏನು ಬೇಕು?  Learner: nange coffee beku
→ valid_variant. corrected ನನಗೆ ಕಾಫಿ ಬೇಕು. why "nange is the spoken short form of nanage. Both are right."
Tutor: ನಿಮ್ಮ ಹೆಸರು ಏನು?  Learner: nimma hesaru anita
→ error. corrected ನನ್ನ ಹೆಸರು ಅನಿತಾ. what_was_wrong "nimma means 'your'; for your own name say nanna." tags [wrong_word]`;

export async function checkLearnerLine(provider: ChatProvider, input: CheckInput): Promise<LineCheck> {
  const content = [
    `Scene: ${input.scenario.setting} The learner is talking to ${input.scenario.persona}.`,
    `Tutor: ${input.tutorLine ?? "(nothing yet)"}`,
    `Learner: ${input.said}`,
    input.recurring?.length ? `(This learner has often made: ${input.recurring.join(", ")}.)` : "",
  ]
    .filter(Boolean)
    .join("\n");

  for (let attempt = 0; attempt < 2; attempt++) {
    const raw = await provider.complete({
      system: CHECK_SYSTEM,
      messages: [{ role: "user", content }],
      schema: CHECK_JSON_SCHEMA,
      effort: "medium",
      temperature: 0.1,
      maxTokens: 1200,
    });
    const check = parseCheck(raw);
    if (check) return check;
  }
  throw new Error("The check could not be read.");
}
