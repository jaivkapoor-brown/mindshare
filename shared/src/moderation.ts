// Local profanity list: the fallback when the moderation endpoint is unavailable, and a fast first pass always.
// Kept short and blunt on purpose; matches whole words (with simple leetspeak folding).
const BLOCKED = [
  "fuck", "fucking", "fucker", "motherfucker", "shit", "bullshit", "cunt", "bitch", "bastard", "asshole",
  "dick", "cock", "pussy", "whore", "slut", "fag", "faggot", "nigger", "nigga", "retard", "retarded",
  "spic", "chink", "kike", "tranny", "twat", "wanker", "rape", "rapist", "nazi", "dildo", "porn", "cum",
];

function fold(text: string): string {
  return text
    .toLowerCase()
    .replace(/[@4]/g, "a")
    .replace(/3/g, "e")
    .replace(/[1!|]/g, "i")
    .replace(/0/g, "o")
    .replace(/[$5]/g, "s")
    .replace(/7/g, "t")
    .replace(/\*/g, "u");
}

export function localFlag(text: string): boolean {
  const words = fold(text).split(/[^a-z]+/).filter(Boolean);
  const joined = words.join("");
  for (const w of words) if (BLOCKED.includes(w)) return true;
  // catch "f u c k" style spacing for the worst offenders
  for (const b of ["fuck", "nigger", "faggot", "cunt"]) if (joined.includes(b)) return true;
  return false;
}
