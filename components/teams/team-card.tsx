"use client";

import { useEffect, useState } from "react";
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
  const [name, setName] = useState(team.name);
  const [rating, setRating] = useState(team.rating.toFixed(1));

  useEffect(() => {
    setName(team.name);
    setRating(team.rating.toFixed(1));
  }, [team.name, team.rating]);

  const saveTeam = async (data: Partial<Pick<Team, "name" | "rating">>) => {
    if (Object.keys(data).length === 0) return;
    try {
      const res = await fetch(`/api/teams/${team.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        console.error("Failed to save team:", body.error || res.statusText);
        return;
      }
      const payload = await res.json();
      const updated = payload.team;
      updateTeam(team.id, {
        name: updated?.name ?? data.name,
        rating: updated?.rating ?? data.rating,
      });
    } catch (error) {
      console.error("Unable to save team:", error);
    }
  };

  const handleNameBlur = () => {
    const trimmed = name.trim();
    if (!trimmed) {
      setName(team.name);
      return;
    }
    if (trimmed !== team.name) {
      saveTeam({ name: trimmed });
    }
  };

  const handleRatingBlur = () => {
    const parsed = parseFloat(rating);
    if (Number.isNaN(parsed)) {
      setRating(team.rating.toFixed(1));
      return;
    }
    if (parsed !== team.rating) {
      saveTeam({ rating: parsed });
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
        value={name}
        onChange={(e) => setName(e.target.value)}
        onBlur={handleNameBlur}
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
              value={rating}
              onChange={(e) => setRating(e.target.value)}
              onBlur={handleRatingBlur}
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
