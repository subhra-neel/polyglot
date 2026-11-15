/**
 * Kannada script → Polyglot romanisation.
 *
 * Convention (see the plan, section 2):
 *   - long vowels carry a macron: ā ī ū ē ō
 *   - retroflex consonants are capitals: T Th D Dh N L
 *   - everything else is plain lower case: ch, sh, ny, ...
 *
 * Used only to CHECK content: every sentence stores both forms, and the
 * check fails when they disagree. This catches a typo in either one.
 */

const VIRAMA = "್";
const ANUSVARA = "ಂ";
const VISARGA = "ಃ";

const CONSONANTS: Record<string, string> = {
  "ಕ": "k", "ಖ": "kh", "ಗ": "g", "ಘ": "gh", "ಙ": "n",
  "ಚ": "ch", "ಛ": "chh", "ಜ": "j", "ಝ": "jh", "ಞ": "ny",
  "ಟ": "T", "ಠ": "Th", "ಡ": "D", "ಢ": "Dh", "ಣ": "N",
  "ತ": "t", "ಥ": "th", "ದ": "d", "ಧ": "dh", "ನ": "n",
  "ಪ": "p", "ಫ": "ph", "ಬ": "b", "ಭ": "bh", "ಮ": "m",
  "ಯ": "y", "ರ": "r", "ಱ": "r", "ಲ": "l", "ವ": "v",
  "ಶ": "sh", "ಷ": "sh", "ಸ": "s", "ಹ": "h", "ಳ": "L", "ೞ": "L",
};

const INDEPENDENT_VOWELS: Record<string, string> = {
  "ಅ": "a", "ಆ": "ā", "ಇ": "i", "ಈ": "ī", "ಉ": "u", "ಊ": "ū", "ಋ": "ru",
  "ಎ": "e", "ಏ": "ē", "ಐ": "ai", "ಒ": "o", "ಓ": "ō", "ಔ": "au",
};

const VOWEL_SIGNS: Record<string, string> = {
  "ಾ": "ā", "ಿ": "i", "ೀ": "ī", "ು": "u", "ೂ": "ū", "ೃ": "ru",
  "ೆ": "e", "ೇ": "ē", "ೈ": "ai", "ೊ": "o", "ೋ": "ō", "ೌ": "au",
};

const LABIALS = new Set(["ಪ", "ಫ", "ಬ", "ಭ", "ಮ"]);

/** True for any character in the Kannada Unicode block. */
export function isKannadaChar(char: string): boolean {
  const code = char.codePointAt(0) ?? 0;
  return code >= 0x0c80 && code <= 0x0cff;
}

export function romanise(script: string): string {
  const chars = Array.from(script);
  let out = "";

  for (let i = 0; i < chars.length; i++) {
    const char = chars[i];
    const next = chars[i + 1];

    if (char in CONSONANTS) {
      out += CONSONANTS[char];
      if (next === VIRAMA) {
        i++; // dead consonant: no vowel
      } else if (next !== undefined && next in VOWEL_SIGNS) {
        out += VOWEL_SIGNS[next];
        i++;
      } else {
        out += "a"; // inherent vowel
      }
    } else if (char in INDEPENDENT_VOWELS) {
      out += INDEPENDENT_VOWELS[char];
    } else if (char === ANUSVARA) {
      // Written as one sign, said as m before p/b/m and n elsewhere.
      out += next !== undefined && LABIALS.has(next) ? "m" : "n";
    } else if (char === VISARGA) {
      out += "h";
    } else if (isKannadaChar(char)) {
      throw new Error(`No romanisation for "${char}" (U+${char.codePointAt(0)!.toString(16).toUpperCase()})`);
    } else {
      out += char; // spaces and punctuation pass through
    }
  }

  return out;
}

/** Strip punctuation and squeeze spaces, so "hēgiddīrā?" compares as "hēgiddīrā". */
export function normaliseRoman(text: string): string {
  return text
    .normalize("NFC")
    .replace(/[?!.,;:'"“”‘’()]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}
