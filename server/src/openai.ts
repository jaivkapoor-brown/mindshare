import {
  LLM_RETRY_MIN_MS,
  LLM_TIMEOUT_BOTS_MS,
  LLM_TIMEOUT_CUSTOM_MS,
  LLM_TIMEOUT_DECOYS_MS,
  LLM_TIMEOUT_MODERATE_MS,
  LLM_TIMEOUT_TELL_MS,
  LLM_TIMEOUT_VERDICT_MS,
  LLM_TIMEOUT_VOICE_MS,
  MODEL_BEST,
  MODEL_FAST,
  MODERATION_MODEL,
  REASONING_BEST,
  REASONING_FAST,
  VERDICT_BEST_BUDGET_MS,
  VERDICT_TEMPERATURE,
  DECOY_TEMPERATURE,
  TELL_TEMPERATURE,
  BOT_ANSWER_TEMPERATURE,
  DECOY_LENGTH_FACTOR,
  DECOY_DEFAULT_LEN,
  MODERATION_STRONG_SCORE,
  MODERATION_HARASSMENT_SCORE,
} from "@mindshare/shared";
import type { Persona, Trait } from "@mindshare/shared";
import verdictTpl from "../../prompts/verdict.md";
import decoysTpl from "../../prompts/decoys.md";
import tellTpl from "../../prompts/tell.md";
import voiceTpl from "../../prompts/persona_voice.md";
import botsTpl from "../../prompts/bot_answers.md";
import customTpl from "../../prompts/custom_judge.md";
import type {
  BotAnswersInput,
  CustomJudgeInput,
  CustomJudgeResult,
  DecoyInput,
  Llm,
  PersonaCore,
  TellInput,
  VerdictInput,
  VerdictResult,
  VoiceResult,
} from "./llm";
import { NullLlm } from "./llm";

export function fill(tpl: string, vars: Record<string, string | number>): string {
  return tpl.replace(/\{\{(\w+)\}\}/g, (_, k) => (k in vars ? String(vars[k]) : ""));
}

const KIND_LABEL = { identity: "who you are", loves: "something you love", hates: "something you hate", quirk: "your quirk" } as const;

// ---------- prompt builders (pure; tested without the network) ----------

export function personaVars(p: Pick<Persona, "identity" | "loves" | "hates" | "quirk"> & Partial<Pick<Persona, "name" | "voice">>) {
  return {
    name: p.name ?? "",
    identity: p.identity.text,
    loves: p.loves.text,
    hates: p.hates.text,
    quirk: p.quirk.text,
    voice_line: p.voice ? `- How you talk: ${p.voice}` : "",
  };
}

export function buildVerdictPrompt(input: VerdictInput) {
  const system = fill(verdictTpl, { ...personaVars(input.persona), prompt: input.prompt });
  const user = input.answers.map((a) => `<answer id="${a.ticker}">${a.text.replace(/[<>]/g, " ")}</answer>`).join("\n");
  return { system, user };
}

export function verdictSchema(letters: string[]) {
  return {
    type: "object",
    additionalProperties: false,
    required: ["winner", "runner_up", "reason"],
    properties: {
      winner: { type: "string", enum: letters },
      runner_up: { type: "string", enum: letters },
      reason: { type: "string" },
    },
  };
}

export function buildDecoyPrompt(input: DecoyInput) {
  const lens = input.examples.map((e) => e.length).sort((a, b) => a - b);
  const target = Math.round((lens.length ? lens[Math.floor(lens.length / 2)] : DECOY_DEFAULT_LEN) * DECOY_LENGTH_FACTOR);
  const roles = input.bait
    .map((b, i) =>
      b === "winner"
        ? `${i + 1}. Looks like a strong pick for this judge at first glance, but quietly touches what the judge hates, so it should lose.`
        : `${i + 1}. Looks weak or random at first glance; it faintly echoes the judge's quirk or who they are (never what they love), so it's a long shot that could surprise.`,
    )
    .join("\n");
  const examples_line = input.examples.length
    ? `Real answers from this room looked like: ${input.examples.map((e) => `"${e.replace(/"/g, "'")}"`).join(" and ")}.`
    : "";
  return fill(decoysTpl, { ...personaVars(input.persona), prompt: input.prompt, count: input.count, roles, examples_line, target_len: target });
}

