import { ROOM_CODE_ALPHABET, ROOM_CODE_LENGTH } from "./config";

// Four-letter codes, no I or O, and nothing a teacher would have to explain.
const BLOCKED = [
  "FUCK", "FUKK", "FUCC", "SHIT", "CUNT", "DICK", "COCK", "PISS", "SLUT", "FAGS", "NAGG", "KYKE", "SPKK", "TWAT",
  "ANUS", "ARSE", "DAMN", "HELL", "RAPE", "NAZY", "CRAP", "TYTS", "WANK", "PUSY", "JYZZ", "DYKE", "HUMP", "PRNN",
  "SEXY", "BUTT", "BUMS", "KYLL", "DEAD", "HATE", "PUKE", "SCUM", "SUCK", "PEEN", "TURD", "FART", "JERK", "SPAZ",
  "CUMS", "THUG", "GYPS", "WTFF", "STFU", "KKKK", "MURD", "SXXX",
];

export function isBlockedCode(code: string): boolean {
  const c = code.toUpperCase();
  return BLOCKED.some((b) => c === b) || /(.)\1\1/.test(c) || c.includes("KKK") || c.includes("FUK") || c.includes("CUM") || c.includes("FAG") || c.includes("NAZ");
}

export function randomCode(rand: () => number = Math.random): string {
  for (;;) {
    let c = "";
    for (let i = 0; i < ROOM_CODE_LENGTH; i++) c += ROOM_CODE_ALPHABET[Math.floor(rand() * ROOM_CODE_ALPHABET.length)];
    if (!isBlockedCode(c)) return c;
  }
}

export function isValidCode(code: string): boolean {
  return new RegExp(`^[${ROOM_CODE_ALPHABET}]{${ROOM_CODE_LENGTH}}$`).test(code.toUpperCase());
}
