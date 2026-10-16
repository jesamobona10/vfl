/**
 * Canvas-based celebration renderer.
 * Renders a deterministic confetti animation with a winner reveal.
 * Pure functions for math; renderer returns a function (ctx, tMs) => void.
 */
export interface Champion {
  teamId: number | null;
  name: string;
  competitionName: string;
  seasonName?: string;
  subtitle: string;
  detail: string;
  logoUrl?: string | null;
}

export interface CelebrationTheme {
  accent: string; // brand hex
  accentAlt?: string;
  backgroundFrom: string;
  backgroundTo: string;
  text: string;
  textMuted: string;
  centerAccent: string;
}

export interface CelebrationConfig {
  width: number;
  height: number;
  durationMs: number;
  champion: Champion;
  theme: CelebrationTheme;
  seed?: number;
}

/** Default portrait canvas size for posters and video exports. */
export const DEFAULT_CELEBRATION_SIZE = { width: 720, height: 900 } as const;

export interface ConfettiParticle {
  x0: number;
  y0: number;
  size: number;
  vx: number;
  vy: number;
  g: number;
  rot0: number;
  vrot: number;
  swayAmp: number;
  swayFreq: number;
  phase: number;
  color: string;
  shape: "rect" | "circle" | "ribbon";
  cycle: number;
  t0: number;
  fallStart: number;
  colorAlt?: string;
}



// mulberry32 PRNG
export function mulberry32(seed: number): () => number {
  let t = seed >>> 0;
  return () => {
    t += 0x6d2b79f5;
    let r = Math.imul(t ^ (t >>> 15), 1 | t);
    r ^= r + Math.imul(r ^ (r >>> 7), 61 | r);
    return ((r ^ (r >>> 14)) >>> 0) / 4294967296;
  };
}

function clamp(n: number, min: number, max: number): number {
  if (n < min) return min;
  if (n > max) return max;
  return n;
}

export function easeOutCubic(t: number): number {
  const x = clamp(t, 0, 1);
  return 1 - Math.pow(1 - x, 3);
}

export function easeOutBack(t: number): number {
  const x = clamp(t, 0, 1);
  const c1 = 1.70158;
  const c3 = c1 + 1;
  return 1 + c3 * Math.pow(x - 1, 3) + c1 * Math.pow(x - 1, 2);
}

function mod(n: number, m: number): number {
  return ((n % m) + m) % m;
}

export function buildConfetti(
  config: CelebrationConfig,
  count: number = 120,
): ConfettiParticle[] {
  const { width, height, seed } = config;
  const rnd = mulberry32(seed ?? (Date.now() >>> 0));
  const particles: ConfettiParticle[] = [];

  const palette = [
    config.theme.accent,
    config.theme.accentAlt ?? "#f5d26c",
    "#ffffff",
    "#8fb7ff",
    "#ffb3c1",
    "#d9f2e6",
  ];

  for (let i = 0; i < count; i++) {
    const size = 6 + rnd() * 10;
    const cycle = 2000 + rnd() * 1600;
    const y0 = -30 - rnd() * height * 0.4;
    const x0 = rnd() * width;
    const g = 0.00008 + rnd() * 0.00006;
    const vy = Math.max(0.05, (height + 80 - y0) / cycle - 0.5 * g * cycle);
    const vx = (rnd() - 0.5) * 0.06;
    const rot0 = rnd() * Math.PI * 2;
    const vrot = (rnd() - 0.5) * 0.02;
    const swayAmp = 6 + rnd() * 16;
    const swayFreq = 0.004 + rnd() * 0.006;
    const phase = rnd() * Math.PI * 2;
    const colorIdx = Math.floor(rnd() * palette.length);
    const color = palette[colorIdx];
    const shape = rnd() < 0.5 ? "rect" : rnd() < 0.5 ? "circle" : "ribbon";
    const t0 = (i / count) * cycle;
    const fallStart = 0;

    particles.push({
      x0,
      y0,
      size,
      vx,
      vy,
      g,
      rot0,
      vrot,
      swayAmp,
      swayFreq,
      phase,
      color,
      shape,
      cycle,
      t0,
      fallStart,
      colorAlt: shape === "ribbon" ? (palette[Math.floor(rnd()*palette.length)] || color) : undefined,
    });
  }

  return particles;
}

