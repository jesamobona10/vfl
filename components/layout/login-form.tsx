"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useAppStore } from "@/lib/store";
import { Building2, Users, LogIn, AlertCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { AuthShell } from "@/components/auth/auth-shell";
import { PasswordInput } from "@/components/auth/password-input";

type LoginMode = "team" | "org";

const STORAGE_KEY = "vfl-login-mode";

export function LoginForm() {
  const [mode, setMode] = useState<LoginMode>("org");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [orgEmail, setOrgEmail] = useState("");
  const [orgPassword, setOrgPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const router = useRouter();
  const loginTeamAccount = useAppStore((s) => s.loginTeamAccount);
  const loginOrgAdmin = useAppStore((s) => s.loginOrgAdmin);

  useEffect(() => {
    try {
      const saved = window.localStorage.getItem(STORAGE_KEY);
      if (saved === "team" || saved === "org") {
        // eslint-disable-next-line react-hooks/set-state-in-effect
        setMode(saved);
      }
    } catch {}
  }, []);

  const setModeAndPersist = (next: LoginMode) => {
    setMode(next);
    setError("");
    try {
      window.localStorage.setItem(STORAGE_KEY, next);
    } catch {}
  };

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

  const handleOrgLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);
    const result = await loginOrgAdmin(orgEmail, orgPassword);
    setLoading(false);
    if (result.error) setError(result.error);
    else if (result.slug) router.push(`/org/${result.slug}/dashboard`);
    else router.push(redirectAfterLogin());
  };

  return (
    <AuthShell title="Sign in" subtitle="Access your organization or team">
      <div
        role="tablist"
        aria-label="Sign in as"
        className="grid grid-cols-2 gap-1 bg-surface-2 rounded-lg p-1 mb-6"
      >
        <button
          type="button"
          role="tab"
          aria-selected={mode === "org"}
          onClick={() => setModeAndPersist("org")}
          className={`flex items-center justify-center gap-2 py-2 px-3 text-sm font-medium rounded-lg transition-colors ${
            mode === "org"
              ? "bg-surface shadow-sm text-text"
              : "text-muted hover:text-text"
          }`}
        >
          <Building2 size={16} />
          Organization
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={mode === "team"}
          onClick={() => setModeAndPersist("team")}
          className={`flex items-center justify-center gap-2 py-2 px-3 text-sm font-medium rounded-lg transition-colors ${
            mode === "team"
              ? "bg-surface shadow-sm text-text"
              : "text-muted hover:text-text"
          }`}
        >
          <Users size={16} />
          Team
        </button>
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

      {mode === "org" ? (
        <form onSubmit={handleOrgLogin} className="space-y-4">
          <Input
            label="Email"
            type="email"
            value={orgEmail}
            onChange={(e) => setOrgEmail(e.target.value)}
            placeholder="admin@example.com"
            required
            autoComplete="email"
          />
          <PasswordInput
            label="Password"
            value={orgPassword}
            onChange={(e) => setOrgPassword(e.target.value)}
            placeholder="Enter your password"
            required
            autoComplete="current-password"
          />
          <Button
            type="submit"
            loading={loading}
            leftIcon={<LogIn size={16} />}
            className="w-full"
          >
            Sign in as organization
          </Button>
          <div className="flex items-center justify-between text-xs text-muted">
            <a href="/auth/forgot" className="text-brand hover:underline">
              Forgot password?
            </a>
            <a href="/auth/register" className="text-brand hover:underline">
              Register your organization
            </a>
          </div>
        </form>
      ) : (
        <form onSubmit={handleTeamLogin} className="space-y-4">
          <Input
            label="Team username"
            type="text"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            placeholder="e.g. TEAM-001"
            required
            autoComplete="username"
          />
          <PasswordInput
            label="Password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="Enter your password"
            required
            autoComplete="current-password"
          />
          <Button
            type="submit"
            loading={loading}
            leftIcon={<LogIn size={16} />}
            className="w-full"
          >
            Sign in as team
          </Button>
          <p className="text-center text-xs text-muted">
            Team accounts are created by your organization admin
          </p>
        </form>
      )}
    </AuthShell>
  );
}
