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
  useSeasonTeams,
} from "@/lib/hooks/use-competitions";
import { useQueryClient } from "@tanstack/react-query";
import { useParams } from "next/navigation";
import Link from "next/link";
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
  Shield,
  Users,
  BarChart3,
  ChevronRight,
} from "lucide-react";
import { useToast } from "@/components/ui/toast";
import { Badge } from "@/components/ui/badge";
import { seasonStatusVariant, statusLabel } from "@/lib/status";
import { useConfirm } from "@/components/shared/confirm-dialog";
import { useSeasonHasFixtures } from "@/lib/hooks/use-competition-stats";
import type { Season, Team } from "@/lib/types";
import {
  DEFAULT_FLYER_SETTINGS,
  FLYER_FORMATS,
  FLYER_FORMAT_SPECS,
  FLYER_TEMPLATE_OPTIONS,
  parseFlyerSettings,
  readFlyerSettings,
  type FlyerFormat,
  type FlyerSettings,
  type FlyerTemplate,
} from "@/lib/flyer/settings";
import { FlyerCanvas } from "@/components/flyers/flyer-canvas";

const statusOptions: { value: string; label: string }[] = [
  { value: "draft", label: "Draft" },
  { value: "active", label: "Active" },
  { value: "completed", label: "Completed" },
  { value: "archived", label: "Archived" },
];

