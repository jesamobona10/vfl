"use client";

import { useAppStore } from "@/lib/store";
import type { Team } from "@/lib/types";
import { ImageUpload } from "@/components/shared/image-upload";

interface TeamCardProps {
  team: Team;
  index: number;
  isManaged: boolean;
}

export function TeamCard({ team, index, isManaged }: TeamCardProps) {
  const updateTeam = useAppStore((s) => s.updateTeam);

  const handleNameChange = (value: string) => {
    updateTeam(team.id, { name: value });
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
    </div>
  );
}
