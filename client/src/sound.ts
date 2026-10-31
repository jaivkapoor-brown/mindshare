import { useState } from "react";
import { store } from "./net";

// Tiny synthesized sounds: no audio files to download.
let ctx: AudioContext | null = null;
function ac() {
  if (!ctx) {
    const C = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!C) return null;
    ctx = new C();
  }
  if (ctx.state === "suspended") void ctx.resume();
  return ctx;
}

function tone(freq: number, dur: number, type: OscillatorType = "sine", gain = 0.08, at = 0, slideTo?: number) {
  const a = ac();
  if (!a) return;
  const t0 = a.currentTime + at;
  const o = a.createOscillator();
  const g = a.createGain();
  o.type = type;
  o.frequency.setValueAtTime(freq, t0);
  if (slideTo) o.frequency.exponentialRampToValueAtTime(slideTo, t0 + dur);
  g.gain.setValueAtTime(0.0001, t0);
  g.gain.exponentialRampToValueAtTime(gain, t0 + 0.01);
  g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
  o.connect(g).connect(a.destination);
  o.start(t0);
  o.stop(t0 + dur + 0.02);
}

export const sound = {
  tick: () => tone(1400, 0.05, "triangle", 0.05),
  bell: () => {
    tone(880, 1.2, "sine", 0.1);
    tone(1320, 0.9, "sine", 0.04);
  },
  cheer: () => [523, 659, 784, 1047].forEach((f, i) => tone(f, 0.25, "triangle", 0.07, i * 0.09)),
  groan: () => tone(220, 0.7, "sawtooth", 0.04, 0, 110),
};

const isMobile = () => /Android|iPhone|iPad|iPod|Mobile/i.test(navigator.userAgent);

export function useSoundPref(): [boolean, (v: boolean) => void] {
  const [on, setOn] = useState(() => {
    const v = store.get("ms:sound");
    return v == null ? !isMobile() && false : v === "1";
  });
  return [
    on,
    (v: boolean) => {
      store.set("ms:sound", v ? "1" : "0");
      setOn(v);
    },
  ];
}
