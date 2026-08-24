"use client";

import { useState, useRef } from "react";
import {
  useCompetition,
  useUpdateCompetition,
  useGenerateFixtures,
  useSeasons,
  useCreateSeason,
  useUpdateSeason,
  useCreateSeasonRollover,
} from "@/lib/hooks/use-competitions";
import { useQueryClient } from "@tanstack/react-query";
import { useParams } from "next/navigation";
import {
  Calendar,
  Check,
  AlertCircle,
  Upload,
  Image as ImageIcon,
  Plus,
  ChevronDown,
  Copy,
  Sparkles,
} from "lucide-react";
import { SkeletonForm } from "@/components/shared/skeleton";
import { useToast } from "@/components/ui/toast";
import { useConfirm } from "@/components/shared/confirm-dialog";
import type { Season } from "@/lib/types";

const statusOptions: { value: string; label: string }[] = [
  { value: "draft", label: "Draft" },
  { value: "active", label: "Active" },
  { value: "completed", label: "Completed" },
  { value: "archived", label: "Archived" },
];

const seasonStatusColors: Record<string, string> = {
  draft: "bg-surface-2 text-ink-3",
  upcoming: "bg-surface-2 text-ink-3",
  active: "bg-live-tint text-live-500",
  completed: "bg-brand-50 text-brand-700",
  archived: "bg-muted/20 text-muted",
};

