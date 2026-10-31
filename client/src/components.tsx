import { useEffect, useState } from "react";
import { MAX_CHART_LINES } from "@mindshare/shared";
import type { Toast } from "./net";
import { useCountdown } from "./net";

// ---------- judge blob ----------

export type Mood = "neutral" | "smug" | "grumpy" | "delighted";

const FACES: Record<Mood, { brows: string; mouth: string; eyes: "dot" | "half" | "happy" }> = {
  neutral: { brows: "M30 34 l10 -1 M54 33 l10 1", mouth: "M38 62 q9 3 18 0", eyes: "dot" },
  smug: { brows: "M30 33 l10 2 M54 31 l10 -3", mouth: "M38 60 q12 8 20 -4", eyes: "half" },
  grumpy: { brows: "M30 30 l11 6 M53 36 l11 -6", mouth: "M37 66 q10 -8 20 0", eyes: "dot" },
  delighted: { brows: "M30 31 q5 -4 10 -1 M54 30 q5 -3 10 1", mouth: "M35 58 q12 14 24 0 z", eyes: "happy" },
};

export function JudgeBlob({ mood = "neutral", size = 72, wobble = false }: { mood?: Mood; size?: number; wobble?: boolean }) {
  const f = FACES[mood] ?? FACES.neutral;
  return (
    <svg width={size} height={size} viewBox="0 0 96 96" aria-label={`The judge looks ${mood}`} role="img" className={wobble ? "wobble" : undefined}>
      <path
        d="M14 54c-3-20 10-40 34-42 22-2 36 14 36 34 0 22-14 36-36 36-18 0-31-10-34-28z"
        fill="#f5b942"
        stroke="#1a1407"
        strokeWidth="3"
        strokeLinejoin="round"
      />
      <path d="M22 74 q-4 8 -10 10 M74 74 q5 8 11 9" stroke="#1a1407" strokeWidth="3" fill="none" strokeLinecap="round" />
      <path d={f.brows} stroke="#1a1407" strokeWidth="3" strokeLinecap="round" fill="none" />
      {f.eyes === "dot" && (
        <>
          <circle cx="36" cy="44" r="4" fill="#1a1407" />
          <circle cx="58" cy="44" r="4" fill="#1a1407" />
        </>
      )}
      {f.eyes === "half" && (
        <>
          <path d="M31 45 h10" stroke="#1a1407" strokeWidth="4" strokeLinecap="round" />
          <path d="M53 45 h10" stroke="#1a1407" strokeWidth="4" strokeLinecap="round" />
        </>
      )}
      {f.eyes === "happy" && (
        <>
          <path d="M31 46 q5 -6 10 0" stroke="#1a1407" strokeWidth="3.5" fill="none" strokeLinecap="round" />
          <path d="M53 46 q5 -6 10 0" stroke="#1a1407" strokeWidth="3.5" fill="none" strokeLinecap="round" />
        </>
      )}
      <path d={f.mouth} stroke="#1a1407" strokeWidth="3" fill={mood === "delighted" ? "#1a1407" : "none"} strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

export function JudgeSays({ mood, text, name, tell, compact }: { mood?: Mood; text: string; name?: string | null; tell?: boolean; compact?: boolean }) {
  return (
    <div className={"judge" + (compact ? " compact" : "")}>
      <JudgeBlob mood={mood} size={compact ? 40 : 56} />
      <div className="grow">
        {name && <div className="small dim" style={{ marginBottom: 4 }}>{name}</div>}
        <div className={"bubble" + (tell ? " tell" : "")} role={tell ? "status" : undefined}>{text}</div>
      </div>
    </div>
  );
}

// ---------- countdown ----------

export function Countdown({ endsAt, offset, total, onSyncing }: { endsAt: number | null; offset: number; total: number; onSyncing?: boolean }) {
  const left = useCountdown(endsAt, offset);
  if (left == null) return null;
  const secs = Math.max(0, Math.ceil(left / 1000));
  const pct = Math.max(0, Math.min(100, (left / total) * 100));
  return (
    <div className="countdown" role="timer" aria-label={`${secs} seconds left`}>
      <div className="bar">
        <div className={"fill" + (secs <= 5 ? " low" : "")} style={{ width: `${pct}%` }} />
      </div>
      {left <= -1500 || onSyncing ? <span className="syncing">syncing…</span> : <span className="secs">{secs}</span>}
    </div>
  );
}

// ---------- charts ----------

export const LINE_COLORS = ["#f5b942", "#3fb8af", "#e5675a", "#9b8cff", "#7ccf7a", "#ff8fc7", "#5fb0ff", "#d9d26a", "#c08457", "#a3a7b0", "#ff6b3d", "#64e0c8"];

export function Sparkline({ points, color = "#a3a7b0", width = 64, height = 18 }: { points: number[]; color?: string; width?: number; height?: number }) {
  if (points.length < 2) return <svg width={width} height={height} aria-hidden="true" />;
  const max = Math.max(...points, 0.01);
  const min = Math.min(...points);
  const span = Math.max(max - min, 0.05);
  const d = points
    .map((p, i) => `${i === 0 ? "M" : "L"}${((i / (points.length - 1)) * width).toFixed(1)},${(height - 2 - ((p - min) / span) * (height - 4)).toFixed(1)}`)
    .join(" ");
  return (
    <svg width={width} height={height} aria-hidden="true">
      <path d={d} fill="none" stroke={color} strokeWidth="1.6" strokeLinejoin="round" />
    </svg>
  );
}

export function ReplayChart({
  history,
  letters,
  winner,
  durationMs,
  tellAtMs,
}: {
  history: { t: number; p: number[] }[];
  letters: string[];
  winner?: string | null;
  durationMs: number;
  tellAtMs?: number;
}) {
  const W = 320;
  const H = 160;
  const pad = { l: 28, r: 8, t: 8, b: 18 };
  const n = Math.min(letters.length, MAX_CHART_LINES);
  const pts = history.length ? [...history] : [];
  if (pts.length) pts.push({ t: durationMs, p: pts[pts.length - 1].p });
  const x = (t: number) => pad.l + (Math.min(t, durationMs) / durationMs) * (W - pad.l - pad.r);
  const y = (p: number) => pad.t + (1 - p) * (H - pad.t - pad.b);
  const lines = Array.from({ length: n }, (_, i) => {
    let d = "";
    pts.forEach((pt, k) => {
      const yy = y(pt.p[i] ?? 0);
      if (k === 0) d += `M${x(pt.t)},${yy}`;
      else d += ` H${x(pt.t)} V${yy}`;
    });
    return d;
  });
  return (
    <figure style={{ margin: 0 }}>
      <svg className="chart" viewBox={`0 0 ${W} ${H}`} role="img" aria-label="Price replay over the market minute">
        {[0, 0.25, 0.5, 0.75, 1].map((g) => (
          <g key={g}>
            <line x1={pad.l} x2={W - pad.r} y1={y(g)} y2={y(g)} stroke="#2a303b" strokeWidth="1" />
            <text x={2} y={y(g) + 4} fill="#6f7480" fontSize="10" fontFamily="ui-monospace, monospace">{Math.round(g * 100)}%</text>
          </g>
        ))}
        {tellAtMs != null && (
          <g>
            <line x1={x(tellAtMs)} x2={x(tellAtMs)} y1={pad.t} y2={H - pad.b} stroke="#6f7480" strokeDasharray="3 3" />
            <text x={x(tellAtMs) + 3} y={H - 5} fill="#a3a7b0" fontSize="10">tell</text>
          </g>
        )}
        {lines.map((d, i) => (
          <path
            key={i}
            d={d}
            fill="none"
            stroke={LINE_COLORS[i % LINE_COLORS.length]}
            strokeWidth={letters[i] === winner ? 3 : 1.6}
            opacity={winner && letters[i] !== winner ? 0.55 : 1}
          />
        ))}
      </svg>
      <figcaption className="legend">
        {letters.slice(0, n).map((l, i) => (
          <span key={l}>
            <i style={{ background: LINE_COLORS[i % LINE_COLORS.length] }} />
            {l}
            {l === winner ? " ★" : ""}
          </span>
        ))}
      </figcaption>
    </figure>
  );
}

// ---------- small bits ----------

export function Toasts({ toasts, dismiss }: { toasts: Toast[]; dismiss: (id: number) => void }) {
  return (
    <div className="toasts" aria-live="polite">
      {toasts.map((t) => (
        <div key={t.id} className={"toast " + t.kind} onClick={() => dismiss(t.id)} role={t.kind === "error" ? "alert" : "status"}>
          {t.text}
        </div>
      ))}
    </div>
  );
}

const AV_COLORS = ["#f5b942", "#3fb8af", "#e5675a", "#9b8cff", "#7ccf7a", "#ff8fc7", "#5fb0ff", "#d9d26a", "#c08457", "#64e0c8"];
export function Avatar({ nick, id }: { nick: string; id: string }) {
  let h = 0;
  for (const ch of id) h = (h * 31 + ch.charCodeAt(0)) >>> 0;
  return (
    <span className="avatar" style={{ background: AV_COLORS[h % AV_COLORS.length] }} aria-hidden="true">
      {nick.slice(0, 1).toUpperCase()}
    </span>
  );
}

export function Signed({ n }: { n: number }) {
  const v = Math.round(n);
  return <span className={v > 0 ? "pos" : v < 0 ? "neg" : "zero"}>{v > 0 ? `+${v}` : v < 0 ? `−${Math.abs(v)}` : "0"}</span>;
}

export function Confetti() {
  const [pieces] = useState(() =>
    Array.from({ length: 70 }, (_, i) => ({
      left: Math.random() * 100,
      delay: Math.random() * 0.8,
      dur: 2.2 + Math.random() * 1.8,
      color: LINE_COLORS[i % 6],
      rot: Math.random() * 360,
    })),
  );
  const [on, setOn] = useState(true);
  useEffect(() => {
    const t = setTimeout(() => setOn(false), 4500);
    return () => clearTimeout(t);
  }, []);
  if (!on) return null;
  return (
    <div className="confetti" aria-hidden="true">
      {pieces.map((p, i) => (
        <i
          key={i}
          style={{ left: `${p.left}%`, background: p.color, animationDelay: `${p.delay}s`, animationDuration: `${p.dur}s`, transform: `rotate(${p.rot}deg)` }}
        />
      ))}
    </div>
  );
}
