"use client";

import { useEffect, useState } from "react";
import { useAppStore } from "@/lib/store";
import { AlertCircle, MailCheck, Clock, ShieldCheck, Users } from "lucide-react";
import { SkeletonList } from "@/components/shared/skeleton";

interface Invite {
  id: string;
  email: string;
  role: string;
  claimed_at: string | null;
  created_at: string;
}

interface TeamAccount {
  id: string;
  display_name: string;
  username: string;
  role: string;
  created_at: string;
}

export default function TeamSettingsPage() {
  const currentTeamAccount = useAppStore((s) => s.currentTeamAccount);
  const teams = useAppStore((s) => s.teams);

  const [invites, setInvites] = useState<Invite[]>([]);
  const [accounts, setAccounts] = useState<TeamAccount[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const team = teams.find((t) => t.id === currentTeamAccount?.teamId);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch("/api/team/invites");
        const data = await res.json();
        if (cancelled) return;
        if (!res.ok) {
          setError(data.error || "Unable to load team access.");
          return;
        }
        setInvites(data.invites || []);
        setAccounts(data.accounts || []);
      } catch {
        if (!cancelled) setError("Unable to load team access.");
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const pending = invites.filter((i) => !i.claimed_at);

  return (
    <div className="space-y-6">
      <div className="page-head">
        <div>
          <p className="page-title">Team Settings</p>
          <p className="page-sub">
            Who can manage {team?.name ?? "your team"}
          </p>
        </div>
      </div>

      {error && (
        <div
          className="flex items-start gap-2 text-sm p-3 rounded-lg text-danger bg-danger/10"
          role="alert"
        >
          <AlertCircle size={16} className="mt-0.5 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      <section className="space-y-3">
        <h2 className="text-sm font-semibold text-ink-2 flex items-center gap-2">
          <Users size={16} />
          Current coaches ({accounts.length})
        </h2>
        {loading ? (
          <SkeletonList items={2} />
        ) : accounts.length === 0 ? (
          <div className="panel p-6 text-center text-ink-2 text-sm">No coaches assigned yet.</div>
        ) : (
          accounts.map((a) => (
            <div key={a.id} className="card p-4 flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-surface-2 flex items-center justify-center shrink-0">
                <ShieldCheck size={18} className="text-live-500" />
              </div>
              <div className="min-w-0">
                <p className="font-medium truncate">{a.display_name}</p>
                <p className="text-xs text-muted font-mono truncate">{a.username}</p>
              </div>
            </div>
          ))
        )}
      </section>

      <section className="space-y-3">
        <h2 className="text-sm font-semibold text-ink-2 flex items-center gap-2">
          <Clock size={16} />
          Pending invites ({pending.length})
        </h2>
        {loading ? (
          <SkeletonList items={2} />
        ) : pending.length === 0 ? (
          <div className="panel p-6 text-center text-ink-2 text-sm">
            No pending invites. Your organization admin can invite more coaches from Team Accounts.
          </div>
        ) : (
          pending.map((i) => (
            <div key={i.id} className="card p-4 flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-surface-2 flex items-center justify-center shrink-0">
                <MailCheck size={18} className="text-muted" />
              </div>
              <div className="min-w-0">
                <p className="font-medium font-mono text-sm truncate">{i.email}</p>
                <p className="text-xs text-muted capitalize">{i.role.replace("_", " ")}</p>
              </div>
            </div>
          ))
        )}
      </section>
    </div>
  );
}