export function confettiAt(p: ConfettiParticle, tMs: number, width: number, height: number): {
  visible: boolean;
  x: number;
  y: number;
  rot: number;
} {
  const localAge = mod(tMs - p.t0, p.cycle);
  if (localAge < 0) return { visible: false, x: p.x0, y: p.y0, rot: p.rot0 };
  const x = p.x0 + p.vx * localAge + p.swayAmp * Math.sin(localAge * p.swayFreq + p.phase);
  const y = p.y0 + p.vy * localAge + 0.5 * p.g * localAge * localAge;
  if (y > height + p.size * 2) return { visible: false, x, y, rot: 0 };
  const rot = p.rot0 + p.vrot * localAge;
  return { visible: true, x, y, rot };
}

export function createCelebrationRenderer(config: CelebrationConfig) {
  const { width, height, champion, theme } = config;
  const particles = buildConfetti(config, 110);
  const centerRgb = hexToRgb(theme.centerAccent);

  return (ctx: CanvasRenderingContext2D, tMs: number) => {
    // background
    const bg = ctx.createLinearGradient(0, 0, 0, height);
    bg.addColorStop(0, theme.backgroundFrom);
    bg.addColorStop(1, theme.backgroundTo);
    ctx.fillStyle = bg;
    ctx.fillRect(0, 0, width, height);

    // soft radial glow behind center
    const cx = width / 2;
    const cy = height / 2 - 40;
    const introScale = easeOutBack(clamp((tMs - 120) / 600, 0, 1));
    const fadeIn = easeOutCubic(clamp((tMs - 200) / 700, 0, 1));

    if (fadeIn > 0.1) {
      const g = ctx.createRadialGradient(cx, cy, 0, cx, cy, 280);
      g.addColorStop(0, rgbaColor(centerRgb, 0.12 * fadeIn));
      g.addColorStop(1, "rgba(0,0,0,0)");
      ctx.fillStyle = g;
      ctx.fillRect(0, 0, width, height);
    }

    // confetti
    for (let i = 0; i < particles.length; i++) {
      const p = particles[i];
      const c = confettiAt(p, tMs, width, height);
      if (!c.visible) continue;
      ctx.save();
      ctx.translate(c.x, c.y);
      ctx.rotate(c.rot);
      ctx.globalAlpha = fadeIn * 0.9;
      if (p.shape === "circle") {
        ctx.fillStyle = p.color;
        ctx.beginPath();
        ctx.arc(0, 0, p.size / 2, 0, Math.PI * 2);
        ctx.fill();
      } else if (p.shape === "ribbon") {
        ctx.fillStyle = p.colorAlt || p.color;
        ctx.fillRect(-p.size / 2, -p.size / 6, p.size, p.size / 3);
      } else {
        ctx.fillStyle = p.color;
        ctx.fillRect(-p.size / 2, -p.size / 2, p.size, p.size);
      }
      ctx.restore();
    }

    // center medallion
    ctx.save();
    ctx.globalAlpha = fadeIn;
    ctx.translate(cx, cy);
    ctx.scale(introScale, introScale);
    // outer ring
    const ringGrad = ctx.createLinearGradient(0, -120, 0, 120);
    ringGrad.addColorStop(0, rgbColor(centerRgb, 1.15));
    ringGrad.addColorStop(1, theme.centerAccent);
    ctx.fillStyle = ringGrad;
    ctx.beginPath();
    ctx.arc(0, 0, 96, 0, Math.PI * 2);
    ctx.fill();
    // inner
    ctx.fillStyle = "rgba(11,16,32,0.95)";
    ctx.beginPath();
    ctx.arc(0, 0, 72, 0, Math.PI * 2);
    ctx.fill();
    // trophy top
    ctx.strokeStyle = theme.centerAccent;
    ctx.lineWidth = 6;
    ctx.beginPath();
    ctx.moveTo(-26, -26);
    ctx.lineTo(26, -26);
    ctx.lineTo(18, -56);
    ctx.lineTo(-18, -56);
    ctx.closePath();
    ctx.stroke();
    ctx.fillStyle = theme.centerAccent;
    ctx.fill();
    // cup
    ctx.beginPath();
    ctx.moveTo(-38, -20);
    ctx.lineTo(38, -20);
    ctx.quadraticCurveTo(22, 48, 0, 58);
    ctx.quadraticCurveTo(-22, 48, -38, -20);
    ctx.closePath();
    ctx.fillStyle = rgbColor(centerRgb, 0.9);
    ctx.fill();
    // handles
    ctx.strokeStyle = theme.centerAccent;
    ctx.lineWidth = 10;
    ctx.beginPath();
    ctx.arc(-52, 0, 16, -Math.PI/2, Math.PI/2, false);
    ctx.stroke();
    ctx.beginPath();
    ctx.arc(52, 0, 16, Math.PI/2, -Math.PI/2, false);
    ctx.stroke();
    ctx.restore();

    // text
    const reveal = (t: number, delay: number) => easeOutCubic(clamp((t - delay) / 500, 0, 1));
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    let ry = cy + 140;
    // "CHAMPIONS"
    ctx.fillStyle = theme.text;
    ctx.globalAlpha = reveal(tMs, 700);
    ctx.font = "bold 56px system-ui, -apple-system, Segoe UI, Roboto, sans-serif";
    ctx.fillText("CHAMPIONS", cx, ry);
    ry += 56;
    // team
    ctx.globalAlpha = reveal(tMs, 400);
    ctx.font = "800 68px system-ui, -apple-system, Segoe UI, Roboto, sans-serif";
    ctx.fillText(champion.name.toUpperCase(), cx, ry);
    ry += 54;
    // subtitle
    ctx.globalAlpha = reveal(tMs, 800);
    ctx.font = "600 24px system-ui, -apple-system, Segoe UI, Roboto, sans-serif";
    ctx.fillStyle = theme.textMuted;
    ctx.fillText(champion.subtitle.toUpperCase(), cx, ry);
    ry += 28;
    // detail
    ctx.globalAlpha = reveal(tMs, 900);
    ctx.font = "400 18px system-ui, -apple-system, Segoe UI, Roboto, sans-serif";
    ctx.fillText(champion.detail, cx, ry);
  };
}

