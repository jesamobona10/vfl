"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useAppStore } from "@/lib/store";
import { Shield, User, LogIn, AlertCircle, UserCog } from "lucide-react";

type LoginMode = "admin" | "team" | "player";

export function LoginForm() {
  const [mode, setMode] = useState<LoginMode>("team");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [adminEmail, setAdminEmail] = useState("");
  const [adminPassword, setAdminPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const router = useRouter();
  const loginTeamAccount = useAppStore((s) => s.loginTeamAccount);
  const loginAdmin = useAppStore((s) => s.loginAdmin);
  const loginPlayer = useAppStore((s) => s.loginPlayer);

  const handleTeamLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);
    const result = await loginTeamAccount(username, password);
    setLoading(false);
    if (result.error) setError(result.error);
    else router.push("/");
  };

  const handlePlayerLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);
    const result = await loginPlayer(username.toUpperCase(), password);
    setLoading(false);
    if (result.error) setError(result.error);
    else router.push("/");
  };

  const handleAdminLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);
    const result = await loginAdmin(adminEmail, adminPassword);
    setLoading(false);
    if (result.error) setError(result.error);
    else router.push("/");
  };

  return (
    <div className="w-full max-w-md">
      <div className="text-center mb-8">
        <Shield className="mx-auto text-brand" size={48} />
        <h1 className="text-2xl font-bold mt-4">VUNA Football League</h1>
        <p className="text-muted mt-1">Sign in to manage the league</p>
      </div>

      <div className="card p-6">
        <div className="flex gap-1 bg-surface-2 rounded-lg p-1 mb-6">
          <button
            type="button"
            onClick={() => {
              setMode("team");
              setError("");
            }}
            className={`flex-1 py-2 text-xs sm:text-sm font-medium rounded-md transition-colors ${
              mode === "team"
                ? "bg-surface shadow-sm text-text"
                : "text-muted hover:text-text"
            }`}
          >
            <User size={16} className="inline mr-1" />
            Team
          </button>
          <button
            type="button"
            onClick={() => {
              setMode("player");
              setError("");
            }}
            className={`flex-1 py-2 text-xs sm:text-sm font-medium rounded-md transition-colors ${
              mode === "player"
                ? "bg-surface shadow-sm text-text"
                : "text-muted hover:text-text"
            }`}
          >
            <UserCog size={16} className="inline mr-1" />
            Player
          </button>
          <button
            type="button"
            onClick={() => {
              setMode("admin");
              setError("");
            }}
            className={`flex-1 py-2 text-xs sm:text-sm font-medium rounded-md transition-colors ${
              mode === "admin"
                ? "bg-surface shadow-sm text-text"
                : "text-muted hover:text-text"
            }`}
          >
            <Shield size={16} className="inline mr-1" />
            Admin
          </button>
        </div>

        {error && (
          <div className="flex items-center gap-2 text-sm text-danger bg-danger/10 rounded-lg px-3 py-2 mb-4">
            <AlertCircle size={16} />
            {error}
          </div>
        )}

        {mode === "team" ? (
          <form onSubmit={handleTeamLogin} className="space-y-4">
            <div>
              <label className="block text-sm font-medium mb-1">Username</label>
              <input
                type="text"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                className="input"
                placeholder="e.g. TEAM-001"
                required
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">Password</label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="input"
                placeholder="Enter your password"
                required
              />
            </div>
            <button
              type="submit"
              className="btn-primary w-full"
              disabled={loading}
            >
              <LogIn size={16} />
              {loading ? "Signing in..." : "Sign In"}
            </button>
            <p className="text-center text-xs text-muted">
              Contact your league administrator if you don&apos;t have an
              account.
            </p>
          </form>
        ) : mode === "player" ? (
          <form onSubmit={handlePlayerLogin} className="space-y-4">
            <div>
              <label className="block text-sm font-medium mb-1">Username</label>
              <input
                type="text"
                value={username}
                onChange={(e) => setUsername(e.target.value.toUpperCase())}
                className="input font-mono"
                placeholder="e.g. MESSI_VOXMACHINA_001"
                required
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">Password</label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="input"
                placeholder="e.g. MESSI_001"
                required
              />
            </div>
            <button
              type="submit"
              className="btn-primary w-full"
              disabled={loading}
            >
              <LogIn size={16} />
              {loading ? "Signing in..." : "Sign In as Player"}
            </button>
          </form>
        ) : (
          <form onSubmit={handleAdminLogin} className="space-y-4">
            <div>
              <label className="block text-sm font-medium mb-1">Email</label>
              <input
                type="email"
                value={adminEmail}
                onChange={(e) => setAdminEmail(e.target.value)}
                className="input"
                placeholder="admin@vfl.league"
                required
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">Password</label>
              <input
                type="password"
                value={adminPassword}
                onChange={(e) => setAdminPassword(e.target.value)}
                className="input"
                placeholder="Enter admin password"
                required
              />
            </div>
            <button
              type="submit"
              className="btn-primary w-full"
              disabled={loading}
            >
              <Shield size={16} />
              {loading ? "Signing in..." : "Sign In as Admin"}
            </button>
          </form>
        )}
      </div>
    </div>
  );
}
