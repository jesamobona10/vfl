"use client";

import { Shield, LogOut } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useAppStore } from "@/lib/store";
import { AuthShell } from "@/components/auth/auth-shell";

export default function PlayerDisabledPage() {
  const logout = useAppStore((s) => s.logout);

  return (
    <AuthShell title="Player accounts unavailable" subtitle="Temporarily disabled">
      <div className="space-y-4 text-center">
        <p className="text-sm text-muted">
          Player accounts are temporarily unavailable. Please contact your
          organization admin for access.
        </p>
        <Button
          type="button"
          onClick={() => logout()}
          leftIcon={<LogOut size={16} />}
          className="w-full"
        >
          Sign out
        </Button>
      </div>
    </AuthShell>
  );
}