export default function CompetitionSettingsPage() {
  const params = useParams();
  const cId = params.cId as string;
  const toast = useToast();
  const { confirm, dialog: confirmDialog } = useConfirm();
  const { data: currentCompetition, isLoading } = useCompetition(cId);
  const { data: seasons = [] } = useSeasons(currentCompetition?.id);
  const updateMutation = useUpdateCompetition();
  const generateFixturesMutation = useGenerateFixtures();
  const createSeasonMutation = useCreateSeason();
  const updateSeasonMutation = useUpdateSeason();
  const rolloverMutation = useCreateSeasonRollover(cId);
  const queryClient = useQueryClient();

  const [status, setStatus] = useState<"draft" | "active" | "completed" | "archived">(
    currentCompetition?.status ?? "draft"
  );
  const [message, setMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);

  const [compLogoUploading, setCompLogoUploading] = useState(false);
  const [compLogoUrl, setCompLogoUrl] = useState<string | null>(null);
  const compLogoInputRef = useRef<HTMLInputElement>(null);

  const [flyerUploading, setFlyerUploading] = useState(false);
  const [flyerBgUrl, setFlyerBgUrl] = useState<string | null>(null);
  const [flyerTextColor, setFlyerTextColor] = useState("#ffffff");
  const [flyerSaving, setFlyerSaving] = useState(false);
  const flyerInputRef = useRef<HTMLInputElement>(null);

  const [showNewSeasonForm, setShowNewSeasonForm] = useState(false);
  const [newSeasonName, setNewSeasonName] = useState("");
  const [newSeasonShortName, setNewSeasonShortName] = useState("");
  const [newSeasonStart, setNewSeasonStart] = useState("");
  const [newSeasonEnd, setNewSeasonEnd] = useState("");

  const handleCompLogoUpload = async (file: File) => {
    if (!file.type.startsWith("image/")) {
      toast.error("Please select an image file.");
      return;
    }
    if (file.size > 2 * 1024 * 1024) {
      toast.error("File too large. Maximum size is 2MB.");
      return;
    }
    if (!currentCompetition) return;
    setCompLogoUploading(true);
    try {
      const formData = new FormData();
      formData.append("file", file);
      formData.append("compId", currentCompetition.id);
      formData.append("compName", currentCompetition.name);
      const res = await fetch("/api/upload/comp-logo", { method: "POST", body: formData });
      const data = await res.json();
      if (data.error) {
        toast.error(data.error);
        return;
      }
      setCompLogoUrl(data.url);
      queryClient.invalidateQueries({ queryKey: ["competition", cId] });
    } catch {
      toast.error("Upload failed. Please try again.");
    } finally {
      setCompLogoUploading(false);
    }
  };

  const handleFlyerBgUpload = async (file: File) => {
    if (!file.type.startsWith("image/")) {
      toast.error("Please select an image file.");
      return;
    }
    if (file.size > 4 * 1024 * 1024) {
      toast.error("File too large. Maximum size is 4MB.");
      return;
    }
    if (!currentCompetition) return;
    setFlyerUploading(true);
    try {
      const formData = new FormData();
      formData.append("file", file);
      formData.append("compId", currentCompetition.id);
      formData.append("compName", currentCompetition.name);
      const res = await fetch("/api/upload/flyer-bg", { method: "POST", body: formData });
      const data = await res.json();
      if (data.error) {
        toast.error(data.error);
        return;
      }
      setFlyerBgUrl(data.url);
      queryClient.invalidateQueries({ queryKey: ["competition", cId] });
    } catch {
      toast.error("Upload failed. Please try again.");
    } finally {
      setFlyerUploading(false);
    }
  };

  const handleFlyerSave = async () => {
    if (!currentCompetition) return;
    setMessage(null);
    setFlyerSaving(true);
    const currentSettings = (
      currentCompetition.settings && typeof currentCompetition.settings === "object"
        ? currentCompetition.settings
        : {}
    ) as Record<string, unknown>;
    const flyer = (
      currentSettings.flyer && typeof currentSettings.flyer === "object"
        ? currentSettings.flyer
        : {}
    ) as Record<string, unknown>;
    updateMutation.mutate(
      {
        id: cId,
        settings: {
          ...currentSettings,
          flyer: { ...flyer, text_color: flyerTextColor },
        },
      },
      {
        onSuccess: () => setMessage({ type: "success", text: "Flyer settings saved." }),
        onError: (err) =>
          setMessage({
            type: "error",
            text: err instanceof Error ? err.message : "Something went wrong",
          }),
        onSettled: () => setFlyerSaving(false),
      }
    );
  };

  const handleRemoveFlyerBg = () => {
    if (!currentCompetition) return;
    setMessage(null);
    setFlyerBgUrl(null);
    const currentSettings = (
      currentCompetition.settings && typeof currentCompetition.settings === "object"
        ? currentCompetition.settings
        : {}
    ) as Record<string, unknown>;
    const flyer = (
      currentSettings.flyer && typeof currentSettings.flyer === "object"
        ? currentSettings.flyer
        : {}
    ) as Record<string, unknown>;
    updateMutation.mutate(
      {
        id: cId,
        settings: { ...currentSettings, flyer: { ...flyer, background_url: null } },
      },
      {
        onSuccess: () => setMessage({ type: "success", text: "Custom flyer background removed." }),
        onError: (err) =>
          setMessage({
            type: "error",
            text: err instanceof Error ? err.message : "Something went wrong",
          }),
      }
    );
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
        onError: (err) =>
          setMessage({
            type: "error",
            text: err instanceof Error ? err.message : "Something went wrong",
          }),
      }
    );
  };

  const handleGenerateFixtures = async () => {
    setMessage(null);
    const currentSeason = seasons.find((s) => s.is_current);
    const seasonId = currentSeason?.id;
    generateFixturesMutation.mutate(
      { competitionId: cId, seasonId },
      {
        onSuccess: () => setMessage({ type: "success", text: "Fixtures generated successfully." }),
        onError: (err) =>
          setMessage({
            type: "error",
            text: err instanceof Error ? err.message : "Something went wrong",
          }),
      }
    );
  };

  const handleCreateSeason = async () => {
    if (!newSeasonName.trim()) return;
    setMessage(null);
    createSeasonMutation.mutate(
      {
        competitionId: cId,
        name: newSeasonName.trim(),
        short_name: newSeasonShortName.trim() || undefined,
        start_date: newSeasonStart || undefined,
        end_date: newSeasonEnd || undefined,
      },
      {
        onSuccess: () => {
          setMessage({ type: "success", text: "Season created successfully." });
          setNewSeasonName("");
          setNewSeasonShortName("");
          setNewSeasonStart("");
          setNewSeasonEnd("");
          setShowNewSeasonForm(false);
        },
        onError: (err) =>
          setMessage({
            type: "error",
            text: err instanceof Error ? err.message : "Something went wrong",
          }),
      }
    );
  };

  const handleRollover = async (source: Season) => {
    if (
      !(await confirm({
        title: `Rollover season "${source.name}"?`,
        description: "A new season will be created and teams registered this season will be copied over.",
        confirmLabel: "Create season",
      }))
    )
      return;
    setMessage(null);
    rolloverMutation.mutate(
      { from_season_id: source.id },
      {
        onSuccess: () =>
          setMessage({ type: "success", text: "New season created from previous season." }),
        onError: (err) =>
          setMessage({
            type: "error",
            text: err instanceof Error ? err.message : "Something went wrong",
          }),
      }
    );
  };

  const handleActivateSeason = (season: Season) => {
    setMessage(null);
    updateSeasonMutation.mutate(
      { id: season.id, competitionId: cId, is_current: true, status: "active" },
      {
        onSuccess: () =>
          setMessage({ type: "success", text: `Season "${season.name}" activated.` }),
        onError: (err) =>
          setMessage({
            type: "error",
            text: err instanceof Error ? err.message : "Something went wrong",
          }),
      }
    );
  };

  const handleCompleteSeason = (season: Season) => {
    setMessage(null);
    updateSeasonMutation.mutate(
      { id: season.id, competitionId: cId, status: "completed", is_current: false },
      {
        onSuccess: () =>
          setMessage({ type: "success", text: `Season "${season.name}" completed.` }),
        onError: (err) =>
          setMessage({
            type: "error",
            text: err instanceof Error ? err.message : "Something went wrong",
          }),
      }
    );
  };

  const isLeague = currentCompetition.type === "league";
  const canGenerateFixtures = isLeague && (status === "draft" || status === "active");
  const pending =
    updateMutation.isPending ||
    generateFixturesMutation.isPending ||
    createSeasonMutation.isPending ||
    updateSeasonMutation.isPending ||
    rolloverMutation.isPending;

  const logoDisplayUrl = compLogoUrl || currentCompetition.logo_url;

  const flyerSettings = (() => {
    const s = (
      currentCompetition.settings && typeof currentCompetition.settings === "object"
        ? currentCompetition.settings
        : {}
    ) as Record<string, unknown>;
    const f = (s.flyer && typeof s.flyer === "object" ? s.flyer : {}) as Record<string, unknown>;
    return f;
  })();
  const flyerBgDisplayUrl =
    flyerBgUrl ||
    (typeof flyerSettings.background_url === "string" ? flyerSettings.background_url : null);
  const savedFlyerTextColor =
    typeof flyerSettings.text_color === "string" ? flyerSettings.text_color : "#ffffff";
  const flyerTextColorValue =
    flyerTextColor === "#ffffff" && savedFlyerTextColor !== "#ffffff"
      ? savedFlyerTextColor
      : flyerTextColor;

  return (
    <div className="max-w-xl space-y-6">
      {confirmDialog}
      <div className="card p-6 space-y-4">
        <h2 className="text-lg font-semibold">Competition Logo</h2>
        <div className="flex items-center gap-4">
          <div className="relative shrink-0">
            <div
              onClick={() => compLogoInputRef.current?.click()}
              className="w-20 h-20 rounded-xl bg-surface-2 flex items-center justify-center overflow-hidden border border-line cursor-pointer hover:opacity-80 transition-opacity"
            >
              {logoDisplayUrl ? (
                <img
                  src={logoDisplayUrl}
                  alt="Competition logo"
                  className="w-full h-full object-cover"
                />
              ) : (
                <ImageIcon size={30} className="text-muted/40" />
              )}
              {compLogoUploading && (
                <div className="absolute inset-0 bg-black/40 flex items-center justify-center rounded-xl">
                  <span className="block w-5 h-5 bg-surface-2 rounded animate-pulse" />
                </div>
              )}
            </div>
            <input
              ref={compLogoInputRef}
              type="file"
              accept="image/*"
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (file) handleCompLogoUpload(file);
              }}
              className="hidden"
            />
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
            {compLogoUploading ? (
              <span className="block w-4 h-4 bg-surface-2 rounded animate-pulse" />
            ) : (
              <Upload size={14} />
            )}
            {logoDisplayUrl ? "Change" : "Upload"}
          </button>
        </div>
      </div>

      <div className="card p-6 space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold">Match Flyer Design</h2>
          <span className="flex items-center gap-1.5 text-xs text-muted">
            <Sparkles size={13} />
            Custom background per competition
          </span>
        </div>
        <p className="text-sm text-muted">
          Upload your own flyer design. It renders as a full-bleed background on generated match
          flyers, with team names, date and time overlaid on top. Leave it empty to use the built-in
          design.
        </p>

        <div>
          <p className="text-xs text-muted mb-2">Flyer Background</p>
          <div className="flex items-center gap-4">
            <div className="relative shrink-0">
              <div
                onClick={() => flyerInputRef.current?.click()}
                className="w-28 h-40 rounded-xl bg-surface-2 flex items-center justify-center overflow-hidden border border-line cursor-pointer hover:opacity-80 transition-opacity"
              >
                {flyerBgDisplayUrl ? (
                  <img
                    src={flyerBgDisplayUrl}
                    alt="Flyer background"
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <ImageIcon size={30} className="text-muted/40" />
                )}
                {flyerUploading && (
                  <div className="absolute inset-0 bg-black/40 flex items-center justify-center rounded-xl">
                    <span className="block w-5 h-5 bg-surface-2 rounded animate-pulse" />
                  </div>
                )}
              </div>
              <input
                ref={flyerInputRef}
                type="file"
                accept="image/*"
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (file) handleFlyerBgUpload(file);
                }}
                className="hidden"
              />
            </div>
            <div className="flex-1 space-y-3">
              <div className="flex flex-wrap gap-2">
                <button
                  onClick={() => flyerInputRef.current?.click()}
                  disabled={flyerUploading}
                  className="btn-ghost text-sm"
                >
                  {flyerUploading ? (
                    <span className="block w-4 h-4 bg-surface-2 rounded animate-pulse" />
                  ) : (
                    <Upload size={14} />
                  )}
                  {flyerBgDisplayUrl ? "Change" : "Upload"}
                </button>
                {flyerBgDisplayUrl && (
                  <button onClick={handleRemoveFlyerBg} className="btn-ghost text-sm text-danger">
                    Remove
                  </button>
                )}
              </div>
              <div className="flex items-center gap-3">
                <label htmlFor="flyer-text-color" className="text-sm text-muted shrink-0">
                  Text color
                </label>
                <input
                  id="flyer-text-color"
                  type="color"
                  value={flyerTextColorValue}
                  onChange={(e) => setFlyerTextColor(e.target.value)}
                  className="w-10 h-9 rounded-lg border border-line bg-transparent cursor-pointer"
                />
                <span className="text-xs font-mono text-muted">{flyerTextColorValue}</span>
              </div>
              <div>
                <button
                  onClick={handleFlyerSave}
                  disabled={flyerSaving || flyerTextColor === savedFlyerTextColor}
                  className="btn-primary text-sm disabled:opacity-40 disabled:cursor-not-allowed"
                >
                  {flyerSaving ? (
                    <span className="block w-4 h-4 bg-surface-2 rounded animate-pulse" />
                  ) : (
                    <Check size={14} />
                  )}
                  Save Flyer Settings
                </button>
              </div>
            </div>
          </div>
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
            <p className="font-medium">{seasons.find((s) => s.is_current)?.name ?? "—"}</p>
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
            <input
              value={newSeasonShortName}
              onChange={(e) => setNewSeasonShortName(e.target.value)}
              className="input text-sm"
              placeholder="Short name (e.g. 25/26) — optional"
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
                {createSeasonMutation.isPending ? (
                  <span className="block w-4 h-4 bg-surface-2 rounded animate-pulse" />
                ) : (
                  <Check size={14} />
                )}
                Create Season
              </button>
              <button
                onClick={() => {
                  setShowNewSeasonForm(false);
                  setNewSeasonName("");
                }}
                className="btn-ghost text-sm"
              >
                Cancel
              </button>
            </div>
          </div>
        )}

        {seasons.length === 0 ? (
          <p className="text-sm text-muted">
            No seasons yet. Create one to start archiving competition data.
          </p>
        ) : (
          <div className="space-y-2">
            {seasons.map((season) => (
              <div
                key={season.id}
                className="flex items-center justify-between p-3 rounded-lg bg-surface-2"
              >
                <div className="flex items-center gap-3 min-w-0">
                  <span
                    className={`text-[11px] font-medium px-2 py-0.5 rounded-full shrink-0 ${
                      seasonStatusColors[season.status] || seasonStatusColors.upcoming
                    }`}
                  >
                    {season.status}
                  </span>
                  <div className="min-w-0">
                    <p className="text-sm font-medium truncate">
                      {season.name}
                      {season.is_current && (
                        <span className="ml-2 text-xs text-brand font-semibold">(Current)</span>
                      )}
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
                  <button
                    onClick={() => handleRollover(season)}
                    disabled={pending}
                    className="btn-ghost text-xs"
                    title="Create new season from this one"
                  >
                    <Copy size={12} />
                    Rollover
                  </button>
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
              onChange={(e) =>
                setStatus(e.target.value as "draft" | "active" | "completed" | "archived")
              }
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
            {pending ? (
              <span className="block w-4 h-4 bg-surface-2 rounded animate-pulse" />
            ) : (
              <Check size={14} />
            )}
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
            message.type === "success" ? "text-live-500 bg-live-tint" : "text-danger bg-danger/10"
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
