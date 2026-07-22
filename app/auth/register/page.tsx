"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Shield, AlertCircle, Check, School, Building2, Users } from "lucide-react";
import type { OrgType } from "@/lib/types";

type Step = "choose-type" | "details" | "done";

export default function RegisterPage() {
  const router = useRouter();
  const [step, setStep] = useState<Step>("choose-type");
  const [orgType, setOrgType] = useState<OrgType | null>(null);
  const [orgName, setOrgName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [createdOrg, setCreatedOrg] = useState<{ name: string; slug: string } | null>(null);

  const orgTypes: { type: OrgType; label: string; icon: typeof School; desc: string }[] = [
    { type: "school", label: "School", icon: School, desc: "Multiple teams, intra-school & inter-school competitions" },
    { type: "academy", label: "Football Academy", icon: Building2, desc: "Age-group teams, tournament participation" },
    { type: "club", label: "Amateur Club", icon: Users, desc: "Independent club with 1-3 teams" },
  ];

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);

    try {
      const res = await fetch("/api/org/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ orgName, orgType, email, password }),
      });
      const data = await res.json();
      if (data.error) {
        setError(data.error);
      } else {
        setCreatedOrg({ name: data.org.name, slug: data.org.slug });
        const loginRes = await fetch("/api/auth/org-login", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ email, password }),
        });
        if (loginRes.ok) {
          router.push(`/org/${data.org.slug}/dashboard`);
          return;
        }
        setStep("done");
      }
    } catch {
      setError("Connection error. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-bg p-4">
      <div className="w-full max-w-lg">
        <div className="text-center mb-8">
          <Shield className="mx-auto text-brand" size={48} />
          <h1 className="text-2xl font-bold mt-4">Create Your Organization</h1>
          <p className="text-muted mt-1">
            {step === "choose-type"
              ? "What type of organization are you?"
              : step === "details"
              ? "Set up your organization details"
              : "Your organization is ready!"}
          </p>
        </div>

        <div className="card p-6">
          {step === "choose-type" && (
            <div className="space-y-4">
              <p className="text-sm font-medium text-muted">Select your organization type:</p>
              {orgTypes.map(({ type, label, icon: Icon, desc }) => (
                <button
                  key={type}
                  onClick={() => { setOrgType(type); setStep("details"); }}
                  className="w-full flex items-start gap-4 p-4 rounded-xl border border-line hover:border-brand hover:bg-brand/5 transition-colors text-left"
                >
                  <div className="w-12 h-12 rounded-full bg-brand/10 flex items-center justify-center shrink-0">
                    <Icon size={24} className="text-brand" />
                  </div>
                  <div>
                    <p className="font-semibold">{label}</p>
                    <p className="text-sm text-muted">{desc}</p>
                  </div>
                </button>
              ))}
              <div className="pt-4 text-center">
                <button
                  onClick={() => router.push("/auth/login")}
                  className="text-sm text-muted hover:text-text underline"
                >
                  Already have an account? Sign in
                </button>
              </div>
            </div>
          )}

          {step === "details" && (
            <form onSubmit={handleRegister} className="space-y-4">
              <div className="flex items-center gap-2 text-sm text-muted mb-4">
                <button type="button" onClick={() => setStep("choose-type")} className="hover:text-text underline">
                  Back
                </button>
                <span>/</span>
                <span className="font-medium text-text capitalize">{orgType}</span>
              </div>

              {error && (
                <div className="flex items-center gap-2 text-sm text-danger bg-danger/10 rounded-lg px-3 py-2">
                  <AlertCircle size={16} />
                  {error}
                </div>
              )}

              <div>
                <label className="block text-sm font-medium mb-1">Organization Name</label>
                <input
                  type="text"
                  value={orgName}
                  onChange={(e) => setOrgName(e.target.value)}
                  className="input"
                  placeholder="e.g. St. Mary's School"
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-medium mb-1">Admin Email</label>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="input"
                  placeholder="admin@example.com"
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
                  placeholder="Min 12 characters, uppercase, lowercase, number"
                  minLength={12}
                  required
                />
                <p className="text-xs text-muted mt-1">
                  At least 12 characters with uppercase, lowercase, and a number.
                </p>
              </div>

              <button
                type="submit"
                className="btn-primary w-full"
                disabled={loading || !orgName || !email || !password}
              >
                {loading ? <span className="block w-4 h-4 bg-surface-2 rounded animate-pulse" /> : null}
                {loading ? "Creating..." : "Create Organization"}
              </button>
            </form>
          )}

          {step === "done" && createdOrg && (
            <div className="text-center space-y-4">
              <div className="w-16 h-16 rounded-full bg-brand/10 flex items-center justify-center mx-auto">
                <Check size={32} className="text-brand" />
              </div>
              <div>
                <h2 className="text-xl font-bold">{createdOrg.name}</h2>
                <p className="text-sm text-muted mt-1">
                  Your organization has been created. You are now the owner.
                </p>
              </div>
              <button
                onClick={() => router.push(`/org/${createdOrg.slug}/dashboard`)}
                className="btn-primary w-full"
              >
                Go to Dashboard
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
