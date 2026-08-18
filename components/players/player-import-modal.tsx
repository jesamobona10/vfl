"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useOrg } from "@/lib/hooks/use-org";
import { parsePlayerImportCSV } from "@/lib/utils/csv";
import type { PlayerImportRow } from "@/lib/types";
import { X, Upload, FileSpreadsheet, AlertCircle, CheckCircle2, Loader2 } from "lucide-react";

interface PlayerImportModalProps {
  slug: string;
  onClose: () => void;
  onImported: () => void;
}

type Step = "upload" | "preview" | "done";

interface SeasonOption {
  id: string;
  name: string;
  competitionName: string;
}

const VALID_POSITIONS = ["GK", "DEF", "MID", "ATT"];

export function PlayerImportModal({ slug, onClose, onImported }: PlayerImportModalProps) {
  const { data: org } = useOrg(slug);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [step, setStep] = useState<Step>("upload");
  const [csvText, setCsvText] = useState("");
  const [teams, setTeams] = useState<any[]>([]);
  const [existingPlayers, setExistingPlayers] = useState<any[]>([]);
  const [parseResult, setParseResult] = useState<{
    rows: PlayerImportRow[];
    errors: string[];
    warnings: string[];
  } | null>(null);
  const [createMissingTeams, setCreateMissingTeams] = useState(true);
  const [seasonId, setSeasonId] = useState("");
  const [seasonOptions, setSeasonOptions] = useState<SeasonOption[]>([]);
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [result, setResult] = useState<{
    imported: number;
    createdTeams: number;
    errors: string[];
    registeredToSeason: boolean;
  } | null>(null);
  const [parseError, setParseError] = useState("");

  // Load org teams + players for the preview.
  useEffect(() => {
    if (!org?.id) return;
    let cancelled = false;
    Promise.all([
      fetch(`/api/teams?org_id=${org.id}`).then((r) => r.json()),
      fetch(`/api/players?org_id=${org.id}`).then((r) => r.json()),
    ])
      .then(([teamsData, playersData]) => {
        if (cancelled) return;
        setTeams(teamsData.teams || []);
        setExistingPlayers(playersData.players || []);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [org?.id]);

  // Load competition seasons for the optional season registration.
  useEffect(() => {
    if (!org?.id) return;
    let cancelled = false;
    fetch(`/api/competitions?org_id=${org.id}`)
      .then((r) => r.json())
      .then(async (data) => {
        if (cancelled) return;
        const comps = data.competitions || [];
        const seasons: SeasonOption[] = [];
        for (const comp of comps) {
          try {
            const res = await fetch(`/api/competitions/${comp.id}/seasons`);
            const sData = await res.json();
            (sData.seasons || []).forEach((s: any) => {
              seasons.push({ id: s.id, name: s.name, competitionName: comp.name });
            });
          } catch {
            // skip competitions we can't load
          }
        }
        if (!cancelled) setSeasonOptions(seasons);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [org?.id]);

  const handleFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      try {
        const text = ev.target?.result as string;
        if (!text.trim()) {
          setParseError("The file is empty.");
          return;
        }
        parseCsv(text);
      } catch (err: any) {
        setParseError(err?.message || "Error reading file.");
      }
    };
    reader.readAsText(file);
    e.target.value = "";
  };

  const parseCsv = (text: string) => {
    setParseError("");
    try {
      const result = parsePlayerImportCSV(text, teams, existingPlayers);
      setCsvText(text);
      setParseResult(result);
      setStep("preview");
    } catch (err: any) {
      setParseError(err?.message || "Unable to parse CSV.");
    }
  };

  const rowsToSend = useMemo(() => {
    if (!parseResult) return [];
    return parseResult.rows.filter((r) => createMissingTeams || r.team_exists);
  }, [parseResult, createMissingTeams]);

  const skippedCount = useMemo(() => {
    if (!parseResult) return 0;
    return parseResult.rows.length - rowsToSend.length;
  }, [parseResult, rowsToSend]);

  const handleSubmit = async () => {
    if (!org?.id || rowsToSend.length === 0) return;
    setSubmitting(true);
    setResult(null);
    try {
      const res = await fetch(`/api/organizations/${slug}/players/import`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          players: rowsToSend,
          create_missing_teams: createMissingTeams,
          season_id: seasonId || null,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setResult({
          imported: 0,
          createdTeams: 0,
          errors: [data.error || "Import failed."],
          registeredToSeason: false,
        });
        setStep("done");
        return;
      }
      setResult(data);
      setStep("done");
      onImported();
    } catch {
      setResult({
        imported: 0,
        createdTeams: 0,
        errors: ["Network error. Please try again."],
        registeredToSeason: false,
      });
      setStep("done");
    } finally {
      setSubmitting(false);
    }
  };

  const positionLabel = (pos: string) => {
    switch (pos) {
      case "GK":
        return "Goalkeeper";
      case "DEF":
        return "Defender";
      case "MID":
        return "Midfielder";
      case "ATT":
        return "Attacker";
      default:
        return pos;
    }
  };

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl w-full max-w-2xl relative shadow-lg max-h-[90vh] flex flex-col">
        <button onClick={onClose} className="absolute top-4 right-4 btn-icon">
          <X size={18} />
        </button>

        <div className="p-6 border-b border-line">
          <h2 className="text-lg font-bold">Import Players from CSV</h2>
          <p className="text-sm text-muted">
            Upload the exported responses from your player registration form (Google Forms →
            Download responses (.csv)).
          </p>
        </div>

        <div className="p-6 overflow-y-auto flex-1 space-y-4">
          {step === "upload" && (
            <>
              <div
                className="border-2 border-dashed border-line rounded-xl p-8 text-center cursor-pointer hover:bg-surface transition-colors"
                onClick={() => fileInputRef.current?.click()}
              >
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".csv,text/csv,text/plain"
                  onChange={handleFile}
                  className="hidden"
                />
                <FileSpreadsheet size={40} className="mx-auto text-muted mb-3" />
                <p className="font-medium">Click to select a CSV file</p>
                <p className="text-sm text-muted mt-1">
                  Required columns: <strong>Player Name</strong> and <strong>Team</strong>.
                  Optional: Position, Jersey Number, Captain.
                </p>
              </div>

              <div className="flex items-center gap-3 text-sm text-muted">
                <div className="flex-1 h-px bg-line" />
                or paste below
                <div className="flex-1 h-px bg-line" />
              </div>

              <textarea
                rows={5}
                placeholder="Paste CSV content here (including the header row)..."
                className="input w-full font-mono text-xs"
                value={csvText}
                onChange={(e) => setCsvText(e.target.value)}
              />
              <button
                type="button"
                className="btn w-full"
                onClick={() => {
                  if (!csvText.trim()) {
                    setParseError("Paste CSV content first.");
                    return;
                  }
                  parseCsv(csvText);
                }}
              >
                Preview Import
              </button>

              {parseError && (
                <div className="flex items-start gap-2 text-sm text-danger bg-danger/10 p-3 rounded-lg">
                  <AlertCircle size={16} className="mt-0.5 shrink-0" />
                  <span>{parseError}</span>
                </div>
              )}

              <div className="text-xs text-muted space-y-1">
                <p>
                  <strong>Recommended Google Form questions:</strong>
                </p>
                <p>
                  1. Organization · 2. Team (dropdown) · 3. Full player name · 4. Position
                  (GK/DEF/MID/ATT) · 5. Jersey number · 6. Team captain?
                </p>
              </div>
            </>
          )}

          {step === "preview" && parseResult && (
            <>
              <div className="flex items-center justify-between flex-wrap gap-3">
                <div className="text-sm">
                  <span className="font-semibold">{rowsToSend.length}</span> player(s) ready to
                  import
                  {skippedCount > 0 && (
                    <span className="text-muted"> · {skippedCount} skipped (unknown team)</span>
                  )}
                </div>
                <div className="flex items-center gap-2">
                  <button
                    className="btn"
                    onClick={() => {
                      setStep("upload");
                      setParseResult(null);
                    }}
                  >
                    Change File
                  </button>
                </div>
              </div>

              {parseResult.warnings.length > 0 && (
                <div className="space-y-1 text-xs text-amber-700 bg-amber-50 p-3 rounded-lg">
                  {parseResult.warnings.map((w, i) => (
                    <p key={i}>• {w}</p>
                  ))}
                </div>
              )}

              {parseResult.errors.length > 0 && (
                <div className="text-xs text-danger bg-danger/10 p-3 rounded-lg space-y-1 max-h-40 overflow-y-auto">
                  <p className="font-medium">{parseResult.errors.length} row(s) will be skipped:</p>
                  {parseResult.errors.map((er, i) => (
                    <p key={i}>• {er}</p>
                  ))}
                </div>
              )}

              <div className="border border-line rounded-lg overflow-hidden">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="bg-surface-2 text-left text-xs text-muted">
                      <th className="px-3 py-2">Name</th>
                      <th className="px-3 py-2">Team</th>
                      <th className="px-3 py-2">Position</th>
                      <th className="px-3 py-2">#</th>
                      <th className="px-3 py-2">Captain</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-line">
                    {parseResult.rows.slice(0, 50).map((r, i) => {
                      const isSkipped = !createMissingTeams && !r.team_exists;
                      return (
                        <tr key={i} className={isSkipped ? "opacity-50" : ""}>
                          <td className="px-3 py-2">{r.name}</td>
                          <td className="px-3 py-2">
                            {r.team_exists ? (
                              <span className="inline-flex items-center gap-1">{r.team_name}</span>
                            ) : (
                              <span className="inline-flex items-center gap-1 text-brand-700">
                                <CheckCircle2 size={12} />
                                {r.team_name} <span className="text-xs text-muted">(new team)</span>
                              </span>
                            )}
                          </td>
                          <td className="px-3 py-2 text-xs">{positionLabel(r.position)}</td>
                          <td className="px-3 py-2 tabular-nums">{r.jersey_number ?? "—"}</td>
                          <td className="px-3 py-2">{r.is_captain ? "Yes" : "—"}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
                {parseResult.rows.length > 50 && (
                  <p className="text-xs text-muted p-2 border-t border-line">
                    +{parseResult.rows.length - 50} more row(s)
                  </p>
                )}
              </div>

              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={createMissingTeams}
                  onChange={(e) => setCreateMissingTeams(e.target.checked)}
                  className="rounded border-line"
                />
                <span className="text-sm">Auto-create teams that don&apos;t exist yet</span>
              </label>

              <div>
                <label className="block text-sm font-medium mb-1">
                  Register into a season <span className="text-muted">(optional)</span>
                </label>
                <select
                  value={seasonId}
                  onChange={(e) => setSeasonId(e.target.value)}
                  className="input w-full"
                >
                  <option value="">No season — org-level only</option>
                  {seasonOptions.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.competitionName} — {s.name}
                    </option>
                  ))}
                </select>
                <p className="text-xs text-muted mt-1">
                  If selected, imported players are registered into that season&apos;s rosters
                  (season teams are registered too).
                </p>
              </div>

              <div className="flex items-center gap-2 justify-end">
                <button className="btn" onClick={onClose} disabled={submitting}>
                  Cancel
                </button>
                <button
                  className="btn-primary flex items-center gap-2"
                  onClick={handleSubmit}
                  disabled={submitting || rowsToSend.length === 0}
                >
                  {submitting ? (
                    <Loader2 size={16} className="animate-spin" />
                  ) : (
                    <Upload size={16} />
                  )}
                  {submitting
                    ? "Importing..."
                    : `Import ${rowsToSend.length} Player${rowsToSend.length !== 1 ? "s" : ""}`}
                </button>
              </div>
            </>
          )}

          {step === "done" && result && (
            <div className="space-y-4">
              {result.errors.length === 0 ? (
                <div className="flex items-center gap-3 text-emerald-700 bg-emerald-50 p-4 rounded-lg">
                  <CheckCircle2 size={20} className="shrink-0" />
                  <div>
                    <p className="font-semibold">Import complete</p>
                    <p className="text-sm">
                      {result.imported} player(s) imported
                      {result.createdTeams > 0 ? ` · ${result.createdTeams} team(s) created` : ""}
                      {result.registeredToSeason ? " · registered to season" : ""}
                    </p>
                  </div>
                </div>
              ) : (
                <div className="flex items-start gap-3 text-danger bg-danger/10 p-4 rounded-lg">
                  <AlertCircle size={20} className="shrink-0" />
                  <div>
                    <p className="font-semibold">Import finished with issues</p>
                    <p className="text-sm">
                      {result.imported} player(s) imported
                      {result.createdTeams > 0 ? ` · ${result.createdTeams} team(s) created` : ""}
                    </p>
                    {result.errors.length > 0 && (
                      <ul className="text-xs mt-2 list-disc pl-4 space-y-1 max-h-40 overflow-y-auto">
                        {result.errors.map((er, i) => (
                          <li key={i}>{er}</li>
                        ))}
                      </ul>
                    )}
                  </div>
                </div>
              )}

              <div className="flex justify-end gap-2">
                <button
                  className="btn"
                  onClick={() => {
                    setStep("upload");
                    setParseResult(null);
                    setResult(null);
                    setCsvText("");
                  }}
                >
                  Import Another File
                </button>
                <button className="btn-primary" onClick={onClose}>
                  Done
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
