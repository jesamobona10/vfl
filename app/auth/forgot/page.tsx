"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Shield, AlertCircle, CheckCircle } from "lucide-react";
import { describeFetchError } from "@/lib/utils/error-message";

export default function ForgotPasswordPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [sent, setSent] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      const res = await fetch("/api/auth/forgot-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      });
      const data = await res.json();
      if (!res.ok || data.error) {
        setError(data.error || "Unable to send reset email. Please try again.");
        return;
      }
      setSent(true);
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
          <h1 className="text-2xl font-bold mt-4">Reset Your Password</h1>
          <p className="text-muted mt-1">
            Enter your account email and we&apos;ll send you a reset link.
          </p>
        </div>

        <div className="card p-6">
          {error && (
            <div className="flex items-center gap-2 text-sm text-danger bg-danger/10 rounded-lg px-3 py-2 mb-4">
              <AlertCircle size={16} />
              {error}
            </div>
          )}

          {sent ? (
            <div className="text-center py-4">
              <CheckCircle size={48} className="mx-auto text-brand mb-4" />
              <p className="font-semibold">Check your inbox</p>
              <p className="text-sm text-muted mt-1">
                If an account exists for {email}, a password reset link has been sent.
              </p>
              <button
                onClick={() => router.push("/auth/login")}
                className="btn-primary w-full mt-6"
              >
                Back to Sign In
              </button>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label htmlFor="forgot-email" className="block text-sm font-medium mb-1">Email</label>
                <input
                  id="forgot-email"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="input"
                  placeholder="admin@example.com"
                  required
                />
              </div>
              <button type="submit" className="btn-primary w-full" disabled={loading}>
                {loading ? "Sending..." : "Send Reset Link"}
              </button>
              <p className="text-center text-xs text-muted">
                Remembered it?{" "}
                <a href="/auth/login" className="text-brand hover:underline">
                  Sign in
                </a>
              </p>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}
