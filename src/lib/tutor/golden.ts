import type { LineCheck } from "./turn";

/**
 * A fixed set of learner lines with the verdict a good teacher would give.
 * Used by the self-test page to measure the live chat model, and to compare
 * models before switching. Two kinds matter equally: mistakes it must catch,
 * and correct spoken forms it must not flag.
 */
export type GoldenCase = {
  id: string;
  tutorLine: string;
  said: string;
  /** Any of these verdicts passes. */
  expect: LineCheck["category"][];
  note: string;
};

const SCENE = { persona: "Lakshmi, a friendly neighbour in her fifties", setting: "Two neighbours meet in the lift of a Bengaluru apartment block." };
export const GOLDEN_SCENE = SCENE;

const FLAGGED: LineCheck["category"][] = ["error", "unnatural", "unclear"];
const ACCEPTED: LineCheck["category"][] = ["none", "valid_variant"];

export const GOLDEN: GoldenCase[] = [
  { id: "fine-it", tutorLine: "ಹೇಗಿದ್ದೀರಾ?", said: "namaskara chennagide", expect: ["error", "unnatural"], note: "chennāgide is 'it is fine'; should be chennāgiddīni" },
  { id: "fine-ok", tutorLine: "ಹೇಗಿದ್ದೀರಾ?", said: "chennagiddini, neevu?", expect: ACCEPTED, note: "correct answer, loose spelling" },
  { id: "ate-garbled", tutorLine: "ಊಟ ಮಾಡಿದ್ರಾ?", said: "uta martara", expect: FLAGGED, note: "not Kannada; should be unclear or corrected" },
  { id: "ate-ok", tutorLine: "ಊಟ ಆಯ್ತಾ?", said: "aytu", expect: ACCEPTED, note: "the normal short answer" },
  { id: "want-nanu", tutorLine: "ನಿಮಗೆ ಏನು ಬೇಕು?", said: "naanu tea beku", expect: ["error"], note: "nānu should be nanage with bēku" },
  { id: "want-nange", tutorLine: "ನಿಮಗೆ ಏನು ಬೇಕು?", said: "nange coffee beku", expect: ACCEPTED, note: "nange is the spoken form; must not be flagged" },
  { id: "name-yours", tutorLine: "ನಿಮ್ಮ ಹೆಸರು ಏನು?", said: "nimma hesaru ravi", expect: ["error"], note: "nimma (your) should be nanna (my)" },
  { id: "name-ok", tutorLine: "ನಿಮ್ಮ ಹೆಸರು ಏನು?", said: "nanna hesaru ravi", expect: ACCEPTED, note: "correct" },
  { id: "bye-ok", tutorLine: "ಸರಿ, ಆಮೇಲೆ ಮಾತಾಡೋಣ.", said: "sari bye", expect: ACCEPTED, note: "natural Bengaluru mix; must not be flagged" },
  { id: "alla-illa", tutorLine: "ಇದು ಕಾಫಿಯಾ?", said: "illa, idu kaafi illa", expect: ["error"], note: "'this is not coffee' needs alla, not illa" },
  { id: "from-ok", tutorLine: "ನೀವು ಎಲ್ಲಿಂದ?", said: "naanu dehaliyinda bandiddini", expect: ACCEPTED, note: "spoken form of bandiddēne; must not be flagged" },
  { id: "know-nanu", tutorLine: "ಕನ್ನಡ ಗೊತ್ತಾ?", said: "naanu kannada svalpa gottu", expect: ["error", "unnatural"], note: "gottu takes nanage, not nānu" },
  { id: "casual-stranger", tutorLine: "ನಿಮ್ಮ ಮನೆ ಎಲ್ಲಿದೆ?", said: "ninna mane elli?", expect: ["error", "register", "unnatural"], note: "asked back with casual ninna to an older neighbour" },
  { id: "english-question", tutorLine: "ಹೇಗಿದ್ದೀರಾ?", said: "how do I say I am fine?", expect: ["none"], note: "an English question is not a mistake" },
];