export function buildTellPrompt(input: TellInput) {
  const banned = input.trait.text
    .toLowerCase()
    .split(/[^a-z]+/)
    .filter((w) => w.length > 3)
    .join(", ");
  return fill(tellTpl, {
    ...personaVars(input.persona),
    prompt: input.prompt,
    kind_label: KIND_LABEL[input.kind],
    trait: input.trait.text,
    banned: banned || "(none)",
  });
}

const deckList = (deck: Trait[]) => deck.map((t) => `${t.id}: ${t.text}`).join("\n");

// ---------- transport ----------

interface CallOpts {
  label: string;
  model: string;
  reasoning?: string;
  temperature?: number;
  system: string;
  user: string;
  schema: Record<string, unknown>;
  timeoutMs: number;
  maxTokens?: number;
}

export type FetchLike = (url: string, init: RequestInit) => Promise<Response>;

export class OpenAiLlm implements Llm {
  constructor(private key: string, private fetcher: FetchLike = (u, i) => fetch(u, i), private log: (e: Record<string, unknown>) => void = (e) => console.log(JSON.stringify(e))) {}

  private async call<T>(o: CallOpts): Promise<T | null> {
    const ctl = new AbortController();
    const timer = setTimeout(() => ctl.abort(), o.timeoutMs);
    const start = Date.now();
    try {
      const body: Record<string, unknown> = {
        model: o.model,
        input: [
          { role: "system", content: o.system },
          { role: "user", content: o.user },
        ],
        text: { format: { type: "json_schema", name: o.label, schema: o.schema, strict: true } },
        max_output_tokens: o.maxTokens ?? 600,
        store: false,
      };
      if (o.reasoning) body.reasoning = { effort: o.reasoning };
      if (o.temperature != null && (!o.reasoning || o.reasoning === "none")) body.temperature = o.temperature;
      const res = await this.fetcher("https://api.openai.com/v1/responses", {
        method: "POST",
        headers: { "content-type": "application/json", authorization: `Bearer ${this.key}` },
        body: JSON.stringify(body),
        signal: ctl.signal,
      });
      const json = (await res.json()) as {
        error?: { message?: string };
        output?: { type: string; content?: { type: string; text?: string }[] }[];
        usage?: { input_tokens?: number; output_tokens?: number };
      };
      const ms = Date.now() - start;
      if (!res.ok || json.error) {
        this.log({ ev: "llm_error", call: o.label, model: o.model, ms, status: res.status, err: json.error?.message?.slice(0, 160) });
        return null;
      }
      const text = json.output?.find((x) => x.type === "message")?.content?.find((c) => c.type === "output_text")?.text;
      this.log({ ev: "llm_usage", call: o.label, model: o.model, ms, in: json.usage?.input_tokens, out: json.usage?.output_tokens });
      if (!text) return null;
      return JSON.parse(text) as T;
    } catch (e) {
      this.log({ ev: "llm_error", call: o.label, model: o.model, ms: Date.now() - start, err: String((e as Error)?.name ?? e) });
      return null;
    } finally {
      clearTimeout(timer);
    }
  }

  /** One attempt plus one retry, both inside a single overall deadline. */
  private async withRetry<T>(totalMs: number, attempt: (budgetMs: number, n: number) => Promise<T | null>): Promise<T | null> {
    const deadline = Date.now() + totalMs;
    const first = await attempt(totalMs, 0);
    if (first != null) return first;
    const left = deadline - Date.now();
    if (left < LLM_RETRY_MIN_MS) return null;
    return attempt(left, 1);
  }

  async personaVoice(p: PersonaCore): Promise<VoiceResult | null> {
    const schema = { type: "object", additionalProperties: false, required: ["name", "voice"], properties: { name: { type: "string" }, voice: { type: "string" } } };
    const system = fill(voiceTpl, personaVars(p));
    return this.withRetry(LLM_TIMEOUT_VOICE_MS, (ms) =>
      this.call<VoiceResult>({ label: "persona_voice", model: MODEL_FAST, reasoning: REASONING_FAST, system, user: "Name and voice this judge.", schema, timeoutMs: ms, maxTokens: 120 }),
    );
  }

