"use client";

import { useEffect, useState } from "react";
import { useAppStore } from "@/lib/store";
import { refreshAdminData } from "@/lib/hooks/use-team-data";
import { AppHeader } from "./app-header";
import { TabNav } from "./tab-nav";
import { LoginForm } from "./login-form";

export function AppShell({ children }: { children: React.ReactNode }) {
  const currentTeamAccount = useAppStore((s) => s.currentTeamAccount);
  const isAdmin = useAppStore((s) => s.isAdmin);
  const authLoading = useAppStore((s) => s.authLoading);
  const teamDataLoaded = useAppStore((s) => s.teamDataLoaded);
  const initializeAuth = useAppStore((s) => s.initializeAuth);
  const [fetchingAdminData, setFetchingAdminData] = useState(false);

  useEffect(() => {
    initializeAuth();
  }, [initializeAuth]);

  useEffect(() => {
    if (isAdmin && !teamDataLoaded && !fetchingAdminData) {
      setFetchingAdminData(true);
      refreshAdminData().finally(() => setFetchingAdminData(false));
    }
  }, [isAdmin, teamDataLoaded, fetchingAdminData]);

  if (authLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-bg">
        <div className="animate-spin w-6 h-6 border-2 border-brand border-t-transparent rounded-full" />
      </div>
    );
  }

  const isAuthenticated = currentTeamAccount !== null || isAdmin;

  if (!isAuthenticated) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-bg p-4">
        <LoginForm />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-bg">
      <AppHeader />
      <TabNav />
      <main className="max-w-7xl mx-auto px-6 py-6">{children}</main>
    </div>
  );
}
