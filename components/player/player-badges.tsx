"use client";

interface PlayerBadgesProps {
  goals: number;
  assists: number;
  motm: number;
  cleanSheets: number;
  saves: number;
}

interface Badge {
  id: string;
  label: string;
  icon: string;
  earned: boolean;
  progress?: string;
}

export function PlayerBadges({ goals, assists, motm, cleanSheets, saves }: PlayerBadgesProps) {
  const badges: Badge[] = [
    { id: "first-goal", label: "First Goal", icon: "⚽", earned: goals >= 1 },
    { id: "five-goals", label: "Goal Scorer", icon: "⚽", earned: goals >= 5, progress: `${goals}/5` },
    { id: "ten-goals", label: "Sharp Shooter", icon: "🎯", earned: goals >= 10, progress: `${goals}/10` },
    { id: "first-assist", label: "Playmaker", icon: "👟", earned: assists >= 1 },
    { id: "five-assists", label: "Creator", icon: "🎨", earned: assists >= 5, progress: `${assists}/5` },
    { id: "motm-first", label: "Star Player", icon: "⭐", earned: motm >= 1 },
    { id: "motm-five", label: "Superstar", icon: "🌟", earned: motm >= 5, progress: `${motm}/5` },
    { id: "clean-sheet", label: "Wall", icon: "🧱", earned: cleanSheets >= 1 },
    { id: "five-saves", label: "Safe Hands", icon: "🧤", earned: saves >= 5, progress: `${saves}/5` },
  ];

  const earned = badges.filter((b) => b.earned);
  const locked = badges.filter((b) => !b.earned);

  if (earned.length === 0) {
    return (
      <div className="card p-6 text-center text-muted">
        <p className="text-sm">No badges earned yet. Start playing to earn achievements!</p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <h3 className="text-sm font-semibold text-muted uppercase tracking-wider">
        Achievements ({earned.length}/{badges.length})
      </h3>
      <div className="flex flex-wrap gap-2">
        {earned.map((b) => (
          <div
            key={b.id}
            className="flex items-center gap-1.5 bg-brand/10 text-brand text-xs font-medium px-3 py-1.5 rounded-full"
            title={b.label}
          >
            <span>{b.icon}</span>
            <span>{b.label}</span>
          </div>
        ))}
        {locked.slice(0, 3).map((b) => (
          <div
            key={b.id}
            className="flex items-center gap-1.5 bg-surface-2 text-muted text-xs px-3 py-1.5 rounded-full"
            title={b.label}
          >
            <span className="opacity-40">{b.icon}</span>
            <span>{b.progress}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
