"use client";

import { useEffect, useState } from "react";
import { useAppStore } from "@/lib/store";
import type { Team } from "@/lib/types";
import { ImageUpload } from "@/components/shared/image-upload";
import { Trash2, Users, Star } from "lucide-react";

interface TeamCardProps {
  team: Team;
  index: number;
  isManaged: boolean;
  showAdmin?: boolean;
  onDelete?: (id: number) => void;
}

export function TeamCard({ team, index, isManaged, showAdmin, onDelete }: TeamCardProps) {
  const updateTeam = useAppStore((s) => s.updateTeam);
  const players = useAppStore((s) => s.players);
  const [name, setName] = useState(team.name);
  const [rating, setRating] = useState(team.rating.toFixed(1));
  const [isHovered, setIsHovered] = useState(false);

  useEffect(() => {
    setName(team.name);
    setRating(team.rating.toFixed(1));
  }, [team.name, team.rating]);

  const teamPlayers = players.filter((p) => p.teamId === team.id);

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
    <div
      className="card p-0 overflow-hidden transition-all duration-200"
      style={{
        boxShadow: isHovered ? "0 4px 12px rgba(0,0,0,0.08)" : undefined,
      }}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
    >
      <div className="bg-surface-2 px-4 py-2.5 flex items-center justify-between border-b border-line">
        <span className="text-xs font-semibold text-muted uppercase tracking-wider">
          {isManaged ? "Your Team" : `Team ${index + 1}`}
        </span>
        {showAdmin && onDelete && (
          <button
            type="button"
            onClick={() => onDelete(team.id)}
            className="text-muted hover:text-danger transition-colors p-0.5 rounded"
            title="Delete team"
          >
            <Trash2 size={14} />
          </button>
        )}
      </div>

      <div className="p-5 flex flex-col items-center">
        <div className="mb-4">
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
          className="input text-center font-semibold text-base mb-3"
          placeholder="Team name"
        />

        <div className="flex items-center gap-4 w-full justify-center text-xs text-muted">
          <span className="flex items-center gap-1">
            <Users size={12} />
            {teamPlayers.length} player{teamPlayers.length !== 1 ? "s" : ""}
          </span>
          {showAdmin ? (
            <span className="flex items-center gap-1">
              <Star size={12} className="text-accent" />
              <input
                type="number"
                step="0.1"
                min="1"
                max="10"
                value={rating}
                onChange={(e) => setRating(e.target.value)}
                onBlur={handleRatingBlur}
                className="w-12 bg-transparent border-none text-center text-xs font-medium text-text focus:outline-none p-0"
              />
            </span>
          ) : (
            <span className="flex items-center gap-1">
              <Star size={12} className="text-accent" />
              {team.rating.toFixed(1)}
            </span>
          )}
        </div>
      </div>
    </div>
  );
}
