"use client";

import { useState } from "react";
import { useAppStore } from "@/lib/store";
import { useParams } from "next/navigation";
import { Calendar, Swords, Loader2, Check, AlertCircle } from "lucide-react";

const statusOptions: { value: string; label: string }[] = [
  { value: "draft", label: "Draft" },
  { value: "active", label: "Active" },
  { value: "completed", label: "Completed" },
];

export default function CompetitionSettingsPage() {
  const params = useParams();
  const cId = params.cId as string;
  const slug = params.slug as string;
  const currentCompetition = useAppStore((s) => s.currentCompetition);
  const fetchCompetition = useAppStore((s) => s.fetchCompetition);

  const [status, setStatus] = useState<"draft" | "active" | "completed">(currentCompetition?.status ?? "draft");
  const [updating, setUpdating] = useState(false);
  const [message, setMessage] = useState<{
    type: "success" | "error";
    text: string;
  } | null>(null);

  if (!currentCompetition) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 size={24} className="animate-spin text-muted" />
      </div>
    );
  }

  const handleStatusChange = async () => {
    setUpdating(true);
    setMessage(null);
    try {
      const res = await fetch(`/api/competitions/${cId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status }),
      });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Failed to update status");
      }
      setMessage({ type: "success", text: "Status updated successfully." });
      fetchCompetition(cId);
    } catch (err: unknown) {
      setMessage({
        type: "error",
        text: err instanceof Error ? err.message : "Something went wrong",
      });
    } finally {
      setUpdating(false);
    }
  };

  const handleGenerateFixtures = async () => {
    setUpdating(true);
    setMessage(null);
    try {
      const res = await fetch(`/api/competitions/${cId}/generate-fixtures`, {
        method: "POST",
      });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Failed to generate fixtures");
      }
      setMessage({ type: "success", text: "Fixtures generated successfully." });
    } catch (err: unknown) {
      setMessage({
        type: "error",
        text: err instanceof Error ? err.message : "Something went wrong",
      });
    } finally {
      setUpdating(false);
    }
  };

  const handleGenerateKnockout = async () => {
    setUpdating(true);
    setMessage(null);
    try {
      const res = await fetch(`/api/competitions/${cId}/generate-knockout`, {
        method: "POST",
      });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Failed to generate knockout");
      }
      setMessage({ type: "success", text: "Knockout stage generated successfully." });
    } catch (err: unknown) {
      setMessage({
        type: "error",
        text: err instanceof Error ? err.message : "Something went wrong",
      });
    } finally {
      setUpdating(false);
    }
  };

  const isLeague = currentCompetition.type === "league";
  const canGenerateFixtures = isLeague && (status === "draft" || status === "active");

  return (
    <div className="max-w-xl space-y-6">
      <div className="card p-6 space-y-4">
        <h2 className="text-lg font-semibold">Competition Details</h2>
        <div className="grid grid-cols-2 gap-4 text-sm">
          <div>
            <span className="text-muted">Name</span>
            <p className="font-medium">{currentCompetition.name}</p>
          </div>
          <div>
            <span className="text-muted">Type</span>
            <p className="font-medium capitalize">{currentCompetition.type}</p>
          </div>
          <div>
            <span className="text-muted">Status</span>
            <p className="font-medium capitalize">{currentCompetition.status}</p>
          </div>
          <div>
            <span className="text-muted">Season</span>
            <p className="font-medium">{currentCompetition.season ?? "—"}</p>
          </div>
          <div className="col-span-2">
            <span className="text-muted">ID</span>
            <p className="font-medium text-xs font-mono">{currentCompetition.id}</p>
          </div>
        </div>
      </div>

      <div className="card p-6 space-y-4">
        <h2 className="text-lg font-semibold">Change Status</h2>
        <div className="flex items-end gap-3">
          <div className="flex-1">
            <label htmlFor="status" className="block text-sm font-medium mb-1">
              Status
            </label>
            <select
              id="status"
              value={status}
               onChange={(e) => setStatus(e.target.value as "draft" | "active" | "completed")}
              className="input w-full"
            >
              {statusOptions.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>
          </div>
          <button
            onClick={handleStatusChange}
            disabled={updating || status === currentCompetition.status}
            className="btn-primary flex items-center gap-2"
          >
            {updating ? <Loader2 size={14} className="animate-spin" /> : <Check size={14} />}
            Update
          </button>
        </div>
      </div>

      {canGenerateFixtures && (
        <div className="card p-6 space-y-4">
          <h2 className="text-lg font-semibold">Fixtures</h2>
          <p className="text-sm text-muted">
            Generate round-robin fixtures for all teams in this league.
          </p>
          <button
            onClick={handleGenerateFixtures}
            disabled={updating}
            className="btn-primary flex items-center gap-2"
          >
            {updating ? (
              <Loader2 size={14} className="animate-spin" />
            ) : (
              <Calendar size={14} />
            )}
            Generate Fixtures
          </button>
        </div>
      )}

      <div className="card p-6 space-y-4">
        <h2 className="text-lg font-semibold">Knockout Stage</h2>
        <p className="text-sm text-muted">
          Generate or regenerate the knockout bracket for this competition.
        </p>
        <button
          onClick={handleGenerateKnockout}
          disabled={updating}
          className="btn-primary flex items-center gap-2"
        >
          {updating ? (
            <Loader2 size={14} className="animate-spin" />
          ) : (
            <Swords size={14} />
          )}
          Generate Knockout
        </button>
      </div>

      {message && (
        <div
          className={`flex items-start gap-2 text-sm p-3 rounded-lg ${
            message.type === "success"
              ? "text-green-400 bg-green-500/10"
              : "text-danger bg-danger/10"
          }`}
        >
          {message.type === "success" ? (
            <Check size={16} className="mt-0.5 shrink-0" />
          ) : (
            <AlertCircle size={16} className="mt-0.5 shrink-0" />
          )}
          <span>{message.text}</span>
        </div>
      )}
    </div>
  );
}
