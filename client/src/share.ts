import type { PublicState } from "@mindshare/shared";

// 1080x1080 spoiler-free share card: scores and emoji only, never answer text.
export function drawShareCard(state: PublicState, meId: string | null): HTMLCanvasElement {
  const c = document.createElement("canvas");
  c.width = 1080;
  c.height = 1080;
  const g = c.getContext("2d")!;
  g.fillStyle = "#0f1115";
  g.fillRect(0, 0, 1080, 1080);
  g.fillStyle = "#f5b942";
  g.beginPath();
  g.ellipse(540, 250, 120, 110, 0, 0, Math.PI * 2);
  g.fill();
  g.fillStyle = "#1a1407";
  g.beginPath();
  g.arc(500, 235, 12, 0, Math.PI * 2);
  g.arc(580, 235, 12, 0, Math.PI * 2);
  g.fill();
  g.strokeStyle = "#1a1407";
  g.lineWidth = 9;
  g.lineCap = "round";
  g.beginPath();
  g.moveTo(495, 290);
  g.quadraticCurveTo(540, 325, 590, 280);
  g.stroke();

  g.textAlign = "center";
  g.fillStyle = "#f1ede4";
  g.font = "800 84px -apple-system, Segoe UI, Roboto, sans-serif";
  g.fillText("Mindshare", 540, 470);
  const me = state.standings.find((s) => s.seatId === meId);
  const rank = me ? state.standings.indexOf(me) + 1 : null;
  g.font = "600 44px -apple-system, Segoe UI, Roboto, sans-serif";
  g.fillStyle = "#a3a7b0";
  g.fillText(`${state.totalRounds} rounds · ${state.standings.length} players`, 540, 545);

  if (me) {
    g.font = "800 150px ui-monospace, Menlo, monospace";
    g.fillStyle = me.score >= 0 ? "#f5b942" : "#3fb8af";
    g.fillText(`${me.score >= 0 ? "+" : ""}${me.score}`, 540, 730);
    const emoji = me.rounds.map((r) => (r > 25 ? "🏆" : r > 0 ? "📈" : r < 0 ? "📉" : "➖")).join(" ");
    g.font = "90px Apple Color Emoji, Segoe UI Emoji, Noto Color Emoji, sans-serif";
    g.fillText(emoji, 540, 860);
    g.font = "600 46px -apple-system, Segoe UI, Roboto, sans-serif";
    g.fillStyle = "#f1ede4";
    g.fillText(rank === 1 ? "1st place 🥇" : `${rank}${ord(rank!)} place`, 540, 960);
  }
  g.font = "500 30px ui-monospace, Menlo, monospace";
  g.fillStyle = "#6f7480";
  g.fillText(location.host, 540, 1040);
  return c;
}

function ord(n: number) {
  return n % 10 === 1 && n % 100 !== 11 ? "st" : n % 10 === 2 && n % 100 !== 12 ? "nd" : n % 10 === 3 && n % 100 !== 13 ? "rd" : "th";
}

export async function shareCard(state: PublicState, meId: string | null) {
  const c = drawShareCard(state, meId);
  const blob: Blob | null = await new Promise((res) => c.toBlob(res, "image/png"));
  if (!blob) return;
  const file = new File([blob], "mindshare.png", { type: "image/png" });
  const nav = navigator as Navigator & { canShare?: (d: unknown) => boolean };
  try {
    if (nav.canShare?.({ files: [file] })) {
      await navigator.share({ files: [file], title: "Mindshare" });
      return;
    }
  } catch {
    /* fall through to download */
  }
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = "mindshare.png";
  a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 2000);
}
