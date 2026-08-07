"use client";

import { useEffect, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { useAppStore } from "@/lib/store";
import { refreshAdminData } from "@/lib/hooks/use-team-data";
import { AppHeader } from "./app-header";
import { LoginForm } from "./login-form";
import { SearchModal } from "../search/search-modal";
import { Sidebar, type SidebarItem } from "./sidebar";
import {
  LayoutDashboard,
  Building2,
  Users,
  UserCog,
  Trophy,
  Calendar,
  KeyRound,
  ScrollText,
  FileDown,
} from "lucide-react";

const adminNav: SidebarItem[] = [
  { href: "/admin?tab=dashboard", label: "Dashboard", icon: LayoutDashboard },
  { href: "/admin?tab=orgs", label: "Organizations", icon: Building2 },
  { href: "/admin?tab=teams", label: "Teams", icon: Users },
  { href: "/admin?tab=players", label: "Players", icon: UserCog },
  { href: "/admin?tab=competitions", label: "Competitions", icon: Trophy },
  { href: "/admin?tab=fixtures", label: "Fixtures", icon: Calendar },
  { href: "/admin?tab=users", label: "Users", icon: KeyRound },
  { href: "/admin?tab=audit", label: "Audit", icon: ScrollText },
  { href: "/admin?tab=import", label: "Import", icon: FileDown },
];

const publicPaths: Set<string> = new Set();

async function refreshOrgData(orgId?: string) {
  const store = useAppStore.getState();
  try {
    const params = orgId ? `?org_id=${orgId}` : "";
    const [teamsRes, playersRes, fixturesRes] = await Promise.all([
      fetch(`/api/teams${params}`),
      fetch(`/api/players${params}`),
      fetch(`/api/fixtures${params}`),
    ]);
    if (teamsRes.ok) {
      const data = await teamsRes.json();
      store.setTeams(data.teams || []);
    }
    if (playersRes.ok) {
      const data = await playersRes.json();
      store.setPlayers(data.players || []);
    }
    if (fixturesRes.ok) {
      const data = await fixturesRes.json();
      store.setFixtures(data.fixtures || []);
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
    <div className="min-h-screen bg-bg flex">
      {isAdmin && (
        <Sidebar
          items={adminNav}
          footer={{
            title: "Super Admin",
            subtitle: "Full system management",
            initials: "SA",
            tone: "brand",
          }}
        />
      )}
      <div className="flex-1 min-w-0 flex flex-col">
        <AppHeader onOpenSearch={() => setSearchOpen(true)} />
        <main className="flex-1 px-4 sm:px-6 py-6">{children}</main>
      </div>
      <SearchModal isOpen={isSearchOpen} onClose={() => setSearchOpen(false)} />
    </div>
  );
}
