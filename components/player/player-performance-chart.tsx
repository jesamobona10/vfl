"use client";

interface Match {
  id: number;
  round: number;
  status: string;
}

interface PlayerPerformanceChartProps {
  teamFixtures: Match[];
  matchRatings: Record<string, number>;
}

export function PlayerPerformanceChart({ teamFixtures, matchRatings }: PlayerPerformanceChartProps) {
  const completed = teamFixtures
    .filter((m) => m.status === "completed" && matchRatings[m.id] != null)
    .sort((a, b) => a.round - b.round);

  if (completed.length < 2) {
    return (
      <div className="card p-6 text-center text-muted">
        <p className="text-sm">Not enough data for a chart yet.</p>
      </div>
    );
  }

  const ratings = completed.map((m) => matchRatings[m.id]);
  const max = Math.max(...ratings, 10);
  const min = Math.min(...ratings, 0);
  const range = max - min || 1;
  const w = 280;
  const h = 120;
  const pad = { t: 10, r: 10, b: 25, l: 30 };
  const plotW = w - pad.l - pad.r;
  const plotH = h - pad.t - pad.b;

  const points = completed.map((m, i) => {
    const x = pad.l + (i / (completed.length - 1)) * plotW;
    const y = pad.t + plotH - ((matchRatings[m.id] - min) / range) * plotH;
    return { x, y, round: m.round, rating: matchRatings[m.id] };
  });

  const linePath = points.map((p, i) => `${i === 0 ? "M" : "L"}${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(" ");

  const yTicks = [0, 2, 4, 6, 8, 10].filter((v) => v >= min - 0.5 && v <= max + 0.5);

  return (
    <div className="card p-5">
      <h3 className="text-sm font-semibold text-muted uppercase tracking-wider mb-4">
        Rating Trend
      </h3>
      <svg viewBox={`0 0 ${w} ${h}`} className="w-full max-w-sm mx-auto" style={{ height: h }}>
        {yTicks.map((tick) => {
          const y = pad.t + plotH - ((tick - min) / range) * plotH;
          return (
            <g key={tick}>
              <line x1={pad.l} y1={y} x2={w - pad.r} y2={y} stroke="currentColor" className="text-line" strokeWidth="0.5" />
              <text x={pad.l - 4} y={y + 3} textAnchor="end" className="text-[8px] fill-muted">{tick}</text>
            </g>
          );
        })}

        <path d={linePath} fill="none" className="stroke-brand" strokeWidth="2" strokeLinejoin="round" />

        {points.map((p, i) => (
          <g key={i}>
            <circle cx={p.x} cy={p.y} r="3" className="fill-brand" stroke="white" strokeWidth="1.5" />
            <text x={p.x} y={h - 5} textAnchor="middle" className="text-[7px] fill-muted">
              R{p.round}
            </text>
          </g>
        ))}
      </svg>
    </div>
  );
}
