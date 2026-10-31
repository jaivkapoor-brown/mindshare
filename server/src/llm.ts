import type { Persona, Trait, TraitKind } from "@mindshare/shared";

// Everything the room needs from a language model. Every method resolves to null on any failure;
// the engine then uses the deterministic fallback. Implementations own their timeouts.

export interface PersonaCore {
  identity: Trait;
  loves: Trait;
  hates: Trait;
  quirk: Trait;
}

export interface VoiceResult {
  name: string;
  voice: string;
}

export interface DecoyInput {
  persona: Persona;
  prompt: string;
  count: number;
  bait: ("winner" | "loser")[];
  examples: string[];
}

export interface TellInput {
  persona: Persona;
  prompt: string;
  kind: TraitKind;
  trait: Trait;
}

export interface VerdictInput {
  persona: Persona;
  prompt: string;
  answers: { ticker: string; text: string }[];
}

export interface VerdictResult {
  winner: string;
  reason: string;
  runnerUp: string | null;
}

export interface BotAnswersInput {
  prompt: string;
  count: number;
  examples: string[];
  /** One clue per bot ("The judge ..."), in seat order; each bot leans into its own clue like a real player. */
  clues?: string[];
}

export interface CustomJudgeInput {
  description: string;
  identities: Trait[];
  loves: Trait[];
  hates: Trait[];
  quirks: Trait[];
}

export interface CustomJudgeResult {
  name: string;
  voice: string;
  identity: Trait;
  loves: Trait;
  hates: Trait;
  quirk: Trait;
}

export interface Llm {
  personaVoice(p: PersonaCore): Promise<VoiceResult | null>;
  decoys(input: DecoyInput): Promise<string[] | null>;
  tell(input: TellInput): Promise<string | null>;
  verdict(input: VerdictInput): Promise<VerdictResult | null>;
  botAnswers(input: BotAnswersInput): Promise<string[] | null>;
  moderate(text: string): Promise<boolean | null>;
  customJudge(input: CustomJudgeInput): Promise<CustomJudgeResult | null>;
}

/** Always falls back. Used when no API key is configured and in tests. */
export class NullLlm implements Llm {
  async personaVoice() { return null; }
  async decoys() { return null; }
  async tell() { return null; }
  async verdict() { return null; }
  async botAnswers() { return null; }
  async moderate() { return null; }
  async customJudge() { return null; }
}
