"use client";

import { useState } from "react";
import { KeyRound, FileDown, AlertCircle, CheckCircle } from "lucide-react";
import type { GeneratedPlayerCredential } from "@/lib/player-credentials";

type Props = {
  scope: "admin" | "team";
  teamId?: number;
  playerCount: number;
  teamName?: string;
};

function downloadCredentialsCsv(rows: GeneratedPlayerCredential[]) {
  const header = "Player,Team,Username,Temporary Password,Status";
  const lines = rows.map((r) =>
    [
      r.playerName,
      r.teamName,
      r.username,
      r.password,
      r.status,
    ]
      .map((v) => `"${String(v).replace(/"/g, '""')}"`)
      .join(",")
  );
  const blob = new Blob([[header, ...lines].join("\n")], { type: "text/csv" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `player-credentials-${Date.now()}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}

export function GeneratePlayerCredentials({
  scope,
  teamId,
  playerCount,
  teamName,
}: Props) {
  const [loading, setLoading] = useState(false);
  const [forceRegenerate, setForceRegenerate] = useState(false);
  const [error, setError] = useState("");
  const [summary, setSummary] = useState<{
    created: number;
    regenerated: number;
    skipped: number;
    failed: number;
    total: number;
  } | null>(null);
  const [credentials, setCredentials] = useState<GeneratedPlayerCredential[]>([]);

  const endpoint =
    scope === "admin"
      ? "/api/admin/generate-player-credentials"
      : "/api/team/generate-player-credentials";

  const handleGenerate = async () => {
    if (playerCount === 0) {
      setError("No players registered to generate credentials for.");
      return;
    }

    const confirmMsg = forceRegenerate
      ? scope === "admin"
        ? "Regenerate credentials for all players in the system? Existing logins will be replaced."
        : `Regenerate credentials for all players on ${teamName || "your team"}? Existing logins will be replaced.`
      : scope === "admin"
        ? "Generate credentials for every player in the system who does not already have an account?"
        : `Generate credentials for every player on ${teamName || "your team"} who does not already have an account?`;

    if (!confirm(confirmMsg)) return;

    setLoading(true);
    setError("");
    setSummary(null);
    setCredentials([]);

    try {
      const body: Record<string, unknown> = { forceRegenerate };
      if (scope === "admin" && teamId != null) body.teamId = teamId;

      const res = await fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "Failed to generate credentials.");
        return;
      }

      setSummary(data.summary);
      setCredentials(data.credentials || []);
    } catch {
      setError("Failed to generate credentials. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  const exportable = credentials.filter((c) => c.password);

  return (
    <div className="card p-5 space-y-4 border-l-4 border-l-brand">
      <div>
        <h4 className="text-sm font-semibold text-muted uppercase tracking-wider mb-1">
          Player Login Credentials
        </h4>
        <p className="text-sm text-muted">
          {scope === "admin"
            ? teamId != null
              ? `Generate credentials for players on ${teamName || "the selected team"}.`
              : "Generate credentials for every player registered in the league."
            : `Generate credentials for all ${playerCount} player(s) on ${teamName || "your team"}.`}
          {" "}
          Format:{" "}
          <code className="text-xs bg-bg px-1 rounded">PLAYERNAME_TEAMNAME_001</code> /{" "}
          <code className="text-xs bg-bg px-1 rounded">PLAYERNAME_001</code>
        </p>
      </div>

      {error && (
        <div className="flex items-center gap-2 text-sm text-danger bg-danger/10 rounded-lg px-3 py-2">
          <AlertCircle size={16} />
          {error}
        </div>
      )}

      <label className="flex items-center gap-2 text-sm text-muted cursor-pointer">
        <input
          type="checkbox"
          checked={forceRegenerate}
          onChange={(e) => setForceRegenerate(e.target.checked)}
          className="rounded border-line"
        />
        Regenerate for players who already have accounts
      </label>

      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          onClick={handleGenerate}
          disabled={loading || playerCount === 0}
          className="btn-primary text-sm"
        >
          {loading ? (
            <>
              <span className="block w-4 h-4 bg-surface-2 rounded animate-pulse" /> Generating...
            </>
          ) : (
            <>
              <KeyRound size={16} /> Generate Player Credentials
            </>
          )}
        </button>
        {exportable.length > 0 && (
          <button
            type="button"
            onClick={() => downloadCredentialsCsv(exportable)}
            className="btn-ghost text-sm"
          >
            <FileDown size={16} /> Export CSV
          </button>
        )}
      </div>

      {summary && (
        <div className="bg-brand/10 rounded-lg p-4 text-sm space-y-2">
          <p className="font-semibold text-brand flex items-center gap-2">
            <CheckCircle size={16} />
            Generation complete
          </p>
          <p>
            Created: {summary.created} &middot; Regenerated: {summary.regenerated} &middot;
            Skipped: {summary.skipped}
            {summary.failed > 0 && (
              <>
                {" "}
                &middot; <span className="text-danger">Failed: {summary.failed}</span>
              </>
            )}
          </p>
          {exportable.length > 0 && (
            <p className="text-xs text-muted">
              Download the CSV now — passwords are only shown at generation time.
            </p>
          )}
        </div>
      )}

      {exportable.length > 0 && (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-muted border-b border-line">
                <th className="py-2 pr-3">Player</th>
                <th className="py-2 pr-3">Username</th>
                <th className="py-2">Password</th>
              </tr>
            </thead>
            <tbody>
              {exportable.map((row) => (
                <tr key={`${row.playerId}-${row.username}`} className="border-b border-line/50">
                  <td className="py-2 pr-3">{row.playerName}</td>
                  <td className="py-2 pr-3 font-mono text-xs">{row.username}</td>
                  <td className="py-2 font-mono text-xs">{row.password}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