  async decoys(input: DecoyInput): Promise<string[] | null> {
    if (input.count <= 0) return [];
    const schema = { type: "object", additionalProperties: false, required: ["answers"], properties: { answers: { type: "array", items: { type: "string" } } } };
    const system = buildDecoyPrompt(input);
    const r = await this.withRetry(LLM_TIMEOUT_DECOYS_MS, (ms) =>
      this.call<{ answers: string[] }>({ label: "decoys", model: MODEL_FAST, reasoning: REASONING_FAST, temperature: DECOY_TEMPERATURE, system, user: `Write ${input.count} answer(s).`, schema, timeoutMs: ms, maxTokens: 200 }),
    );
    return r?.answers?.filter((a) => typeof a === "string" && a.trim()).slice(0, input.count) ?? null;
  }

  async tell(input: TellInput): Promise<string | null> {
    const schema = { type: "object", additionalProperties: false, required: ["tell"], properties: { tell: { type: "string" } } };
    const system = buildTellPrompt(input);
    const r = await this.withRetry(LLM_TIMEOUT_TELL_MS, (ms) =>
      this.call<{ tell: string }>({ label: "tell", model: MODEL_FAST, reasoning: REASONING_FAST, temperature: TELL_TEMPERATURE, system, user: "Say your line.", schema, timeoutMs: ms, maxTokens: 120 }),
    );
    const t = r?.tell?.trim();
    if (!t) return null;
    if (t.toLowerCase().includes(input.trait.text.toLowerCase())) return null; // stated it outright
    return t;
  }

  /** The verdict is hedged: MODEL_BEST and MODEL_FAST run in parallel; BEST wins if it answers within its budget. */
  async verdict(input: VerdictInput): Promise<VerdictResult | null> {
    const letters = input.answers.map((a) => a.ticker);
    const { system, user } = buildVerdictPrompt(input);
    const schema = verdictSchema(letters);
    type Out = { winner: string; runner_up: string; reason: string };
    const valid = (r: Out | null) => (r && letters.includes(r.winner) ? r : null);
    const fast = this.call<Out>({ label: "verdict_fast", model: MODEL_FAST, reasoning: REASONING_FAST, temperature: VERDICT_TEMPERATURE, system, user, schema, timeoutMs: LLM_TIMEOUT_VERDICT_MS - 300, maxTokens: 200 });
    const best = valid(await this.call<Out>({ label: "verdict", model: MODEL_BEST, reasoning: REASONING_BEST, temperature: VERDICT_TEMPERATURE, system, user, schema, timeoutMs: VERDICT_BEST_BUDGET_MS, maxTokens: 700 }));
    const r = best ?? valid(await fast);
    if (!r) return null;
    return { winner: r.winner, reason: r.reason, runnerUp: letters.includes(r.runner_up) && r.runner_up !== r.winner ? r.runner_up : null };
  }

