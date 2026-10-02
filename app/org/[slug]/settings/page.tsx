"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { useOrg } from "@/lib/hooks/use-org";

export default function OrgSettingsPage() {
  const params = useParams();
  const slug = params.slug as string;
  const { data: currentOrg } = useOrg(slug);
  const [enabled, setEnabled] = useState(false);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => {
    if (currentOrg) setEnabled(!!currentOrg.public_player_names_enabled);
  }, [currentOrg]);

  const handleToggle = async () => {
    setSaving(true);
    setMessage(null);
    try {
      const res = await fetch(`/api/organizations/${slug}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ public_player_names_enabled: !enabled }),
      });
      if (!res.ok) throw new Error("Failed to save");
      setEnabled((e) => !e);
      setMessage("Saved");
    } catch {
      setMessage("Failed to save");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-6 p-4 sm:p-6">
      <div>
        <h2 className="text-lg font-semibold">Organization Settings</h2>
        <p className="text-sm text-muted">Manage public visibility preferences.</p>
      </div>
      <div className="card p-4 space-y-3">
        <div className="flex items-center justify-between gap-3">
          <div className="min-w-0">
            <p className="text-sm font-medium">Public player names</p>
            <p className="text-xs text-ink-3">
              Show player names in public match updates and alerts. Off by default.
            </p>
          </div>
          <button
            onClick={handleToggle}
            disabled={saving}
            className={`relative inline-flex h-6 w-11 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${
              enabled ? "bg-brand" : "bg-surface-2"
            }`}
            aria-label="Toggle public player names"
          >
            <span
              className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${
                enabled ? "translate-x-5" : "translate-x-0"
              }`}
            />
          </button>
        </div>
        {message && <p className="text-xs text-ink-3">{message}</p>}
      </div>
    </div>
  );
}
