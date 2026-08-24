"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useAppStore } from "@/lib/store";
import { Shield, User, LogIn, AlertCircle, UserCog } from "lucide-react";

type LoginMode = "team" | "player" | "admin" | "org";

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
  const loginOrgAdmin = useAppStore((s) => s.loginOrgAdmin);

  const redirectAfterLogin = () => {
    if (typeof window === "undefined") return "/";
    const next = new URLSearchParams(window.location.search).get("next");
    if (next && next.startsWith("/") && !next.startsWith("//")) return next;
    return "/";
  };

  const handleTeamLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);
    const result = await loginTeamAccount(username, password);
    setLoading(false);
    if (result.error) setError(result.error);
    else if (result.slug) router.push(`/org/${result.slug}/dashboard`);
    else router.push(redirectAfterLogin());
  };

  const handlePlayerLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);
    const result = await loginPlayer(username.toUpperCase(), password);
    setLoading(false);
    if (result.error) setError(result.error);
    else router.push(redirectAfterLogin());
  };

  const handleAdminLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);
    const result = await loginAdmin(adminEmail, adminPassword);
    setLoading(false);
    if (result.error) setError(result.error);
    else router.push(redirectAfterLogin());
  };

  const handleOrgLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);
    const result = await loginOrgAdmin(adminEmail, adminPassword);
    setLoading(false);
    if (result.error) setError(result.error);
    else if (result.slug) router.push(`/org/${result.slug}/dashboard`);
    else router.push(redirectAfterLogin());
  };

  const tabs: Array<[LoginMode, string, typeof Shield]> = [
    ["team", "Team", User],
    ["player", "Player", UserCog],
    ["admin", "Super Admin", Shield],
    ["org", "Organization", Shield],
  ];

  return (
    <div className="w-full max-w-md">
      <div className="text-center mb-8">
        <Shield className="mx-auto text-brand" size={48} />
        <h1 className="text-2xl font-bold mt-4">LeagueForge</h1>
        <p className="text-muted mt-1">Sign in to manage the league</p>
      </div>

      <div className="card p-6">
        <div role="tablist" aria-label="Account type" className="flex gap-1 bg-surface-2 rounded-lg p-1 mb-6">
          {tabs.map(([value, label, Icon]) => (
            <button
              key={value}
              type="button"
              role="tab"
              aria-selected={mode === value}
              onClick={() => {
                setMode(value);
                setError("");
              }}
              className={`flex-1 py-2 text-xs sm:text-sm font-medium rounded-md transition-colors ${
                mode === value ? "bg-surface shadow-sm text-text" : "text-muted hover:text-text"
              }`}
            >
              <Icon size={16} className="inline mr-1" />
              {label}
            </button>
          ))}
        </div>

        {error && (
          <div
            className="flex items-center gap-2 text-sm text-danger bg-danger/10 rounded-lg px-3 py-2 mb-4"
            role="alert"
          >
            <AlertCircle size={16} />
            {error}
          </div>
        )}

        {mode === "team" ? (
          <form onSubmit={handleTeamLogin} className="space-y-4">
            <div>
              <label htmlFor="login-username" className="block text-sm font-medium mb-1">
                Username
              </label>
              <input
                id="login-username"
                type="text"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                className="input"
                placeholder="e.g. TEAM-001"
                required
                autoComplete="username"
              />
            </div>
            <div>
              <label htmlFor="login-password" className="block text-sm font-medium mb-1">
                Password
              </label>
              <input
                id="login-password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="input"
                placeholder="Enter your password"
                required
                autoComplete="current-password"
              />
            </div>
            <button type="submit" className="btn-primary w-full" disabled={loading}>
              <LogIn size={16} />
              {loading ? "Signing in..." : "Sign In"}
            </button>
            <p className="text-center text-xs text-muted">
              Don&apos;t have an account?{" "}
              <a href="/auth/register" className="text-brand hover:underline">
                Register your organization
              </a>
            </p>
          </form>
        ) : mode === "player" ? (
          <form onSubmit={handlePlayerLogin} className="space-y-4">
            <div>
              <label htmlFor="login-player-username" className="block text-sm font-medium mb-1">
                Username
              </label>
              <input
                id="login-player-username"
                type="text"
                value={username}
                onChange={(e) => setUsername(e.target.value.toUpperCase())}
                className="input font-mono"
                placeholder="e.g. MESSI_VOXMACHINA_001"
                required
                autoComplete="username"
              />
            </div>
            <div>
              <label htmlFor="login-player-password" className="block text-sm font-medium mb-1">
                Password
              </label>
              <input
                id="login-player-password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="input"
                placeholder="e.g. MESSI_001"
                required
                autoComplete="current-password"
              />
            </div>
            <button type="submit" className="btn-primary w-full" disabled={loading}>
              <LogIn size={16} />
              {loading ? "Signing in..." : "Sign In as Player"}
            </button>
          </form>
        ) : mode === "org" ? (
          <form onSubmit={handleOrgLogin} className="space-y-4">
            <div>
              <label htmlFor="login-email" className="block text-sm font-medium mb-1">
                Email
              </label>
              <input
                id="login-email"
                type="email"
                value={adminEmail}
                onChange={(e) => setAdminEmail(e.target.value)}
                className="input"
                placeholder="admin@example.com"
                required
                autoComplete="email"
              />
            </div>
            <div>
              <label htmlFor="login-org-password" className="block text-sm font-medium mb-1">
                Password
              </label>
              <input
                id="login-org-password"
                type="password"
                value={adminPassword}
                onChange={(e) => setAdminPassword(e.target.value)}
                className="input"
                placeholder="Enter your password"
                required
                autoComplete="current-password"
              />
            </div>
            <button type="submit" className="btn-primary w-full" disabled={loading}>
              <Shield size={16} />
              {loading ? "Signing in..." : "Sign In"}
            </button>
            <p className="text-center text-xs text-muted">
              Don&apos;t have an organization?{" "}
              <a href="/auth/register" className="text-brand hover:underline">
                Register your organization
              </a>
            </p>
            <p className="text-center text-xs text-muted">
              <a href="/auth/forgot" className="text-brand hover:underline">
                Forgot password?
              </a>
            </p>
          </form>
        ) : (
          <form onSubmit={handleAdminLogin} className="space-y-4">
            <div>
              <label htmlFor="login-admin-email" className="block text-sm font-medium mb-1">
                Email
              </label>
              <input
                id="login-admin-email"
                type="email"
                value={adminEmail}
                onChange={(e) => setAdminEmail(e.target.value)}
                className="input"
                placeholder="admin@vfl.league"
                required
                autoComplete="email"
              />
            </div>
            <div>
              <label htmlFor="login-admin-password" className="block text-sm font-medium mb-1">
                Password
              </label>
              <input
                id="login-admin-password"
                type="password"
                value={adminPassword}
                onChange={(e) => setAdminPassword(e.target.value)}
                className="input"
                placeholder="Enter admin password"
                required
                autoComplete="current-password"
              />
            </div>
            <button type="submit" className="btn-primary w-full" disabled={loading}>
              <Shield size={16} />
              {loading ? "Signing in..." : "Sign In as Admin"}
            </button>
            <p className="text-center text-xs text-muted">
              <a href="/auth/forgot" className="text-brand hover:underline">
                Forgot password?
              </a>
            </p>
          </form>
        )}
      </div>
    </div>
  );
}
