"use client";

import { useAppStore } from "@/lib/store";
import { Users, KeyRound, ShieldCheck } from "lucide-react";
import Link from "next/link";
import { Button } from "@/components/ui/button";

export default function TeamSettingsPage() {
  const currentTeamAccount = useAppStore((s) => s.currentTeamAccount);
  const teams = useAppStore((s) => s.teams);

  const team = teams.find((t) => t.id === currentTeamAccount?.teamId);

  return (
    <div className="space-y-6">
      <div className="page-head">
        <div>
          <p className="page-title">Account</p>
          <p className="page-sub">
            Team access details for {team?.name ?? "your team"}
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <div className="card p-5 space-y-3">
          <div className="flex items-center gap-2">
            <Users size={18} className="text-brand" />
            <h3 className="font-semibold">Team</h3>
          </div>
          <dl className="space-y-2 text-sm">
            <div className="flex items-center justify-between">
              <dt className="text-muted">Team</dt>
              <dd className="text-text">{team?.name ?? "-"}</dd>
            </div>
            <div className="flex items-center justify-between">
              <dt className="text-muted">Username</dt>
              <dd className="text-text font-mono">{currentTeamAccount?.username ?? "-"}</dd>
            </div>
          </dl>
        </div>

        <div className="card p-5 space-y-3">
          <div className="flex items-center gap-2">
            <KeyRound size={18} className="text-brand" />
            <h3 className="font-semibold">Security</h3>
          </div>
          <p className="text-sm text-muted">
            Change your password or sign out from other devices.
          </p>
          <Link href="/auth/change-password" className="btn-primary w-full sm:w-auto inline-flex items-center justify-center gap-2">
            Change password
          </Link>
        </div>
      </div>

      <div className="card p-4 flex items-start gap-2 text-sm text-muted">
        <ShieldCheck size={16} className="mt-0.5" />
        <p>
          To reset access or create a new team login, contact your organization
          admin from the Team Accounts page.
        </p>
      </div>
    </div>
  );
}
