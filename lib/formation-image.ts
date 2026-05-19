"use client";

interface FormationPlayer {
  name: string;
  number: number;
  rating: number;
  roundScore: number;
  teamName: string;
  position: string;
}

interface FormationSlot {
  label: string;
  x: number;
  y: number;
}

function getFormationSlots(
  formation: string,
  w: number,
  h: number
): FormationSlot[] {
  switch (formation) {
    case "4-4-2":
      return [
        { label: "GK", x: w * 0.5, y: h * 0.88 },
        { label: "DEF", x: w * 0.15, y: h * 0.68 },
        { label: "DEF", x: w * 0.38, y: h * 0.68 },
        { label: "DEF", x: w * 0.62, y: h * 0.68 },
        { label: "DEF", x: w * 0.85, y: h * 0.68 },
        { label: "MID", x: w * 0.16, y: h * 0.45 },
        { label: "MID", x: w * 0.38, y: h * 0.45 },
        { label: "MID", x: w * 0.62, y: h * 0.45 },
        { label: "MID", x: w * 0.84, y: h * 0.45 },
        { label: "ATT", x: w * 0.35, y: h * 0.22 },
        { label: "ATT", x: w * 0.65, y: h * 0.22 },
      ];
    case "3-5-2":
      return [
        { label: "GK", x: w * 0.5, y: h * 0.88 },
        { label: "DEF", x: w * 0.18, y: h * 0.68 },
        { label: "DEF", x: w * 0.5, y: h * 0.68 },
        { label: "DEF", x: w * 0.82, y: h * 0.68 },
        { label: "MID", x: w * 0.1, y: h * 0.45 },
        { label: "MID", x: w * 0.3, y: h * 0.45 },
        { label: "MID", x: w * 0.5, y: h * 0.45 },
        { label: "MID", x: w * 0.7, y: h * 0.45 },
        { label: "MID", x: w * 0.9, y: h * 0.45 },
        { label: "ATT", x: w * 0.35, y: h * 0.22 },
        { label: "ATT", x: w * 0.65, y: h * 0.22 },
      ];
    default:
      return [
        { label: "GK", x: w * 0.5, y: h * 0.88 },
        { label: "DEF", x: w * 0.15, y: h * 0.68 },
        { label: "DEF", x: w * 0.38, y: h * 0.68 },
        { label: "DEF", x: w * 0.62, y: h * 0.68 },
        { label: "DEF", x: w * 0.85, y: h * 0.68 },
        { label: "MID", x: w * 0.25, y: h * 0.45 },
        { label: "MID", x: w * 0.5, y: h * 0.45 },
        { label: "MID", x: w * 0.75, y: h * 0.45 },
        { label: "ATT", x: w * 0.2, y: h * 0.22 },
        { label: "ATT", x: w * 0.5, y: h * 0.22 },
        { label: "ATT", x: w * 0.8, y: h * 0.22 },
      ];
  }
}

function drawPitch(ctx: CanvasRenderingContext2D, w: number, h: number) {
  ctx.fillStyle = "#2d7d3a";
  ctx.fillRect(0, 0, w, h);
  ctx.strokeStyle = "#fff";
  ctx.lineWidth = 2;
  ctx.strokeRect(4, 4, w - 8, h - 8);

  const cx = w / 2;
  const cy = h / 2;
  ctx.beginPath();
  ctx.arc(cx, cy, 60, 0, Math.PI * 2);
  ctx.stroke();
  ctx.beginPath();
  ctx.moveTo(cx, 4);
  ctx.lineTo(cx, h - 4);
  ctx.stroke();
  ctx.beginPath();
  ctx.arc(cx, cy, 6, 0, Math.PI * 2);
  ctx.fillStyle = "#fff";
  ctx.fill();

  const paW = w * 0.5;
  const paH = h * 0.18;
  ctx.strokeRect(cx - paW / 2, 4, paW, paH);
  ctx.strokeRect(cx - paW / 2, h - 4 - paH, paW, paH);
  const gaW = w * 0.22;
  const gaH = h * 0.07;
  ctx.strokeRect(cx - gaW / 2, 4, gaW, gaH);
  ctx.strokeRect(cx - gaW / 2, h - 4 - gaH, gaW, gaH);
}

function drawPlayer(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  player: FormationPlayer | null,
  index: number,
  label: string
) {
  const r = 28;
  ctx.beginPath();
  ctx.arc(x, y, r, 0, Math.PI * 2);
  if (player) {
    ctx.fillStyle = index === 0 ? "#fbbf24" : "#fff";
    ctx.fill();
    ctx.strokeStyle = "#1e3a5f";
    ctx.lineWidth = 2;
    ctx.stroke();
    ctx.fillStyle = "#1e3a5f";
    ctx.font = "bold 12px sans-serif";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(String(player.number), x, y - 4);
    ctx.font = "10px sans-serif";
    ctx.fillText(
      player.name.length > 10 ? player.name.slice(0, 10) + ".." : player.name,
      x,
      y + 16
    );

    ctx.font = "9px sans-serif";
    ctx.fillStyle = "#555";
    ctx.textAlign = "center";
    ctx.textBaseline = "top";
    const displayTeam =
      player.teamName.length > 12 ? player.teamName.slice(0, 12) + ".." : player.teamName;
    ctx.fillText(`${displayTeam} (${player.roundScore.toFixed(1)}pts)`, x, y + r + 6);
  } else {
    ctx.fillStyle = "rgba(255,255,255,0.3)";
    ctx.fill();
    ctx.fillStyle = "rgba(255,255,255,0.6)";
    ctx.font = "11px sans-serif";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(label, x, y);
  }
}

export function downloadFormationImage(
  bestGK: FormationPlayer | null,
  bestDEF: FormationPlayer[],
  bestMID: FormationPlayer[],
  bestATT: FormationPlayer[],
  roundNum: string,
  formation: string
) {
  const w = 700;
  const h = 900;
  const canvas = document.createElement("canvas");
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext("2d")!;

  drawPitch(ctx, w, h);

  const slots = getFormationSlots(formation, w, h);
  const players = [bestGK, ...bestDEF, ...bestMID, ...bestATT];

  for (let i = 0; i < slots.length; i++) {
    const slot = slots[i];
    const player = players[i] || null;
    drawPlayer(ctx, slot.x, slot.y, player, i, slot.label);
  }

  ctx.fillStyle = "#fff";
  ctx.font = "bold 22px sans-serif";
  ctx.textAlign = "center";
  ctx.textBaseline = "top";
  ctx.fillText(`Team of Round ${roundNum} - ${formation}`, w / 2, 12);

  canvas.toBlob((blob) => {
    if (!blob) return;
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `team-of-round-${roundNum}-${formation}.png`;
    a.click();
    URL.revokeObjectURL(url);
  }, "image/png");
}
