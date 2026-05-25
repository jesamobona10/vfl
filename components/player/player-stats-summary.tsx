"use client";

interface PlayerStatsSummaryProps {
  player: {
    goals: number;
    assists: number;
    ownGoals: number;
    yellowCards: number;
    redCards: number;
    saves: number;
    penaltySaves: number;
    cleanSheets: number;
    goalsConceded: number;
    tackles: number;
    interceptions: number;
    blocks: number;
    aerialDuelsWon: number;
    rating: number;
    motm: number;
    matchWins: number;
    bonus5Saves: number;
    errorsLeadingToGoal: number;
    penaltiesConceded: number;
  };
}

interface StatGroup {
  label: string;
  items: { label: string; value: number | string }[];
}

export function PlayerStatsSummary({ player }: PlayerStatsSummaryProps) {
  const groups: StatGroup[] = [
    {
      label: "Attacking",
      items: [
        { label: "Goals", value: player.goals },
        { label: "Assists", value: player.assists },
        { label: "Own Goals", value: player.ownGoals },
      ],
    },
    {
      label: "Discipline",
      items: [
        { label: "Yellow Cards", value: player.yellowCards },
        { label: "Red Cards", value: player.redCards },
      ],
    },
    {
      label: "Goalkeeping",
      items: [
        { label: "Saves", value: player.saves },
        { label: "Penalty Saves", value: player.penaltySaves },
        { label: "Clean Sheets", value: player.cleanSheets },
        { label: "Goals Conceded", value: player.goalsConceded },
      ],
    },
    {
      label: "Defensive",
      items: [
        { label: "Tackles", value: player.tackles },
        { label: "Interceptions", value: player.interceptions },
        { label: "Blocks", value: player.blocks },
        { label: "Aerial Duels", value: player.aerialDuelsWon },
      ],
    },
    {
      label: "Performance",
      items: [
        { label: "Avg Rating", value: player.rating.toFixed(1) },
        { label: "MOTM", value: player.motm },
        { label: "Match Wins", value: player.matchWins },
        { label: "Bonus 5 Saves", value: player.bonus5Saves },
      ],
    },
    {
      label: "Miscellaneous",
      items: [
        { label: "Errors Leading to Goal", value: player.errorsLeadingToGoal },
        { label: "Penalties Conceded", value: player.penaltiesConceded },
      ],
    },
  ];

  return (
    <div className="card p-5">
      <h3 className="text-sm font-semibold text-muted uppercase tracking-wider mb-5">
        Season Statistics
      </h3>
      <div className="space-y-5">
        {groups.map((group) => (
          <div key={group.label}>
            <p className="text-[10px] font-semibold uppercase tracking-wider text-muted mb-2">
              {group.label}
            </p>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
              {group.items.map((item) => (
                <div
                  key={item.label}
                  className="bg-surface-2 rounded-lg px-3 py-2.5 flex flex-col"
                >
                  <span className="text-lg font-bold text-text">{item.value}</span>
                  <span className="text-[11px] text-muted leading-tight">{item.label}</span>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
