"use client";

import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { useOrg } from "@/lib/hooks/use-org";
import { useParams, useRouter } from "next/navigation";
import { ArrowLeft, AlertCircle } from "lucide-react";

export default function NewCompetitionPage() {
  const params = useParams();
  const router = useRouter();
  const queryClient = useQueryClient();
  const slug = params.slug as string;
  const { data: currentOrg } = useOrg(slug);

  const [name, setName] = useState("");
  const [type, setType] = useState<"league" | "cup" | "friendly">("league");
  const [season, setSeason] = useState("");
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");

    if (!name.trim()) {
      setError("Competition name is required.");
      return;
    }
    if (!currentOrg?.id) {
      setError("No organization selected.");
      return;
    }

    setSubmitting(true);
    try {
      const res = await fetch("/api/competitions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          organization_id: currentOrg.id,
          name: name.trim(),
          type,
          season: season.trim() || null,
        }),
      });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Failed to create competition");
      }
      const data = await res.json();
      const compId = data.competition?.id;
      queryClient.invalidateQueries({ queryKey: ["competitions"] });
      if (compId) {
        router.push(`/org/${slug}/competitions/${compId}`);
      } else {
        router.push(`/org/${slug}/competitions`);
      }
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="max-w-lg mx-auto space-y-6">
      <a
        href={`/org/${slug}/competitions`}
        className="inline-flex items-center gap-1 text-sm text-muted hover:text-text transition-colors"
      >
        <ArrowLeft size={14} />
        Back to competitions
      </a>

      <div>
        <h1 className="text-2xl font-bold">Create Competition</h1>
        <p className="text-sm text-muted">Set up a new league, cup, or friendly</p>
      </div>

      <form onSubmit={handleSubmit} className="card p-6 space-y-4">
        <div>
          <label htmlFor="name" className="block text-sm font-medium mb-1">
            Name
          </label>
          <input
            id="name"
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="e.g. VUNA Premier League"
            className="input w-full"
          />
        </div>

        <div>
          <label htmlFor="type" className="block text-sm font-medium mb-1">
            Type
          </label>
          <select
            id="type"
            value={type}
            onChange={(e) => setType(e.target.value as "league" | "cup" | "friendly")}
            className="input w-full"
          >
            <option value="league">League</option>
            <option value="cup">Cup</option>
            <option value="friendly">Friendly</option>
          </select>
        </div>

        <div>
          <label htmlFor="season" className="block text-sm font-medium mb-1">
            Season <span className="text-muted">(optional)</span>
          </label>
          <input
            id="season"
            type="text"
            value={season}
            onChange={(e) => setSeason(e.target.value)}
            placeholder="e.g. 2025/2026"
            className="input w-full"
          />
        </div>

        {error && (
          <div className="flex items-start gap-2 text-sm text-danger bg-danger/10 p-3 rounded-lg">
            <AlertCircle size={16} className="mt-0.5 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        <button
          type="submit"
          disabled={submitting}
          className="btn-primary w-full flex items-center justify-center gap-2"
        >
          {submitting ? <span className="block w-4 h-4 bg-surface-2 rounded animate-pulse" /> : null}
          {submitting ? "Creating..." : "Create Competition"}
        </button>
      </form>
    </div>
  );
}
