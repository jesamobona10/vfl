"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Shield, AlertCircle, CheckCircle } from "lucide-react";

export default function ChangePasswordPage() {
  const router = useRouter();
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);

  const handleChange = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");

    if (newPassword !== confirmPassword) {
      setError("New passwords do not match.");
      return;
    }

    setLoading(true);
    try {
      const res = await fetch("/api/auth/change-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ currentPassword, newPassword }),
      });
      const data = await res.json();
      if (!res.ok || data.error) {
        setError(data.error || "Unable to change password. Please try again.");
        return;
      }
      setSuccess(true);
      const params = new URLSearchParams(window.location.search);
      const next = params.get("next");
      setTimeout(() => router.push(next && next.startsWith("/") ? next : "/"), 1200);
    } catch {
      setError("Connection error. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-bg p-4">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <Shield className="mx-auto text-brand" size={48} />
          <h1 className="text-2xl font-bold mt-4">Change Your Password</h1>
          <p className="text-muted mt-1">
            For security, you must set a new password before continuing.
          </p>
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
              <p className="text-sm text-muted mt-1">Redirecting you...</p>
            </div>
          ) : (
            <form onSubmit={handleChange} className="space-y-4">
              <div>
                <label className="block text-sm font-medium mb-1">Current Password</label>
                <input
                  type="password"
                  value={currentPassword}
                  onChange={(e) => setCurrentPassword(e.target.value)}
                  className="input"
                  required
                  autoComplete="current-password"
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">New Password</label>
                <input
                  type="password"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  className="input"
                  placeholder="Min 12 characters, uppercase, lowercase, number"
                  minLength={12}
                  required
                  autoComplete="new-password"
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">Confirm New Password</label>
                <input
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