export default function CompetitionSettingsPage() {
  const params = useParams();
  const slug = params.slug as string;
  const cId = params.cId as string;
  const toast = useToast();
  const { confirm, dialog: confirmDialog } = useConfirm();
  const { data: currentCompetition, isLoading } = useCompetition(cId);
  const { data: seasons = [] } = useSeasons(currentCompetition?.id);
  const currentSeasonId = seasons.find((s) => s.is_current)?.id;
  const { data: seasonHasFixtures, isLoading: checkingFixtures } = useSeasonHasFixtures(
    currentSeasonId ?? undefined
  );
  const { data: previewSeasonTeams = [] } = useSeasonTeams(currentSeasonId);
  const updateMutation = useUpdateCompetition();
  const generateFixturesMutation = useGenerateFixtures();
  const createSeasonMutation = useCreateSeason();
  const updateSeasonMutation = useUpdateSeason();
  const rolloverMutation = useCreateSeasonRollover(cId);
  const queryClient = useQueryClient();

  // Derived until the admin actually edits it. Seeding this with useState ran
  // before currentCompetition resolved, so an active competition showed "draft"
  // and saving overwrote the real status.
  const [statusOverride, setStatusOverride] = useState<
    "draft" | "active" | "completed" | "archived" | null
  >(null);
  const status = statusOverride ?? currentCompetition?.status ?? "draft";
  const setStatus = (value: "draft" | "active" | "completed" | "archived") =>
    setStatusOverride(value);
  const [message, setMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);

  const [compLogoUploading, setCompLogoUploading] = useState(false);
  const [compLogoUrl, setCompLogoUrl] = useState<string | null>(null);
  const compLogoInputRef = useRef<HTMLInputElement>(null);

  const [flyerUploading, setFlyerUploading] = useState(false);
  const [flyerDraft, setFlyerDraft] = useState<FlyerSettings | null>(null);
  const [flyerSaving, setFlyerSaving] = useState(false);
  const flyerInputRef = useRef<HTMLInputElement>(null);

  // Derive the live flyer config: the edited draft when present, otherwise the
  // value persisted on the competition. No pre-load seeding needed.
  const savedFlyerSettings = readFlyerSettings(currentCompetition?.settings);
  const flyer = flyerDraft ?? savedFlyerSettings;
  const flyerDirty =
    flyerDraft !== null && JSON.stringify(flyerDraft) !== JSON.stringify(savedFlyerSettings);
  const updateFlyer = (patch: Partial<FlyerSettings>) =>
    setFlyerDraft({ ...flyer, ...patch });

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
      setFlyerDraft({ ...flyer, background_url: data.url });
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
    updateMutation.mutate(
      {
        id: cId,
        settings: { ...currentSettings, flyer: parseFlyerSettings(flyer) },
      },
      {
        onSuccess: () => {
          setFlyerDraft(null);
          setMessage({ type: "success", text: "Flyer settings saved." });
        },
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
    updateFlyer({ background_url: null });
  };

  if (isLoading || !currentCompetition) {
    return null;
  }

  const handleStatusChange = async () => {
    setMessage(null);
    updateMutation.mutate(
      { id: cId, status },
      {
        onSuccess: () => {
          setStatusOverride(null);
          setMessage({ type: "success", text: "Status updated successfully." });
        },
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

  const canGenerateFixtures =
    (status === "draft" || status === "active") && !seasonHasFixtures;
  const pending =
    updateMutation.isPending ||
    generateFixturesMutation.isPending ||
    createSeasonMutation.isPending ||
    updateSeasonMutation.isPending ||
    rolloverMutation.isPending;

  const logoDisplayUrl = compLogoUrl || currentCompetition.logo_url;

  // Sample teams from the active season so the preview reflects real names/logos.
  const toPreviewTeam = (index: number, fallback: string): Team | undefined => {
    const entry = previewSeasonTeams[index];
    if (!entry) return undefined;
    return {
      id: entry.team_id,
      name: entry.display_name || entry.team?.name || fallback,
      rating: entry.team?.rating ?? 0,
      logo_url: entry.logo_url || entry.team?.logo_url || undefined,
    };
  };
  const previewHome = toPreviewTeam(0, "Home");
  const previewAway = toPreviewTeam(1, "Away");
  const flyerPreviewScale = flyer.format === "story" ? 0.62 : 0.75;
  const flyerPreviewDate =
    seasons.find((s) => s.is_current)?.start_date || new Date().toISOString().slice(0, 10);

  const seasonQuery = currentSeasonId ? `?seasonId=${currentSeasonId}` : "";

  return (
    <div className="max-w-xl space-y-6">
      {confirmDialog}
      <div className="card p-6 space-y-3">
        <div>
          <h2 className="text-lg font-semibold">Competition Sections</h2>
          <p className="text-sm text-muted">
            Roster and performance data for this competition.
          </p>
        </div>
        <div className="divide-y divide-line">
          {[
            { href: "teams", label: "Teams", icon: Shield },
            { href: "players", label: "Players", icon: Users },
            { href: "stats", label: "Statistics", icon: BarChart3 },
          ].map((item) => {
            const Icon = item.icon;
            return (
              <Link
                key={item.href}
                href={`/org/${slug}/competitions/${cId}/${item.href}${seasonQuery}`}
                className="flex items-center justify-between gap-2 py-3 text-sm font-medium hover:text-brand transition-colors"
              >
                <span className="flex items-center gap-2.5">
                  <Icon size={16} className="text-muted" />
                  {item.label}
                </span>
                <ChevronRight size={16} className="text-muted" />
              </Link>
            );
          })}
        </div>
      </div>
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

      <div className="card p-6 space-y-5">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold">Match Flyer Design</h2>
          <span className="flex items-center gap-1.5 text-xs text-muted">
            <Sparkles size={13} />
            Live preview
          </span>
        </div>
        <p className="text-sm text-muted">
          Pick a template and size, tweak the text and colours, and optionally add a custom
          background. These settings apply to every match flyer generated for this competition.
        </p>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
          <div className="space-y-3">
            <div>
              <label htmlFor="flyer-template" className="block text-xs text-muted mb-1">
                Template
              </label>
              <select
                id="flyer-template"
                value={flyer.template}
                onChange={(e) => updateFlyer({ template: e.target.value as FlyerTemplate })}
                className="input w-full text-sm"
              >
                {FLYER_TEMPLATE_OPTIONS.map((opt) => (
                  <option key={opt.id} value={opt.id}>
                    {opt.label} — {opt.description}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label htmlFor="flyer-format" className="block text-xs text-muted mb-1">
                Size
              </label>
              <select
                id="flyer-format"
                value={flyer.format}
                onChange={(e) => updateFlyer({ format: e.target.value as FlyerFormat })}
                className="input w-full text-sm"
              >
                {FLYER_FORMATS.map((f) => (
                  <option key={f} value={f}>
                    {FLYER_FORMAT_SPECS[f].label} ({FLYER_FORMAT_SPECS[f].width}×
                    {FLYER_FORMAT_SPECS[f].height})
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label htmlFor="flyer-headline" className="block text-xs text-muted mb-1">
                Headline
              </label>
              <input
                id="flyer-headline"
                value={flyer.headline}
                maxLength={60}
                onChange={(e) => updateFlyer({ headline: e.target.value })}
                className="input w-full text-sm"
                placeholder="Match Day"
              />
            </div>
            <div>
              <label htmlFor="flyer-subtitle" className="block text-xs text-muted mb-1">
                Subtitle (optional)
              </label>
              <input
                id="flyer-subtitle"
                value={flyer.subtitle}
                maxLength={80}
                onChange={(e) => updateFlyer({ subtitle: e.target.value })}
                className="input w-full text-sm"
                placeholder="e.g. Round 5"
              />
            </div>
            <div>
              <label htmlFor="flyer-footer" className="block text-xs text-muted mb-1">
                Footer (optional)
              </label>
              <input
                id="flyer-footer"
                value={flyer.footer_text}
                maxLength={80}
                onChange={(e) => updateFlyer({ footer_text: e.target.value })}
                className="input w-full text-sm"
                placeholder="e.g. #MatchDay"
              />
            </div>
          </div>

          <div className="space-y-4">
            <div className="flex items-center gap-3">
              <label htmlFor="flyer-accent-color" className="text-sm text-muted flex-1">
                Accent colour
              </label>
              <input
                id="flyer-accent-color"
                type="color"
                value={flyer.accent_color}
                onChange={(e) => updateFlyer({ accent_color: e.target.value })}
                className="w-10 h-9 rounded-lg border border-line bg-transparent cursor-pointer"
              />
              <span className="text-xs font-mono text-muted">{flyer.accent_color}</span>
            </div>
            {flyer.accent_color === DEFAULT_FLYER_SETTINGS.accent_color && (
              <p className="text-xs text-ink-3">
                This default follows your organization&apos;s brand color. Pick a colour to override it.
              </p>
            )}
            {flyer.background_url && (
              <>
                <div className="flex items-center gap-3">
                  <label htmlFor="flyer-text-color" className="text-sm text-muted flex-1">
                    Text colour
                  </label>
                  <input
                    id="flyer-text-color"
                    type="color"
                    value={flyer.text_color}
                    onChange={(e) => updateFlyer({ text_color: e.target.value })}
                    className="w-10 h-9 rounded-lg border border-line bg-transparent cursor-pointer"
                  />
                  <span className="text-xs font-mono text-muted">{flyer.text_color}</span>
                </div>
                <div>
                  <label htmlFor="flyer-overlay" className="text-sm text-muted">
                    Background dim — {flyer.overlay}%
                  </label>
                  <input
                    id="flyer-overlay"
                    type="range"
                    min={0}
                    max={100}
                    value={flyer.overlay}
                    onChange={(e) => updateFlyer({ overlay: Number(e.target.value) })}
                    className="w-full accent-brand mt-1"
                  />
                </div>
              </>
            )}

            <div className="space-y-2 pt-1">
              {(
                [
                  ["show_competition", "Show competition name"],
                  ["show_logos", "Show team logos"],
                  ["show_venue", "Show venue"],
                ] as const
              ).map(([key, label]) => (
                <label key={key} className="flex items-center gap-2 text-sm text-muted">
                  <input
                    type="checkbox"
                    checked={flyer[key]}
                    onChange={(e) =>
                      updateFlyer({ [key]: e.target.checked } as Partial<FlyerSettings>)
                    }
                    className="rounded border-line"
                  />
                  {label}
                </label>
              ))}
            </div>

            <div>
              <p className="text-xs text-muted mb-2">Background (optional)</p>
              <div className="flex items-center gap-3">
                <div
                  onClick={() => flyerInputRef.current?.click()}
                  className="relative w-20 h-28 rounded-lg bg-surface-2 flex items-center justify-center overflow-hidden border border-line cursor-pointer hover:opacity-80 transition-opacity"
                >
                  {flyer.background_url ? (
                    <img
                      src={flyer.background_url}
                      alt="Flyer background"
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <ImageIcon size={24} className="text-muted/40" />
                  )}
                  {flyerUploading && (
                    <div className="absolute inset-0 bg-black/40 flex items-center justify-center">
                      <span className="block w-5 h-5 bg-surface-2 rounded animate-pulse" />
                    </div>
                  )}
                </div>
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
                    {flyer.background_url ? "Change" : "Upload"}
                  </button>
                  {flyer.background_url && (
                    <button onClick={handleRemoveFlyerBg} className="btn-ghost text-sm text-danger">
                      Remove
                    </button>
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
            </div>
          </div>
        </div>

        <div>
          <p className="text-xs text-muted mb-2">Preview</p>
          <div className="rounded-xl border border-line bg-surface-2 p-4 flex justify-center overflow-hidden">
            <FlyerCanvas
              homeTeam={previewHome}
              awayTeam={previewAway}
              date={flyerPreviewDate}
              time="15:00"
              venue="Home Ground"
              competitionName={currentCompetition.name}
              settings={flyer}
              scale={flyerPreviewScale}
            />
          </div>
        </div>

        <div className="flex flex-wrap items-center justify-between gap-3">
          <p className="text-xs text-muted">
            {flyerDirty ? "You have unsaved changes." : "Saved — used by all match flyers."}
          </p>
          <button
            onClick={handleFlyerSave}
            disabled={flyerSaving || !flyerDirty}
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

      <div className="card p-6 space-y-4">
        <h2 className="text-lg font-semibold">Competition Details</h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-sm">
          <div>
            <span className="text-muted">Name</span>
            <p className="font-medium break-words">{currentCompetition.name}</p>
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
          <div className="col-span-1 sm:col-span-2">
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
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
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
                className="flex flex-wrap items-center justify-between gap-x-3 gap-y-2 p-3 rounded-lg bg-surface-2"
              >
                <div className="flex items-center gap-3 min-w-0">
                  <Badge
                    variant={seasonStatusVariant(season.status)}
                    className="shrink-0"
                  >
                    {statusLabel(season.status)}
                  </Badge>
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
            Generate round-robin fixtures for all teams in this competition.
          </p>
          <button
            onClick={handleGenerateFixtures}
            disabled={pending || checkingFixtures}
            title={
              seasonHasFixtures
                ? "Fixtures have already been generated for this season. Delete them first to regenerate."
                : undefined
            }
            className="btn-primary flex items-center gap-2"
          >
            {pending ? (
              <span className="block w-4 h-4 bg-surface-2 rounded animate-pulse" />
            ) : (
              <Calendar size={14} />
            )}
            {seasonHasFixtures ? "Fixtures Generated" : "Generate Fixtures"}
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
