"use client";

import { useEffect, useMemo, useState } from "react";
import { useAppStore } from "@/lib/store";
import type { Team, TeamLineup } from "@/lib/types";
import { ImageUpload } from "@/components/shared/image-upload";
import { Trash2, Users, Star, X } from "lucide-react";

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
  const [showDetails, setShowDetails] = useState(false);
  const [lineup, setLineup] = useState<TeamLineup | null>(null);
  const [lineupLoading, setLineupLoading] = useState(false);
  const [lineupError, setLineupError] = useState("");

  const playerStats = useMemo(() => {
    return {
      yellowCards: teamPlayers.reduce((sum, player) => sum + player.yellowCards, 0),
      redCards: teamPlayers.reduce((sum, player) => sum + player.redCards, 0),
      goals: teamPlayers.reduce((sum, player) => sum + player.goals, 0),
      assists: teamPlayers.reduce((sum, player) => sum + player.assists, 0),
      saves: teamPlayers.reduce((sum, player) => sum + player.saves, 0),
      cleanSheets: teamPlayers.reduce((sum, player) => sum + player.cleanSheets, 0),
      averageRating:
        teamPlayers.length > 0
          ? teamPlayers.reduce((sum, player) => sum + player.rating, 0) / teamPlayers.length
          : 0,
    };
  }, [teamPlayers]);

  const fetchLineup = async () => {
    setLineupLoading(true);
    setLineupError("");
    try {
      const res = await fetch(`/api/teams/${team.id}/lineups`);
      const body = await res.json();
      if (!res.ok) {
        setLineupError(body.error || "Unable to load lineup.");
        setLineup(null);
      } else {
        const active = (body.lineups || []).find((item: TeamLineup) => item.isActive) || body.lineups?.[0] || null;
        setLineup(active);
      }
    } catch (error) {
      setLineupError("Unable to load lineup.");
      setLineup(null);
    } finally {
      setLineupLoading(false);
    }
  };

  const openDetails = () => {
    setShowDetails(true);
    fetchLineup();
  };

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
    updateTeam(team.id, { logo_url: url });
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
            currentUrl={team.logo_url}
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

        <button
          type="button"
          onClick={openDetails}
          className="btn-outline w-full mt-4"
        >
          View Team Details
        </button>
      </div>

      {showDetails && (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4">
          <div className="bg-surface w-full max-w-2xl rounded-xl shadow-xl overflow-hidden">
            <div className="px-6 py-4 border-b border-line flex items-center justify-between">
              <div>
                <h3 className="text-lg font-semibold">{team.name} Overview</h3>
                <p className="text-sm text-muted">Full team summary and lineup preview</p>
              </div>
              <button
                type="button"
                onClick={() => setShowDetails(false)}
                className="text-muted hover:text-text"
                title="Close"
              >
                <X size={18} />
              </button>
            </div>

            <div className="p-6 grid gap-6 lg:grid-cols-[1.3fr_0.9fr]">
              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div className="card p-4">
                    <h4 className="text-sm font-semibold text-text mb-2">Team Rating</h4>
                    <p className="text-3xl font-bold">{team.rating.toFixed(1)}</p>
                  </div>
                  <div className="card p-4">
                    <h4 className="text-sm font-semibold text-text mb-2">Players</h4>
                    <p className="text-3xl font-bold">{teamPlayers.length}</p>
                  </div>
                  <div className="card p-4">
                    <h4 className="text-sm font-semibold text-text mb-2">Yellow Cards</h4>
                    <p className="text-3xl font-bold">{playerStats.yellowCards}</p>
                  </div>
                  <div className="card p-4">
                    <h4 className="text-sm font-semibold text-text mb-2">Red Cards</h4>
                    <p className="text-3xl font-bold">{playerStats.redCards}</p>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="card p-4">
                    <h4 className="text-sm font-semibold text-text mb-2">Goals</h4>
                    <p className="text-2xl font-bold">{playerStats.goals}</p>
                  </div>
                  <div className="card p-4">
                    <h4 className="text-sm font-semibold text-text mb-2">Assists</h4>
                    <p className="text-2xl font-bold">{playerStats.assists}</p>
                  </div>
                  <div className="card p-4">
                    <h4 className="text-sm font-semibold text-text mb-2">Saves</h4>
                    <p className="text-2xl font-bold">{playerStats.saves}</p>
                  </div>
                  <div className="card p-4">
                    <h4 className="text-sm font-semibold text-text mb-2">Clean Sheets</h4>
                    <p className="text-2xl font-bold">{playerStats.cleanSheets}</p>
                  </div>
                </div>

                <div className="card p-4">
                  <h4 className="text-sm font-semibold text-text mb-2">Average Player Rating</h4>
                  <p className="text-2xl font-bold">{teamPlayers.length > 0 ? playerStats.averageRating.toFixed(1) : "N/A"}</p>
                </div>
              </div>

              <div className="space-y-4">
                <div className="card p-4">
                  <div className="flex items-center justify-between mb-3">
                    <div>
                      <h4 className="text-sm font-semibold text-text">Active Lineup</h4>
                      <p className="text-xs text-muted">Source: team account lineup</p>
                    </div>
                    {lineupLoading && <span className="text-xs text-muted">Loading…</span>}
                  </div>

                  {!lineupLoading && lineup && (
                    <div className="space-y-3">
                      <div className="rounded-lg bg-surface-2 p-3 border border-line">
                        <p className="text-sm font-semibold">{lineup.name}</p>
                        <p className="text-xs text-muted">Formation: {lineup.formation}</p>
                      </div>
                      <div>
                        {/* Formation mini-pitch with player avatars */}
                        <div className="w-full flex flex-col items-center gap-3">
                          <div className="w-full text-center text-sm text-muted mb-1">Formation: {lineup.formation}</div>

                          <div className="w-full rounded-lg overflow-hidden" aria-hidden>
                            <div className="relative bg-gradient-to-b from-green-700 to-green-600 p-4 rounded-lg shadow-inner">
                              <div className="absolute inset-0 opacity-10 bg-[radial-gradient(ellipse_at_center,_var(--tw-gradient-stops))] from-white to-transparent pointer-events-none" />

                              {(() => {
                                const parts = (lineup.formation || "").split("-").map((n) => parseInt(n, 10)).filter(Boolean);
                                const formation = parts.length >= 2 ? parts : [4, 4, 2];
                                const [defCount, midCount, attCount] = formation.length === 3 ? formation : [formation[0], formation[1] ?? 4, formation[2] ?? 2];

                                const gkSlots = lineup.slots.filter((s) => s.position === "GK");
                                const defSlots = lineup.slots.filter((s) => s.position === "DEF");
                                const midSlots = lineup.slots.filter((s) => s.position === "MID");
                                const attSlots = lineup.slots.filter((s) => s.position === "ATT");

                                const makeRow = (count: number, slots: typeof lineup.slots, roleLabel: string) => {
                                  const cells: (typeof slots[0] | null)[] = [];
                                  for (let i = 0; i < count; i++) cells.push(slots[i] ?? null);
                                  return (
                                    <div key={roleLabel} className="w-full flex justify-center gap-2">
                                      <div className="w-full max-w-[520px] grid gap-2" style={{ gridTemplateColumns: `repeat(${count}, minmax(0, 1fr))` }}>
                                        {cells.map((slot, idx) => {
                                          const player = slot ? players.find((p) => p.id === slot.playerId) : null;
                                          const initials = player ? player.name.split(" ").map(n => n[0]).slice(0,2).join("") : (slot ? slot.label.split(" ").map(n=>n[0]).slice(0,2).join("") : "");
                                          return (
                                            <div key={slot ? slot.slotId : `empty-${roleLabel}-${idx}`} className="flex flex-col items-center text-center">
                                              <div className="w-12 h-12 rounded-full bg-white/90 flex items-center justify-center text-xs font-semibold text-text ring-1 ring-white/40">
                                                <div>
                                                  <div className="text-sm">{player ? player.number : ""}</div>
                                                  <div className="text-[11px]">{initials}</div>
                                                </div>
                                              </div>
                                              <div className="text-xs text-white/90 mt-1 truncate max-w-[90px]">{player ? player.name : (slot ? slot.label : "Empty")}</div>
                                            </div>
                                          );
                                        })}
                                      </div>
                                    </div>
                                  );
                                };

                                return (
                                  <div className="w-full space-y-3">
                                    <div className="pt-2" />
                                    {makeRow(attCount, attSlots, "ATT")}
                                    {makeRow(midCount, midSlots, "MID")}
                                    {makeRow(defCount, defSlots, "DEF")}
                                    <div className="w-full flex justify-center mt-2">
                                      <div className="w-24">
                                        {gkSlots[0] ? (
                                          (() => {
                                            const p = players.find((p) => p.id === gkSlots[0].playerId);
                                            const initials = p ? p.name.split(" ").map(n => n[0]).slice(0,2).join("") : gkSlots[0].label.split(" ").map(n=>n[0]).slice(0,2).join("");
                                            return (
                                              <div className="flex flex-col items-center">
                                                <div className="w-14 h-14 rounded-full bg-white/90 flex items-center justify-center text-sm font-semibold text-text ring-1 ring-white/40">
                                                  <div>
                                                    <div className="text-sm">{p ? p.number : ""}</div>
                                                    <div className="text-[11px]">{initials}</div>
                                                  </div>
                                                </div>
                                                <div className="text-xs text-white/90 mt-1">GK</div>
                                              </div>
                                            );
                                          })()
                                        ) : (
                                          <div className="text-xs text-white/90">No goalkeeper</div>
                                        )}
                                      </div>
                                    </div>
                                  </div>
                                );
                              })()}
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>
                  )}

                  {!lineupLoading && !lineup && (
                    <div className="rounded-lg bg-surface-2 p-4 border border-dashed border-line text-sm text-muted">
                      Coach has not added a lineup yet, so nothing is available here yet.
                    </div>
                  )}

                  {lineupError && (
                    <p className="text-sm text-danger">{lineupError}</p>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
