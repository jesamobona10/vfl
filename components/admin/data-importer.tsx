"use client";

import { useState, useRef } from "react";
import { useAppStore } from "@/lib/store";
import { parseImportFile, buildImportPlan } from "@/lib/utils/data-import";
import type { ImportData, ImportPlan } from "@/lib/utils/data-import";
import {
  Upload,
  FileText,
  CheckCircle,
  AlertCircle,
  ArrowRight,
  Download,
  Loader2,
  X,
  Shield,
  Users,
  Calendar,
} from "lucide-react";

type Step = "upload" | "preview" | "confirm" | "done";

export function DataImporter() {
  const teams = useAppStore((s) => s.teams);
  const setTeams = useAppStore((s) => s.setTeams);
  const setFixtures = useAppStore((s) => s.setFixtures);
  const setPlayers = useAppStore((s) => s.setPlayers);

  const [step, setStep] = useState<Step>("upload");
  const [error, setError] = useState("");
  const [jsonText, setJsonText] = useState("");
  const [parsed, setParsed] = useState<ImportData | null>(null);
  const [plan, setPlan] = useState<ImportPlan | null>(null);
  const [importing, setImporting] = useState(false);
  const [summary, setSummary] = useState<{
    teams: number;
    fixtures: number;
    players: number;
    mapped: number;
  } | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const handleFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    setError("");
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      const text = ev.target?.result as string;
      setJsonText(text);
      tryParse(text);
    };
    reader.readAsText(file);
  };

  const handlePaste = () => {
    setError("");
    tryParse(jsonText);
  };

  const tryParse = (text: string) => {
    try {
      const json = JSON.parse(text);
      const result = parseImportFile(json);
      if ("error" in result) {
        setError(result.error);
        setParsed(null);
        setPlan(null);
        return;
      }
      setParsed(result);
      const plan = buildImportPlan(result, teams);
      setPlan(plan);
      setStep("preview");
    } catch {
      setError("Invalid JSON syntax. Please check the file content.");
      setParsed(null);
      setPlan(null);
    }
  };

  const handleImport = () => {
    if (!plan) return;
    setImporting(true);
    try {
      setTeams(plan.teams);
      setFixtures(plan.fixtures);
      setPlayers(plan.players);
      const matchCount = plan.mapping.filter(([src, int]) =>
        teams.some((t) => t.id === int)
      ).length;
      setSummary({
        teams: plan.teams.length,
        fixtures: plan.fixtures.reduce((s, r) => s + r.matches.length, 0),
        players: plan.players.length,
        mapped: matchCount,
      });
      setStep("done");
    } catch {
      setError("Import failed unexpectedly.");
    } finally {
      setImporting(false);
    }
  };

  const handleReset = () => {
    setStep("upload");
    setError("");
    setJsonText("");
    setParsed(null);
    setPlan(null);
    setSummary(null);
    if (fileRef.current) fileRef.current.value = "";
  };

  const fixtureCount = plan
    ? plan.fixtures.reduce((s, r) => s + r.matches.length, 0)
    : 0;

  if (step === "done" && summary) {
    return (
      <div className="space-y-6">
        <div className="text-center py-10 space-y-4">
          <div className="mx-auto w-16 h-16 rounded-full bg-brand/10 flex items-center justify-center">
            <CheckCircle size={36} className="text-brand" />
          </div>
          <h3 className="text-2xl font-bold">Import Complete</h3>
          <p className="text-muted">
            Your data has been imported successfully.
          </p>
          <div className="grid grid-cols-3 gap-4 max-w-md mx-auto">
            <div className="card p-4 text-center">
              <Shield size={20} className="mx-auto mb-1 text-brand" />
              <p className="text-2xl font-bold">{summary.teams}</p>
              <p className="text-xs text-muted">Teams</p>
            </div>
            <div className="card p-4 text-center">
              <Calendar size={20} className="mx-auto mb-1 text-brand" />
              <p className="text-2xl font-bold">{summary.fixtures}</p>
              <p className="text-xs text-muted">Matches</p>
            </div>
            <div className="card p-4 text-center">
              <Users size={20} className="mx-auto mb-1 text-brand" />
              <p className="text-2xl font-bold">{summary.players}</p>
              <p className="text-xs text-muted">Players</p>
            </div>
          </div>
          <p className="text-xs text-muted">
            {summary.mapped} teams were auto-matched by name.
          </p>
          <button onClick={handleReset} className="btn-primary">
            <Upload size={16} /> Import Another File
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h3 className="text-lg font-bold mb-1">Import Data</h3>
        <p className="text-sm text-muted">
          Replace all existing data with data from a JSON export file. This
          cannot be undone.
        </p>
      </div>

      {error && (
        <div className="flex items-center gap-2 text-sm text-danger bg-danger/10 rounded-lg px-4 py-3">
          <AlertCircle size={16} />
          {error}
        </div>
      )}

      {step === "upload" && (
        <div className="space-y-4">
          <div
            className="border-2 border-dashed border-line rounded-xl p-10 text-center cursor-pointer hover:border-brand transition-colors"
            onClick={() => fileRef.current?.click()}
          >
            <input
              ref={fileRef}
              type="file"
              accept=".json"
              className="hidden"
              onChange={handleFile}
            />
            <Upload size={40} className="mx-auto mb-3 text-muted" />
            <p className="font-medium">
              Drop a JSON export file here or click to browse
            </p>
            <p className="text-sm text-muted mt-1">
              Accepted format: VFL export JSON (.json)
            </p>
          </div>

          <div className="relative">
            <div className="absolute inset-0 flex items-center">
              <div className="w-full border-t border-line" />
            </div>
            <div className="relative flex justify-center">
              <span className="bg-bg px-3 text-xs text-muted">or paste JSON</span>
            </div>
          </div>

          <textarea
            value={jsonText}
            onChange={(e) => setJsonText(e.target.value)}
            className="input w-full h-40 font-mono text-sm"
            placeholder='{"teams": [...], "fixtures": [...], "players": [...]}'
          />
          <button
            onClick={handlePaste}
            className="btn-primary"
            disabled={!jsonText.trim()}
          >
            <FileText size={16} /> Parse JSON
          </button>
        </div>
      )}

      {step === "preview" && plan && (
        <div className="space-y-6">
          <div className="grid grid-cols-3 gap-4">
            <div className="card p-4 text-center">
              <Shield size={20} className="mx-auto mb-1 text-brand" />
              <p className="text-2xl font-bold">{plan.teams.length}</p>
              <p className="text-xs text-muted">Teams</p>
            </div>
            <div className="card p-4 text-center">
              <Calendar size={20} className="mx-auto mb-1 text-brand" />
              <p className="text-2xl font-bold">{fixtureCount}</p>
              <p className="text-xs text-muted">Matches</p>
            </div>
            <div className="card p-4 text-center">
              <Users size={20} className="mx-auto mb-1 text-brand" />
              <p className="text-2xl font-bold">{plan.players.length}</p>
              <p className="text-xs text-muted">Players</p>
            </div>
          </div>

          <div className="card p-4">
            <h4 className="text-sm font-semibold text-muted uppercase tracking-wider mb-3">
              Team Mapping ({plan.mapping.length} teams)
            </h4>
            <div className="space-y-2">
              {plan.teams.map((t) => {
                const srcId = plan.mapping.find(([, int]) => int === t.id)?.[0];
                const wasMatched = teams.some(
                  (it) => it.id === t.id
                );
                return (
                  <div
                    key={t.id}
                    className="flex items-center gap-3 text-sm"
                  >
                    <Shield size={14} className="text-muted shrink-0" />
                    <span className="font-medium">{t.name}</span>
                    <span className="text-xs text-muted">(ID: {t.id})</span>
                    {srcId !== undefined && srcId !== t.id && (
                      <>
                        <ArrowRight size={14} className="text-muted" />
                        <span className="text-xs text-muted">
                          source ID: {srcId}
                        </span>
                      </>
                    )}
                    {wasMatched ? (
                      <span className="text-xs text-brand ml-auto">
                        Auto-matched
                      </span>
                    ) : (
                      <span className="text-xs text-muted ml-auto">
                        New team
                      </span>
                    )}
                  </div>
                );
              })}
            </div>
          </div>

          <div className="flex gap-3">
            <button onClick={handleReset} className="btn-ghost">
              <X size={16} /> Cancel
            </button>
            <button onClick={() => setStep("confirm")} className="btn-primary">
              <ArrowRight size={16} /> Continue to Import
            </button>
          </div>
        </div>
      )}

      {step === "confirm" && plan && (
        <div className="space-y-6">
          <div className="bg-danger/10 border border-danger/20 rounded-xl p-6 text-center space-y-3">
            <AlertCircle size={32} className="mx-auto text-danger" />
            <h4 className="text-lg font-bold text-danger">
              This will replace ALL existing data
            </h4>
            <p className="text-sm text-muted">
              Current data ({teams.length} teams,{" "}
              {useAppStore.getState().players.length} players,{" "}
              {useAppStore.getState().fixtures.length} fixture rounds) will be
              permanently overwritten.
            </p>
          </div>

          <div className="flex gap-3 justify-center">
            <button onClick={() => setStep("preview")} className="btn-ghost">
              <X size={16} /> Go Back
            </button>
            <button
              onClick={handleImport}
              disabled={importing}
              className="btn-danger"
            >
              {importing ? (
                <>
                  <Loader2 size={16} className="animate-spin" /> Importing...
                </>
              ) : (
                <>
                  <Download size={16} /> Confirm Import
                </>
              )}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
