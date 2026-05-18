"use client";

import { useAppStore } from "@/lib/store";
import type { Team } from "@/lib/types";
import { ImageUpload } from "@/components/shared/image-upload";

interface TeamCardProps {
  team: Team;
  index: number;
  isManaged: boolean;
  showAdmin?: boolean;
  onDelete?: (id: number) => void;
}

export function TeamCard({ team, index, isManaged, showAdmin, onDelete }: TeamCardProps) {
  const updateTeam = useAppStore((s) => s.updateTeam);

  const handleNameChange = (value: string) => {
    updateTeam(team.id, { name: value });
  };

  const handleRatingChange = (value: string) => {
    const rating = parseFloat(value);
    if (!Number.isNaN(rating)) {
      updateTeam(team.id, { rating });
    }
  };

  const handleLogoComplete = (url: string) => {
    updateTeam(team.id, { logo: url });
  };

  return (
    <div className="card p-5">
      <p className="text-xs text-muted uppercase tracking-wider font-semibold mb-3">
        {isManaged ? "Your Team" : `Team ${index + 1}`}
      </p>

      <div className="flex flex-col items-center gap-3 mb-4">
        <ImageUpload
          currentUrl={team.logo}
          teamId={team.id}
          teamName={team.name}
          onUploadComplete={handleLogoComplete}
        />
      </div>

      <input
        type="text"
        value={team.name}
        onChange={(e) => handleNameChange(e.target.value)}
        maxLength={40}
        className="input text-center"
        placeholder="Team name"
      />

      {showAdmin && (
        <div className="mt-4 flex flex-col gap-3">
          <label className="flex items-center gap-2 text-sm text-muted">
            Rating
            <input
              type="number"
              step="0.1"
              min="1"
              max="10"
              value={team.rating.toFixed(1)}
              onChange={(e) => handleRatingChange(e.target.value)}
              className="input w-24 text-sm"
            />
          </label>
          <button
            type="button"
            onClick={() => onDelete?.(team.id)}
            className="btn-ghost text-danger"
          >
            Delete Team
          </button>
        </div>
      )}
    </div>
  );
}