  async botAnswers(input: BotAnswersInput): Promise<string[] | null> {
    const schema = { type: "object", additionalProperties: false, required: ["answers"], properties: { answers: { type: "array", items: { type: "string" } } } };
    const examples_line = input.examples.length ? `For reference, people in this room write like: ${input.examples.map((e) => `"${e.replace(/"/g, "'")}"`).join(" and ")}.` : "";
    const clues_block = input.clues?.some(Boolean)
      ? "Each player holds one secret clue about the judge and leans into it (subtly, the way a clever player would):\n" +
        input.clues.map((c, i) => `- Player ${i + 1}: ${c || "no clue"}`).join("\n")
      : "";
    const system = fill(botsTpl, { prompt: input.prompt, count: input.count, examples_line, clues_block });
    const r = await this.withRetry(LLM_TIMEOUT_BOTS_MS, (ms) =>
      this.call<{ answers: string[] }>({ label: "bot_answers", model: MODEL_FAST, reasoning: REASONING_FAST, temperature: BOT_ANSWER_TEMPERATURE, system, user: `Write ${input.count} answers.`, schema, timeoutMs: ms, maxTokens: 300 }),
    );
    return r?.answers?.map((a) => (typeof a === "string" ? a.trim() : "")).slice(0, input.count) ?? null;
  }

  async moderate(text: string): Promise<boolean | null> {
    const ctl = new AbortController();
    const timer = setTimeout(() => ctl.abort(), LLM_TIMEOUT_MODERATE_MS);
    const start = Date.now();
    try {
      const res = await this.fetcher("https://api.openai.com/v1/moderations", {
        method: "POST",
        headers: { "content-type": "application/json", authorization: `Bearer ${this.key}` },
        body: JSON.stringify({ model: MODERATION_MODEL, input: text }),
        signal: ctl.signal,
      });
      const json = (await res.json()) as { results?: { flagged: boolean; category_scores?: Record<string, number> }[] };
      this.log({ ev: "llm_usage", call: "moderate", ms: Date.now() - start });
      const r = json.results?.[0];
      if (!r) return null;
      // Party-game answers are edgy by design; only block clear harassment, hate, sexual or self-harm content.
      const s = r.category_scores ?? {};
      const strong = ["hate", "hate/threatening", "harassment/threatening", "sexual", "sexual/minors", "self-harm", "self-harm/intent", "self-harm/instructions", "violence/graphic"].some((k) => (s[k] ?? 0) > MODERATION_STRONG_SCORE);
      return r.flagged && (strong || (s["harassment"] ?? 0) > MODERATION_HARASSMENT_SCORE);
    } catch {
      return null;
    } finally {
      clearTimeout(timer);
    }
  }

  async customJudge(input: CustomJudgeInput): Promise<CustomJudgeResult | null> {
    const ids = (d: Trait[]) => d.map((t) => t.id);
    const schema = {
      type: "object",
      additionalProperties: false,
      required: ["ok", "name", "voice", "identity_text", "identity_id", "loves_id", "hates_id", "quirk_id"],
      properties: {
        ok: { type: "boolean" },
        name: { type: "string" },
        voice: { type: "string" },
        identity_text: { type: "string" },
        identity_id: { type: "string", enum: ids(input.identities) },
        loves_id: { type: "string", enum: ids(input.loves) },
        hates_id: { type: "string", enum: ids(input.hates) },
        quirk_id: { type: "string", enum: ids(input.quirks) },
      },
    };
    const system = fill(customTpl, {
      description: input.description.replace(/[<>]/g, " "),
      identities: deckList(input.identities),
      loves: deckList(input.loves),
      hates: deckList(input.hates),
      quirks: deckList(input.quirks),
    });
    type Out = { ok: boolean; name: string; voice: string; identity_text: string; identity_id: string; loves_id: string; hates_id: string; quirk_id: string };
    const r = await this.withRetry(LLM_TIMEOUT_CUSTOM_MS, (ms) =>
      this.call<Out>({ label: "custom_judge", model: MODEL_BEST, reasoning: REASONING_FAST, system, user: "Build the judge.", schema, timeoutMs: ms, maxTokens: 300 }),
    );
    if (!r || !r.ok) return null;
    return mapCustom(r, input);
  }
}

export function mapCustom(
  r: { name: string; voice: string; identity_text: string; identity_id: string; loves_id: string; hates_id: string; quirk_id: string },
  input: CustomJudgeInput,
): CustomJudgeResult | null {
  const find = (d: Trait[], id: string) => d.find((t) => t.id === id);
  const base = find(input.identities, r.identity_id);
  const loves = find(input.loves, r.loves_id);
  const hates = find(input.hates, r.hates_id);
  const quirk = find(input.quirks, r.quirk_id);
  if (!base || !loves || !hates || !quirk) return null;
  const idText = (r.identity_text || base.text).slice(0, 100);
  return {
    name: (r.name || "Judge Custom").slice(0, 40),
    voice: (r.voice || "").slice(0, 160),
    identity: { id: "custom", text: idText, clue_text: `is ${idText}`, keywords: base.keywords },
    loves,
    hates,
    quirk,
  };
}

export function makeLlm(env: { OPENAI_API_KEY?: string; LLM_MODE?: string }): Llm {
  if (env.LLM_MODE === "off" || !env.OPENAI_API_KEY) return new NullLlm();
  return new OpenAiLlm(env.OPENAI_API_KEY);
}
