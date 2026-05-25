"use client";

interface Match {
  id: number;
  round: number;
  homeId: number;
  awayId: number;
  homeScore: number | null;
  awayScore: number | null;
  status: string;
}

interface PlayerFormGuideProps {
  teamFixtures: Match[];
  teamId: number;
  matchRatings: Record<string, number>;
}

export function PlayerFormGuide({ teamFixtures, teamId, matchRatings }: PlayerFormGuideProps) {
  const completed = teamFixtures
    .filter((m) => m.status === "completed")
    .sort((a, b) => b.round - a.round)
    .slice(0, 5);

  if (completed.length === 0) {
    return (
      <div className="card p-6 text-center text-muted">
        <p className="text-sm">No recent matches.</p>
      </div>
    );
  }

  return (
    <div className="card p-5">
      <h3 className="text-sm font-semibold text-muted uppercase tracking-wider mb-4">
        Form Guide
      </h3>

      <div className="flex items-center gap-3 justify-center">
        {completed.map((m) => {
          const isHome = m.homeId === teamId;
          const won = isHome
            ? (m.homeScore ?? 0) > (m.awayScore ?? 0)
            : (m.awayScore ?? 0) > (m.homeScore ?? 0);
          const rating = matchRatings[m.id] ?? null;

          return (
            <div key={m.id} className="flex flex-col items-center gap-1.5">
              <div
                className={`w-10 h-10 rounded-full flex items-center justify-center text-sm font-bold text-white ${
                  won ? "bg-brand" : "bg-danger"
                }`}
              >
                {won ? "W" : "L"}
              </div>
              {rating != null && (
                <div
                  className={`w-2 h-2 rounded-full ${
                    rating >= 7 ? "bg-brand" : rating >= 5 ? "bg-accent" : "bg-danger"
                  }`}
                  title={`Rating: ${rating.toFixed(1)}`}
                />
              )}
              <span className="text-[10px] text-muted">R{m.round}</span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
