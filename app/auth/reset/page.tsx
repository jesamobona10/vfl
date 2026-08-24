"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Shield, AlertCircle, CheckCircle } from "lucide-react";
import { describeFetchError } from "@/lib/utils/error-message";

export default function ResetPasswordPage() {
  const router = useRouter();
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState("");
  const [success, setSuccess] = useState(false);
  const [loading, setLoading] = useState(false);

  // Recovery sessions are one-time: after a global sign-out the user must
  // sign in with the new password.
  const handleReset = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");

    if (password !== confirmPassword) {
      setError("Passwords do not match.");
      return;
    }

    setLoading(true);
    try {
      const res = await fetch("/api/auth/reset-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password }),
      });
      const data = await res.json();
      if (!res.ok || data.error) {
        setError(data.error || "Unable to update password. The link may have expired.");
        return;
      }
      setSuccess(true);
      setTimeout(() => router.push("/auth/login"), 2000);
    } catch (err) {
      setError(describeFetchError(err, "Connection error. Please try again."));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-bg p-4">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <Shield className="mx-auto text-brand" size={48} />
          <h1 className="text-2xl font-bold mt-4">Set a New Password</h1>
          <p className="text-muted mt-1">Choose a strong password for your account.</p>
        </div>

        <div className="card p-6">
          {error && (
            <div className="flex items-center gap-2 text-sm text-danger bg-danger/10 rounded-lg px-3 py-2 mb-4">
              <AlertCircle size={16} />
              {error}
            </div>
          )}

          {success ? (
            <div className="text-center py-4">
              <CheckCircle size={48} className="mx-auto text-brand mb-4" />
              <p className="font-semibold">Password updated!</p>
              <p className="text-sm text-muted mt-1">
                For security you&apos;ve been signed out everywhere. Redirecting to sign in...
              </p>
            </div>
          ) : (
            <form onSubmit={handleReset} className="space-y-4">
              <div>
                <label htmlFor="reset-password" className="block text-sm font-medium mb-1">New Password</label>
                <input
                  id="reset-password"
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="input"
                  placeholder="Min 12 characters, uppercase, lowercase, number"
                  minLength={12}
                  required
                  autoComplete="new-password"
                />
              </div>
              <div>
                <label htmlFor="reset-confirm" className="block text-sm font-medium mb-1">Confirm New Password</label>
                <input
                  id="reset-confirm"
                  type="password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  className="input"
                  minLength={12}
                  required
                  autoComplete="new-password"
                />
              </div>
              <button type="submit" className="btn-primary w-full" disabled={loading}>
                {loading ? "Updating..." : "Update Password"}
              </button>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}
