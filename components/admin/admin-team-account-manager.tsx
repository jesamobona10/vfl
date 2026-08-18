"use client";

import { useState, useEffect, useCallback } from "react";
import { useAppStore } from "@/lib/store";
import { useResolvedTeams } from "@/lib/hooks/use-resolved-teams";
import { AlertCircle, Shield, Eye, EyeOff, KeyRound } from "lucide-react";
import { PageSkeleton } from "@/components/shared/skeleton";

interface TeamAccountRow {
  id: string;
  username: string;
  display_name: string;
  team_id: number | null;
  role: string;
  created_at: string;
  teams: { name: string } | null;
}

/**
 * Admin component for managing team accounts (create login credentials for
 * team coaches/captains). Extracted from admin-panel.tsx for single-responsibility.
 */
export function AdminTeamAccountManager() {
  const currentSeasonId = useAppStore((s) => s.currentSeasonId);
  const teams = useResolvedTeams(currentSeasonId);
  const [accounts, setAccounts] = useState<TeamAccountRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedTeam, setSelectedTeam] = useState("");
  const [password, setPassword] = useState("");
  const [creating, setCreating] = useState(false);
  const [createResult, setCreateResult] = useState<{
    username?: string;
    password?: string;
    error?: string;
  } | null>(null);
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState("");

  const fetchAccounts = useCallback(async () => {
    try {
      const res = await fetch("/api/admin/team-accounts");
      const data = await res.json();
      if (res.ok) {
        setAccounts(data.accounts || []);
      } else {
        setError(data.error || "Failed to load team accounts.");
      }
    } catch {
      setError("Failed to load team accounts.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchAccounts();
  }, [fetchAccounts]);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setCreateResult(null);

    if (!selectedTeam || !password) return;
    if (password.length < 12) {
      setError("Password must be at least 12 characters.");
      return;
    }

    setCreating(true);
    try {
      const team = teams.find((t) => t.id === Number(selectedTeam));
      const res = await fetch("/api/admin/create-team-account", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          teamName: team?.name || "",
          password,
          teamId: Number(selectedTeam),
        }),
      });
      const data = await res.json();
      if (data.error) {
        setError(data.error);
      } else {
        setCreateResult({
          username: data.account.username,
          password,
        });
        setPassword("");
        setSelectedTeam("");
        fetchAccounts();
      }
    } catch {
      setError("Failed to create account.");
    } finally {
      setCreating(false);
    }
  };

  if (loading) return <PageSkeleton />;

  return (
    <div className="space-y-6">
      <div>
        <h3 className="text-lg font-bold mb-1">Team Accounts</h3>
        <p className="text-sm text-muted">
          Create login credentials for team coaches and captains.
        </p>
      </div>

      <div className="card p-5">
        <h4 className="text-sm font-semibold text-muted uppercase tracking-wider mb-4">
          Create New Account
        </h4>

        {error && (
          <div className="flex items-center gap-2 text-sm text-danger bg-danger/10 rounded-lg px-3 py-2 mb-4">
            <AlertCircle size={16} />
            {error}
          </div>
        )}

        {createResult ? (
          <div className="space-y-3">
            <div className="bg-brand/10 rounded-lg p-4 text-sm space-y-2">
              <p className="font-semibold text-brand">Account Created!</p>
              <p>
                <span className="font-medium">Username:</span>{" "}
                <code className="bg-bg px-2 py-0.5 rounded text-brand font-mono">
                  {createResult.username}
                </code>
              </p>
              <p>
                <span className="font-medium">Password:</span>{" "}
                <code className="bg-bg px-2 py-0.5 rounded text-brand font-mono">
                  {createResult.password}
                </code>
              </p>
            </div>
            <p className="text-xs text-muted">
              This is the only time the password is shown. Share these credentials with the team.
            </p>
            <button onClick={() => setCreateResult(null)} className="btn-primary text-sm">
              Create Another
            </button>
          </div>
        ) : (
          <form onSubmit={handleCreate} className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium mb-1">Team</label>
                <select
                  value={selectedTeam}
                  onChange={(e) => setSelectedTeam(e.target.value)}
                  className="input"
                  required
                >
                  <option value="">Select a team...</option>
                  {teams
                    .filter((t) => !accounts.some((a) => a.team_id === t.id))
                    .map((t) => (
                      <option key={t.id} value={t.id}>
                        {t.name}
                      </option>
                    ))}
                  {teams.every((t) => accounts.some((a) => a.team_id === t.id)) && (
                    <option disabled>All teams have accounts</option>
                  )}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">Password</label>
                <div className="relative">
                  <input
                    type={showPassword ? "text" : "password"}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="input w-full pr-10"
                    placeholder="Min 12 characters"
                    minLength={12}
                    required
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-2 top-1/2 -translate-y-1/2 text-muted hover:text-text"
                  >
                    {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                  </button>
                </div>
              </div>
            </div>
            <button
              type="submit"
              className="btn-primary"
              disabled={creating || !selectedTeam || !password}
            >
              {creating ? (
                <>
                  <span className="block w-4 h-4 bg-surface-2 rounded animate-pulse" /> Creating...
                </>
              ) : (
                <>
                  <KeyRound size={16} /> Create Account
                </>
              )}
            </button>
          </form>
        )}
      </div>

      <div>
        <h4 className="text-sm font-semibold text-muted uppercase tracking-wider mb-3">
          Existing Accounts ({accounts.length})
        </h4>

        {accounts.length === 0 ? (
          <p className="text-sm text-muted text-center py-8">No team accounts created yet.</p>
        ) : (
          <div className="space-y-2">
            {accounts.map((a) => (
              <div key={a.id} className="card px-4 py-3 flex items-center gap-3">
                <Shield size={16} className="text-muted shrink-0" />
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium truncate">{a.username}</p>
                  <p className="text-xs text-muted truncate">
                    {a.teams?.name || "No team"} &middot;{" "}
                    {new Date(a.created_at).toLocaleDateString()}
                  </p>
                </div>
                <span className="text-xs text-muted capitalize">{a.role}</span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
