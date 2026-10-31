"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useAppStore } from "@/lib/store";
import { Shield, LogIn, AlertCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { AuthShell } from "@/components/auth/auth-shell";
import { PasswordInput } from "@/components/auth/password-input";

export default function AdminLoginPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const router = useRouter();
  const loginAdmin = useAppStore((s) => s.loginAdmin);

  const redirectAfterLogin = () => {
    if (typeof window === "undefined") return "/admin";
    const next = new URLSearchParams(window.location.search).get("next");
    if (next && next.startsWith("/admin") && !next.startsWith("//")) return next;
    return "/admin";
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);
    const result = await loginAdmin(email, password);
    setLoading(false);
    if (result.error) setError(result.error);
    else router.push(redirectAfterLogin());
  };

  return (
    <AuthShell title="Administrator sign in" subtitle="Super admin access">
      <form onSubmit={handleSubmit} className="space-y-4">
        {error && (
          <div
            className="flex items-center gap-2 text-sm text-danger bg-danger/10 rounded-lg px-3 py-2"
            role="alert"
          >
            <AlertCircle size={16} />
            {error}
          </div>
        )}
        <Input
          label="Email"
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="admin@vfl.league"
          required
          autoComplete="email"
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
          Sign in
        </Button>
        <p className="text-center text-xs text-muted">
          <a href="/auth/forgot" className="text-brand hover:underline">
            Forgot password?
          </a>
        </p>
      </form>
    </AuthShell>
  );
}