function hexToRgb(hex: string): [number, number, number] {
  const h = hex.replace("#", "");
  if (h.length === 3) {
    return [
      parseInt(h[0]+h[0], 16),
      parseInt(h[1]+h[1], 16),
      parseInt(h[2]+h[2], 16),
    ];
  }
  return [
    parseInt(h.slice(0,2), 16),
    parseInt(h.slice(2,4), 16),
    parseInt(h.slice(4,6), 16),
  ];
}

/** Format an RGB tuple as a CSS `rgb(r, g, b)` string with integer channels. */
function rgbColor(rgb: [number, number, number], scale = 1): string {
  const r = clamp(Math.round(rgb[0] * scale), 0, 255);
  const g = clamp(Math.round(rgb[1] * scale), 0, 255);
  const b = clamp(Math.round(rgb[2] * scale), 0, 255);
  return `rgb(${r}, ${g}, ${b})`;
}

/** Format an RGB tuple as a CSS `rgba(r, g, b, a)` string with integer channels. */
function rgbaColor(rgb: [number, number, number], alpha: number, scale = 1): string {
  const r = clamp(Math.round(rgb[0] * scale), 0, 255);
  const g = clamp(Math.round(rgb[1] * scale), 0, 255);
  const b = clamp(Math.round(rgb[2] * scale), 0, 255);
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}
