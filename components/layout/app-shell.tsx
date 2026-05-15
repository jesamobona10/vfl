"use client";

import { useEffect } from "react";
import { useAppStore } from "@/lib/store";
import { AppHeader } from "./app-header";
import { TabNav } from "./tab-nav";
import { LoginForm } from "./login-form";

export function AppShell({ children }: { children: React.ReactNode }) {
  const currentTeamAccount = useAppStore((s) => s.currentTeamAccount);
  const isAdmin = useAppStore((s) => s.isAdmin);
  const authLoading = useAppStore((s) => s.authLoading);
  const initializeAuth = useAppStore((s) => s.initializeAuth);

  useEffect(() => {
    initializeAuth();
  }, [initializeAuth]);

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
