import { describe, expect, it } from "vitest";
import {
  buildConfetti,
  confettiAt,
  createCelebrationRenderer,
  easeOutBack,
  easeOutCubic,
  mulberry32,
  type CelebrationConfig,
} from "@/lib/celebration/animation";
import { resolveLeagueChampion } from "@/lib/celebration/winner";

const config: CelebrationConfig = {
  width: 720,
  height: 900,
  durationMs: 4000,
  seed: 42,
  champion: resolveLeagueChampion({
    competitionName: "League",
    standings: [
      {
        id: 1,
        name: "Alpha FC",
        rating: 1500,
        played: 6,
        won: 4,
        drawn: 2,
        lost: 0,
        gf: 12,
        ga: 4,
        gd: 8,
        points: 14,
        form: "WWDWW",
      },
    ],
    fixturesCompleted: 6,
    fixturesTotal: 6,
  })!,
  theme: {
    accent: "#0f7c45",
    accentAlt: "#f5d26c",
    backgroundFrom: "#0b1020",
    backgroundTo: "#162036",
    text: "#ffffff",
    textMuted: "rgba(255,255,255,0.72)",
    centerAccent: "#f5d26c",
  },
};

describe("mulberry32", () => {
  it("is deterministic for a given seed", () => {
    const a = mulberry32(123);
    const b = mulberry32(123);
    expect([a(), a(), a()]).toEqual([b(), b(), b()]);
  });

  it("produces values in [0, 1)", () => {
    const rnd = mulberry32(7);
    for (let i = 0; i < 100; i++) {
      const v = rnd();
      expect(v).toBeGreaterThanOrEqual(0);
      expect(v).toBeLessThan(1);
    }
  });
});

describe("buildConfetti", () => {
  it("is deterministic for a given seed", () => {
    const a = buildConfetti(config, 10);
    const b = buildConfetti(config, 10);
    expect(a.map((p) => p.x0)).toEqual(b.map((p) => p.x0));
    expect(a.map((p) => p.color)).toEqual(b.map((p) => p.color));
  });

  it("stays within the canvas width", () => {
    const particles = buildConfetti(config, 50);
    for (const p of particles) {
      expect(p.x0).toBeGreaterThanOrEqual(0);
      expect(p.x0).toBeLessThanOrEqual(config.width);
    }
  });
});

describe("confettiAt", () => {
  it("reports finite, in-range coordinates while a particle is on screen", () => {
    const [particle] = buildConfetti(config, 1);
    const early = confettiAt(particle, 500, config.width, config.height);
    expect(early.visible).toBe(true);
    expect(Number.isFinite(early.x)).toBe(true);
    expect(Number.isFinite(early.y)).toBe(true);
  });

  it("hides a particle once it falls past the bottom", () => {
    const [particle] = buildConfetti(config, 1);
    const below = {
      ...particle,
      x0: 100,
      y0: config.height + 500,
      vx: 0,
      vy: 0,
      g: 0,
      swayAmp: 0,
      cycle: 100000,
      t0: 0,
    };
    expect(confettiAt(below, 100, config.width, config.height).visible).toBe(false);
  });
});

describe("easing", () => {
  it("clamps and anchors at the endpoints", () => {
    expect(easeOutCubic(0)).toBe(0);
    expect(easeOutCubic(1)).toBe(1);
    expect(easeOutBack(0)).toBeCloseTo(0, 5);
    expect(easeOutBack(1)).toBeCloseTo(1, 5);
  });
});

describe("createCelebrationRenderer", () => {
  function stubCtx() {
    const stops: string[] = [];
    const fills: unknown[] = [];
    const gradient = {
      addColorStop: (_offset: number, color: string) => {
        stops.push(color);
      },
    };
    const ctx: Record<string, unknown> = {
      createLinearGradient: () => gradient,
      createRadialGradient: () => gradient,
      fillRect: () => {},
      save: () => {},
      restore: () => {},
      translate: () => {},
      rotate: () => {},
      scale: () => {},
      beginPath: () => {},
      arc: () => {},
      fill: () => {},
      moveTo: () => {},
      lineTo: () => {},
      closePath: () => {},
      quadraticCurveTo: () => {},
      stroke: () => {},
      fillText: () => {},
    };
    Object.defineProperty(ctx, "fillStyle", {
      set: (v) => fills.push(v),
      get: () => "",
    });
    Object.defineProperty(ctx, "strokeStyle", {
      set: () => {},
      get: () => "",
    });
    return { ctx, stops, fills };
  }

  it("only emits valid CSS colors to the canvas", () => {
    // Regression: bare "r,g,b" channel strings (no rgb() wrapper) made
    // addColorStop/fillStyle throw and blanked the whole animation.
    const { ctx, stops, fills } = stubCtx();
    const render = createCelebrationRenderer(config);
    render(ctx as unknown as CanvasRenderingContext2D, 2500);

    const bareChannels = /^\s*\d+(\.\d+)?\s*,\s*\d+(\.\d+)?\s*,\s*\d+(\.\d+)?\s*$/;
    const colorStrings = [...stops, ...fills].filter((c): c is string => typeof c === "string");
    expect(colorStrings.length).toBeGreaterThan(0);
    for (const color of colorStrings) {
      expect(bareChannels.test(color)).toBe(false);
      expect(color).toMatch(/^(rgb|rgba|#|hsl)/);
    }
  });
});
