"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Shield, AlertCircle, CheckCircle } from "lucide-react";

export default function SetupPage() {
  const router = useRouter();
  const [email, setEmail] = useState("admin@vfl.league");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [success, setSuccess] = useState(false);
  const [loading, setLoading] = useState(false);

  const handleSetup = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);

    try {
      const res = await fetch("/api/auth/admin-signup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
      });

      const data = await res.json();
      if (data.error) {
        setError(data.error);
      } else {
        setSuccess(true);
        setTimeout(() => router.push("/auth/login"), 2000);
      }
    } catch {
      setError("Connection error. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  if (success) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-bg p-4">
        <div className="card p-8 max-w-md w-full text-center">
          <CheckCircle size={48} className="mx-auto text-brand mb-4" />
          <h1 className="text-2xl font-bold mb-2">Admin Created!</h1>
          <p className="text-muted mb-4">
            You can now log in with your admin credentials.
          </p>
          <p className="text-sm text-muted">Redirecting to login...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-bg p-4">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <Shield className="mx-auto text-brand" size={48} />
          <h1 className="text-2xl font-bold mt-4">Setup Admin Account</h1>
          <p className="text-muted mt-1">
            Create the first super admin account
          </p>
        </div>

        <div className="card p-6">
          {error && (
            <div className="flex items-center gap-2 text-sm text-danger bg-danger/10 rounded-lg px-3 py-2 mb-4">
              <AlertCircle size={16} />
              {error}
            </div>
          )}

          <form onSubmit={handleSetup} className="space-y-4">
            <div>
              <label className="block text-sm font-medium mb-1">Email</label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="input"
                placeholder="admin@vfl.league"
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
                placeholder="Choose a strong password"
                minLength={6}
                required
              />
            </div>
            <button
              type="submit"
              className="btn-primary w-full"
              disabled={loading}
            >
              {loading ? (
                <>
                  <span className="block w-4 h-4 bg-surface-2 rounded animate-pulse" />
                  Creating...
                </>
              ) : (
                <>
                  <Shield size={16} />
                  Create Admin Account
                </>
              )}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
