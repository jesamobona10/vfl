"use client";

import { useState, useRef } from "react";
import { useCompetition, useUpdateCompetition, useGenerateFixtures, useSeasons, useCreateSeason, useUpdateSeason } from "@/lib/hooks/use-competitions";
import { useQueryClient } from "@tanstack/react-query";
import { useParams } from "next/navigation";
import { Calendar, Check, AlertCircle, Upload, Image as ImageIcon, Plus, ChevronDown } from "lucide-react";
import { SkeletonForm } from "@/components/shared/skeleton";
import type { Season } from "@/lib/types";

const statusOptions: { value: string; label: string }[] = [
  { value: "draft", label: "Draft" },
  { value: "active", label: "Active" },
  { value: "completed", label: "Completed" },
];

const seasonStatusColors: Record<string, string> = {
  upcoming: "bg-gray-500/20 text-gray-300",
  active: "bg-green-500/20 text-green-400",
  completed: "bg-blue-500/20 text-blue-400",
};

export default function CompetitionSettingsPage() {
  const params = useParams();
  const cId = params.cId as string;
  const { data: currentCompetition, isLoading } = useCompetition(cId);
  const { data: seasons = [] } = useSeasons(currentCompetition?.id);
  const updateMutation = useUpdateCompetition();
  const generateFixturesMutation = useGenerateFixtures();
  const createSeasonMutation = useCreateSeason();
  const updateSeasonMutation = useUpdateSeason();
  const queryClient = useQueryClient();

  const [status, setStatus] = useState<"draft" | "active" | "completed">(currentCompetition?.status ?? "draft");
  const [message, setMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);

  const [compLogoUploading, setCompLogoUploading] = useState(false);
  const [compLogoUrl, setCompLogoUrl] = useState<string | null>(null);
  const compLogoInputRef = useRef<HTMLInputElement>(null);

  const [showNewSeasonForm, setShowNewSeasonForm] = useState(false);
  const [newSeasonName, setNewSeasonName] = useState("");
  const [newSeasonStart, setNewSeasonStart] = useState("");
  const [newSeasonEnd, setNewSeasonEnd] = useState("");

  const handleCompLogoUpload = async (file: File) => {
    if (!file.type.startsWith("image/")) { alert("Please select an image file."); return; }
    if (file.size > 2 * 1024 * 1024) { alert("File too large. Max 2MB."); return; }
    if (!currentCompetition) return;
    setCompLogoUploading(true);
    try {
      const formData = new FormData();
      formData.append("file", file);
      formData.append("compId", currentCompetition.id);
      formData.append("compName", currentCompetition.name);
      const res = await fetch("/api/upload/comp-logo", { method: "POST", body: formData });
      const data = await res.json();
      if (data.error) { alert(data.error); return; }
      setCompLogoUrl(data.url);
      queryClient.invalidateQueries({ queryKey: ["competition", cId] });
    } catch { alert("Upload failed."); }
    finally { setCompLogoUploading(false); }
  };

  if (isLoading || !currentCompetition) {
    return (
      <div className="flex items-center justify-center py-20">
        <SkeletonForm fields={5} />
      </div>
    );
  }

  const handleStatusChange = async () => {
    setMessage(null);
    updateMutation.mutate(
      { id: cId, status },
      {
        onSuccess: () => setMessage({ type: "success", text: "Status updated successfully." }),
        onError: (err) => setMessage({ type: "error", text: err instanceof Error ? err.message : "Something went wrong" }),
      }
    );
  };

  const handleGenerateFixtures = async () => {
    setMessage(null);
    const currentSeason = seasons.find((s) => s.is_current);
    const seasonId = currentSeason?.id;
    generateFixturesMutation.mutate(cId, {
      onSuccess: () => setMessage({ type: "success", text: "Fixtures generated successfully." }),
      onError: (err) => setMessage({ type: "error", text: err instanceof Error ? err.message : "Something went wrong" }),
    });
  };

  const handleCreateSeason = async () => {
    if (!newSeasonName.trim()) return;
    setMessage(null);
    createSeasonMutation.mutate(
      {
        competitionId: cId,
        name: newSeasonName.trim(),
        start_date: newSeasonStart || undefined,
        end_date: newSeasonEnd || undefined,
      },
      {
        onSuccess: () => {
          setMessage({ type: "success", text: "Season created successfully." });
          setNewSeasonName("");
          setNewSeasonStart("");
          setNewSeasonEnd("");
          setShowNewSeasonForm(false);
        },
        onError: (err) => setMessage({ type: "error", text: err instanceof Error ? err.message : "Something went wrong" }),
      }
    );
  };

  const handleActivateSeason = (season: Season) => {
    setMessage(null);
    updateSeasonMutation.mutate(
      { id: season.id, competitionId: cId, is_current: true, status: "active" },
      {
        onSuccess: () => setMessage({ type: "success", text: `Season "${season.name}" activated.` }),
        onError: (err) => setMessage({ type: "error", text: err instanceof Error ? err.message : "Something went wrong" }),
      }
    );
  };

  const handleCompleteSeason = (season: Season) => {
    setMessage(null);
    updateSeasonMutation.mutate(
      { id: season.id, competitionId: cId, status: "completed", is_current: false },
      {
        onSuccess: () => setMessage({ type: "success", text: `Season "${season.name}" completed.` }),
        onError: (err) => setMessage({ type: "error", text: err instanceof Error ? err.message : "Something went wrong" }),
      }
    );
  };

  const isLeague = currentCompetition.type === "league";
  const canGenerateFixtures = isLeague && (status === "draft" || status === "active");
  const pending = updateMutation.isPending || generateFixturesMutation.isPending || createSeasonMutation.isPending || updateSeasonMutation.isPending;

  const logoDisplayUrl = compLogoUrl || currentCompetition.logo_url;

  return (
    <div className="max-w-xl space-y-6">
      <div className="card p-6 space-y-4">
        <h2 className="text-lg font-semibold">Competition Logo</h2>
        <div className="flex items-center gap-4">
          <div className="relative shrink-0">
            <div
              onClick={() => compLogoInputRef.current?.click()}
              className="w-20 h-20 rounded-xl bg-surface-2 flex items-center justify-center overflow-hidden border border-line cursor-pointer hover:opacity-80 transition-opacity"
            >
              {logoDisplayUrl ? (
                <img src={logoDisplayUrl} alt="Competition logo" className="w-full h-full object-cover" />
              ) : (
                <ImageIcon size={30} className="text-muted/40" />
              )}
              {compLogoUploading && (
                <div className="absolute inset-0 bg-black/40 flex items-center justify-center rounded-xl">
                  <span className="block w-5 h-5 bg-surface-2 rounded animate-pulse" />
                </div>
              )}
            </div>
            <input ref={compLogoInputRef} type="file" accept="image/*" onChange={(e) => {
              const file = e.target.files?.[0];
              if (file) handleCompLogoUpload(file);
            }} className="hidden" />
          </div>
          <div className="flex-1">
            <p className="text-sm font-medium">{currentCompetition.name}</p>
            <p className="text-xs text-muted capitalize">{currentCompetition.type}</p>
          </div>
          <button
            onClick={() => compLogoInputRef.current?.click()}
            disabled={compLogoUploading}
            className="btn-ghost text-sm"
          >
            {compLogoUploading ? <span className="block w-4 h-4 bg-surface-2 rounded animate-pulse" /> : <Upload size={14} />}
            {logoDisplayUrl ? "Change" : "Upload"}
          </button>
        </div>
      </div>

      <div className="card p-6 space-y-4">
        <h2 className="text-lg font-semibold">Competition Details</h2>
        <div className="grid grid-cols-2 gap-4 text-sm">
          <div>
            <span className="text-muted">Name</span>
            <p className="font-medium">{currentCompetition.name}</p>
          </div>
          <div>
            <span className="text-muted">Type</span>
            <p className="font-medium capitalize">{currentCompetition.type}</p>
          </div>
          <div>
            <span className="text-muted">Status</span>
            <p className="font-medium capitalize">{currentCompetition.status}</p>
          </div>
          <div>
            <span className="text-muted">Season</span>
            <p className="font-medium">{currentCompetition.season ?? "—"}</p>
          </div>
          <div className="col-span-2">
            <span className="text-muted">ID</span>
            <p className="font-medium text-xs font-mono">{currentCompetition.id}</p>
          </div>
        </div>
      </div>

      <div className="card p-6 space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold">Seasons</h2>
          <button
            onClick={() => setShowNewSeasonForm(!showNewSeasonForm)}
            className="btn-ghost text-sm"
          >
            <Plus size={14} /> New Season
          </button>
        </div>

        {showNewSeasonForm && (
          <div className="space-y-3 p-4 bg-surface-2 rounded-lg">
            <input
              value={newSeasonName}
              onChange={(e) => setNewSeasonName(e.target.value)}
              className="input text-sm"
              placeholder="Season name (e.g. 2025/2026)"
            />
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs text-muted mb-1">Start Date</label>
                <input
                  type="date"
                  value={newSeasonStart}
                  onChange={(e) => setNewSeasonStart(e.target.value)}
                  className="input text-sm"
                />
              </div>
              <div>
                <label className="block text-xs text-muted mb-1">End Date</label>
                <input
                  type="date"
                  value={newSeasonEnd}
                  onChange={(e) => setNewSeasonEnd(e.target.value)}
                  className="input text-sm"
                />
              </div>
            </div>
            <div className="flex gap-2">
              <button
                onClick={handleCreateSeason}
                disabled={pending || !newSeasonName.trim()}
                className="btn-primary text-sm"
              >
                {createSeasonMutation.isPending ? <span className="block w-4 h-4 bg-surface-2 rounded animate-pulse" /> : <Check size={14} />}
                Create Season
              </button>
              <button onClick={() => { setShowNewSeasonForm(false); setNewSeasonName(""); }} className="btn-ghost text-sm">Cancel</button>
            </div>
          </div>
        )}

        {seasons.length === 0 ? (
          <p className="text-sm text-muted">No seasons yet. Create one to start archiving competition data.</p>
        ) : (
          <div className="space-y-2">
            {seasons.map((season) => (
              <div key={season.id} className="flex items-center justify-between p-3 rounded-lg bg-surface-2">
                <div className="flex items-center gap-3 min-w-0">
                  <span className={`text-[11px] font-medium px-2 py-0.5 rounded-full shrink-0 ${
                    seasonStatusColors[season.status] || seasonStatusColors.upcoming
                  }`}>
                    {season.status}
                  </span>
                  <div className="min-w-0">
                    <p className="text-sm font-medium truncate">
                      {season.name}
                      {season.is_current && <span className="ml-2 text-xs text-brand font-semibold">(Current)</span>}
                    </p>
                    {(season.start_date || season.end_date) && (
                      <p className="text-xs text-muted">
                        {season.start_date && new Date(season.start_date).toLocaleDateString()}
                        {season.start_date && season.end_date && " — "}
                        {season.end_date && new Date(season.end_date).toLocaleDateString()}
                      </p>
                    )}
                  </div>
                </div>
                <div className="flex items-center gap-1 shrink-0">
                  {season.status !== "active" && season.status !== "completed" && (
                    <button
                      onClick={() => handleActivateSeason(season)}
                      disabled={pending}
                      className="btn-ghost text-xs"
                      title="Activate season"
                    >
                      Activate
                    </button>
                  )}
                  {season.status === "active" && (
                    <button
                      onClick={() => handleCompleteSeason(season)}
                      disabled={pending}
                      className="btn-ghost text-xs text-danger"
                      title="Complete season"
                    >
                      Complete
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="card p-6 space-y-4">
        <h2 className="text-lg font-semibold">Change Status</h2>
        <div className="flex items-end gap-3">
          <div className="flex-1">
            <label htmlFor="status" className="block text-sm font-medium mb-1">
              Status
            </label>
            <select
              id="status"
              value={status}
               onChange={(e) => setStatus(e.target.value as "draft" | "active" | "completed")}
              className="input w-full"
            >
              {statusOptions.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>
          </div>
          <button
            onClick={handleStatusChange}
            disabled={pending || status === currentCompetition.status}
            className="btn-primary flex items-center gap-2"
          >
            {pending ? <span className="block w-4 h-4 bg-surface-2 rounded animate-pulse" /> : <Check size={14} />}
            Update
          </button>
        </div>
      </div>

      {canGenerateFixtures && (
        <div className="card p-6 space-y-4">
          <h2 className="text-lg font-semibold">Fixtures</h2>
          <p className="text-sm text-muted">
            Generate round-robin fixtures for all teams in this league.
          </p>
          <button
            onClick={handleGenerateFixtures}
            disabled={pending}
            className="btn-primary flex items-center gap-2"
          >
            {pending ? (
              <span className="block w-4 h-4 bg-surface-2 rounded animate-pulse" />
            ) : (
              <Calendar size={14} />
            )}
            Generate Fixtures
          </button>
        </div>
      )}

      {message && (
        <div
          className={`flex items-start gap-2 text-sm p-3 rounded-lg ${
            message.type === "success"
              ? "text-green-400 bg-green-500/10"
              : "text-danger bg-danger/10"
          }`}
        >
          {message.type === "success" ? (
            <Check size={16} className="mt-0.5 shrink-0" />
          ) : (
            <AlertCircle size={16} className="mt-0.5 shrink-0" />
          )}
          <span>{message.text}</span>
        </div>
      )}
    </div>
  );
}
