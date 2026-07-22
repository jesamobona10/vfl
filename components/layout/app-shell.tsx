"use client";

import { useEffect, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { useAppStore } from "@/lib/store";
import { refreshAdminData } from "@/lib/hooks/use-team-data";
import { AppHeader } from "./app-header";
import { LoginForm } from "./login-form";
import { SearchModal } from "../search/search-modal";

const publicPaths: Set<string> = new Set();

async function refreshOrgData(orgId?: string) {
  const store = useAppStore.getState();
  try {
    const params = orgId ? `?org_id=${orgId}` : "";
    const [teamsRes, playersRes] = await Promise.all([
      fetch(`/api/teams${params}`),
      fetch(`/api/players${params}`),
    ]);
    if (teamsRes.ok) {
      const data = await teamsRes.json();
      store.setTeams(data.teams || []);
    }
    if (playersRes.ok) {
      const data = await playersRes.json();
      store.setPlayers(data.players || []);
    }
    store.setTeamDataLoaded(true);
  } catch {
    store.setTeamDataLoaded(true);
  }
}

export function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const currentTeamAccount = useAppStore((s) => s.currentTeamAccount);
  const isAdmin = useAppStore((s) => s.isAdmin);
  const authLoading = useAppStore((s) => s.authLoading);
  const teamDataLoaded = useAppStore((s) => s.teamDataLoaded);
  const userProfile = useAppStore((s) => s.userProfile);
  const initializeAuth = useAppStore((s) => s.initializeAuth);
  const [fetchingAdminData, setFetchingAdminData] = useState(false);
  const [fetchingOrgData, setFetchingOrgData] = useState(false);
  const [isSearchOpen, setSearchOpen] = useState(false);
  const isPublicPath = publicPaths.has(pathname);
  const isPlayer = userProfile?.role === "player";
  const isOrgAdmin = userProfile?.role === "org_admin";
  const isAuthenticated = currentTeamAccount !== null || isAdmin || isPlayer || isOrgAdmin;

  const isOrgRoute = pathname.startsWith("/org/");

  useEffect(() => {
    initializeAuth();
  }, [initializeAuth]);

  useEffect(() => {
    if (isAdmin && !teamDataLoaded && !fetchingAdminData) {
      setFetchingAdminData(true);
      refreshAdminData().finally(() => setFetchingAdminData(false));
    }
  }, [isAdmin, teamDataLoaded, fetchingAdminData]);

  useEffect(() => {
    if (isOrgAdmin && !teamDataLoaded && !fetchingOrgData && !authLoading) {
      setFetchingOrgData(true);
      refreshOrgData(userProfile?.org?.id).finally(() => setFetchingOrgData(false));
    }
  }, [isOrgAdmin, teamDataLoaded, fetchingOrgData, authLoading, userProfile?.org?.id]);

  useEffect(() => {
    if (isOrgAdmin && !isOrgRoute && !authLoading) {
      const slug = userProfile?.org?.slug;
      if (slug) {
        router.replace(`/org/${slug}/dashboard`);
      }
    }
  }, [isOrgAdmin, isOrgRoute, authLoading, userProfile, router]);

  if (authLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-bg">
        <div className="w-6 h-6 bg-surface-2 rounded-lg animate-pulse" />
      </div>
    );
  }

  if (!isAuthenticated) {
    if (isPublicPath || pathname.startsWith("/auth/")) {
      return <>{children}</>;
    }
    return (
      <div className="min-h-screen flex items-center justify-center bg-bg p-4">
        <LoginForm />
      </div>
    );
  }

  if (isOrgRoute) {
    return <>{children}</>;
  }

  return (
    <div className="min-h-screen bg-bg">
      <AppHeader onOpenSearch={() => setSearchOpen(true)} />
      <main className="max-w-7xl mx-auto px-4 sm:px-6 py-6">{children}</main>
      <SearchModal isOpen={isSearchOpen} onClose={() => setSearchOpen(false)} />
    </div>
  );
}
