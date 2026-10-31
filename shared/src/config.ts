// Every tunable number in Mindshare lives here. Logic must import from this file, never hard-code.

// Seats and rooms
export const MIN_SEATS = 3;
export const MAX_PLAYERS = 10;
export const SOLO_PAD_TO = 4; // rooms with fewer than MIN_SEATS humans are padded to this many seats with bots
export const NICK_MIN = 2;
export const NICK_MAX = 16;
export const ROOM_CODE_LENGTH = 4;
export const ROOM_CODE_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ"; // no I, no O
export const ROOM_CODE_RETRIES = 20;
export const ROOM_IDLE_MS = 2 * 60 * 60 * 1000;
export const AWAY_AFTER_MISSED_ROUNDS = 2;

// Rounds
export const ROUND_OPTIONS = [3, 5, 7] as const;
export const DEFAULT_ROUNDS = 5;
export const TUTORIAL_WEIGHT = 0.5;

// Phase durations (ms)
export const CLUE_MS = 8_000;
export const WRITE_MS = 30_000;
export const MARKET_MS = 60_000;
export const VERDICT_MAX_MS = 6_000;
export const VERDICT_MIN_MS = 2_000; // drumroll is never shorter than this
export const REVEAL_MS = 20_000;
export const REVEAL_EXTEND_MS = 20_000;
export const SCOREBOARD_MS = 20_000;
export const SETUP_MS = 1_500; // "a new judge takes the bench" beat

// Answers
export const ANSWER_MAX = 80;
export const ANSWER_MIN = 1;
export const NO_ANSWER = "(no answer)";
export const REMOVED_ANSWER = "(answer removed)";
export const MIN_TICKERS = 3;
export const DECOYS_SMALL_ROOM = 2; // when seats <= DECOY_SMALL_ROOM_MAX
export const DECOYS_LARGE_ROOM = 1;
export const DECOY_SMALL_ROOM_MAX = 5;
export const DECOY_BAIT_RATE = 0.5;
export const TICKERS = "ABCDEFGHJKLMNPQR";

// Market
export const CREDITS_PER_ROUND = 100;
export const B_SMALL = 25; // 3 to 5 seats
export const B_LARGE = 40; // 6 to 10 seats
export const B_SMALL_MAX_SEATS = 5;
export const TRADE_SIZE_TAP = 1;
export const TRADE_SIZE_LONG = 5;
export const MAX_SHARES_PER_OUTCOME = 60; // per player, per answer
export const ROYALTY = 30;
export const CROWD_BONUS = 10;
export const TELL_AT_REMAINING_MS = 30_000;
export const COST_TOLERANCE = 2;
export const TRADE_RATE_PER_SEC = 10;
export const PRICE_BROADCAST_MS = 100; // 10 Hz cap
export const PRICE_SAMPLE_MS = 1_000;
export const MAX_CHART_LINES = 12;

// Audience
export const AUDIENCE_CREDITS = 100;
export const AUDIENCE_B = 25;

// Insider
export const INSIDER_MISS_BONUS = 20;

// Bots
export const BOT_TRADE_MIN_MS = 4_000;
export const BOT_TRADE_MAX_MS = 7_000;
export const BOT_NOISE_SIGMA = 1.5;
export const BOT_BUY_MIN = 3;
export const BOT_BUY_MAX = 8;
export const BOT_QUIET_FINAL_MS = 3_000;
export const BOT_WRITE_MIN_MS = 4_000;
export const BOT_WRITE_MAX_MS = 14_000;

// Keyword judge
export const KW_LOVE = 2;
export const KW_HATE = -2;
export const KW_QUIRK = 1;
export const KW_IDENTITY_BOT = 1; // used only by bot belief scoring, not by the judge
export const KW_SHORT_BONUS = 1;
export const KW_SHORT_LEN = 40;

// LLM
export const MODEL_FAST = "gpt-5.4-mini"; // reasoning effort "none": ~1.1 s for a verdict-sized call
export const MODEL_BEST = "gpt-5.5"; // reasoning effort "low": ~3 s, noticeably better judgment
export const REASONING_FAST = "none";
export const REASONING_BEST = "low";
export const VERDICT_BEST_BUDGET_MS = 4_200; // first verdict attempt; the retry uses MODEL_FAST in what is left of 6 s
export const LLM_RETRY_MIN_MS = 1_200; // don't start a retry with less time than this
export const MODERATION_MODEL = "omni-moderation-latest";
export const LLM_TIMEOUT_VOICE_MS = 3_000;
export const LLM_TIMEOUT_DECOYS_MS = 8_000;
export const LLM_TIMEOUT_TELL_MS = 10_000;
export const LLM_TIMEOUT_VERDICT_MS = 6_000;
export const LLM_TIMEOUT_BOTS_MS = 8_000;
export const LLM_TIMEOUT_CUSTOM_MS = 10_000;
export const LLM_TIMEOUT_MODERATE_MS = 2_000;
export const VERDICT_TEMPERATURE = 0.3;
export const VERDICT_REASON_MAX_WORDS = 20;

// Client
export const SYNC_GRACE_MS = 1_500;
export const RECONNECT_BASE_MS = 500;
export const RECONNECT_MAX_MS = 5_000;
export const LONG_PRESS_MS = 450;
