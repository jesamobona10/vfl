"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useAppStore } from "@/lib/store";
import { createClient } from "@/lib/supabase/client";
import { Shield, User, LogIn, AlertCircle, UserCog } from "lucide-react";

type LoginMode = "team" | "player" | "admin" | "org";

/** Google's brand mark, kept inline to avoid pulling in a whole icon set. */
function GoogleMark() {
  return (
    <svg width="16" height="16" viewBox="0 0 18 18" aria-hidden="true" className="shrink-0">
      <path
        fill="#4285F4"
        d="M17.64 9.205c0-.638-.057-1.252-.164-1.841H9v3.482h4.844a4.14 4.14 0 0 1-1.797 2.715v2.258h2.909c1.702-1.567 2.684-3.878 2.684-6.614Z"
      />
      <path
        fill="#34A853"
        d="M9 18c2.43 0 4.467-.806 5.956-2.181l-2.909-2.258c-.806.54-1.835.859-3.047.859-2.344 0-4.328-1.585-5.037-3.714H.956v2.332A9 9 0 0 0 9 18Z"
      />
      <path
        fill="#FBBC05"
        d="M3.963 10.706A5.41 5.41 0 0 1 3.682 9c0-.593.102-1.17.281-1.706V4.962H.956A9 9 0 0 0 0 9c0 1.452.347 2.827.956 4.038l3.007-2.332Z"
      />
      <path
        fill="#EA4335"
        d="M9 3.58c1.322 0 2.508.454 3.441 1.346l2.581-2.581C13.464.892 11.426 0 9 0A9 9 0 0 0 .956 4.962l3.007 2.332C4.672 5.165 6.656 3.58 9 3.58Z"
      />
    </svg>
  );
}

export function LoginForm() {
  const [mode, setMode] = useState<LoginMode>("team");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [adminEmail, setAdminEmail] = useState("");
  const [adminPassword, setAdminPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);

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

  // Coaches are moving to Google Sign-In. The invite is redeemed server-side
  // during the next resolveSession, so there is nothing to submit here — the
  // user just needs an authenticated session with a verified email.
  const handleGoogleSignIn = async () => {
    setError("");
    setGoogleLoading(true);
    try {
      const supabase = createClient();
      const { error: oauthError } = await supabase.auth.signInWithOAuth({
        provider: "google",
        options: {
          redirectTo: `${window.location.origin}/auth/callback?next=${encodeURIComponent(
            redirectAfterLogin()
          )}`,
          scopes: "email profile",
        },
      });
      if (oauthError) {
        setError(oauthError.message);
        setGoogleLoading(false);
      }
      // On success the browser navigates to Google, so leave the button
      // disabled rather than resetting it.
    } catch {
      setError("Could not start Google sign-in. Please try again.");
      setGoogleLoading(false);
    }
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
        <div role="tablist" aria-label="Account type" className="grid grid-cols-2 sm:flex gap-1 bg-surface-2 rounded-lg p-1 mb-6">
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
              className={`flex-1 py-2 px-2 text-xs sm:text-sm font-medium rounded-md transition-colors whitespace-nowrap ${
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
          <div className="space-y-4">
            <button
              type="button"
              onClick={handleGoogleSignIn}
              disabled={googleLoading}
              className="btn-primary w-full"
            >
              <GoogleMark />
              {googleLoading ? "Redirecting to Google..." : "Sign in with Google"}
            </button>

            <div className="flex items-center gap-3 text-xs text-muted">
              <span className="h-px flex-1 bg-line" />
              <span>or use your team credentials</span>
              <span className="h-px flex-1 bg-line" />
            </div>

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
          </div>
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
