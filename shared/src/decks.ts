import traitsJson from "../traits.json";
import promptsJson from "../prompts.json";
import decoyJson from "../decoy_bank.json";
import type { Trait } from "./types";

export interface PromptEntry {
  id: number;
  text: string;
  category: string;
}

export const TRAITS = traitsJson as unknown as {
  identities: Trait[];
  loves: Trait[];
  hates: Trait[];
  quirks: Trait[];
};

export const PROMPTS = (promptsJson as unknown as { prompts: PromptEntry[] }).prompts;

export const DECOY_BANK = Object.fromEntries(
  Object.entries(decoyJson as Record<string, unknown>).filter(([k, v]) => !k.startsWith("_") && Array.isArray(v)),
) as Record<string, string[]>;

export function decoysFor(category: string): string[] {
  return DECOY_BANK[category] ?? Object.values(DECOY_BANK).flat();
}
