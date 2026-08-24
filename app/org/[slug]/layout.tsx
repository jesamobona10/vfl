"use client";

import { useState } from "react";
import { useParams } from "next/navigation";
import { useOrg } from "@/lib/hooks/use-org";
import { useAppStore } from "@/lib/store";
import { AppHeader } from "@/components/layout/app-header";
import { Sidebar, type SidebarItem } from "@/components/layout/sidebar";
import { MobileNavDrawer } from "@/components/layout/mobile-nav-drawer";
import { SearchModal } from "@/components/search/search-modal";
import { LayoutDashboard, Trophy, Users, Shield, UserCog, Swords, ScrollText } from "lucide-react";

const tabs: SidebarItem[] = [
  { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { href: "/competitions", label: "Competitions", icon: Swords },
  { href: "/standings", label: "Standings", icon: Trophy },
  { href: "/players", label: "Players", icon: Users },
  { href: "/teams", label: "Teams", icon: Shield },
  { href: "/team-accounts", label: "Team Accounts", icon: UserCog },
  { href: "/audit-logs", label: "Audit Logs", icon: ScrollText },
];

/** Which nav sections each role may see. Org admins see everything. */
const NAV_BY_ROLE: Record<string, string[]> = {
  org_admin: ["/dashboard", "/competitions", "/standings", "/players", "/teams", "/team-accounts", "/audit-logs"],
  team_account: ["/dashboard", "/standings", "/players"],
  player: ["/dashboard", "/standings"],
};

export default function OrgLayout({ children }: { children: React.ReactNode }) {
  const params = useParams();
  const slug = params.slug as string;
  const { data: currentOrg, isLoading } = useOrg(slug);
  const userProfile = useAppStore((s) => s.userProfile);
  const currentTeamAccount = useAppStore((s) => s.currentTeamAccount);
  const [isSearchOpen, setSearchOpen] = useState(false);
  const [isDrawerOpen, setDrawerOpen] = useState(false);

  const roleLabel =
    currentTeamAccount != null
      ? "Team account"
      : userProfile?.role === "player"
        ? "Player"
        : userProfile?.orgRole
          ? userProfile.orgRole
          : "Organization admin";

  const role = currentTeamAccount != null ? "team_account" : (userProfile?.role ?? "org_admin");
  const allowed = NAV_BY_ROLE[role] ?? NAV_BY_ROLE.org_admin!;
  const items = tabs
    .filter((tab) => allowed.includes(tab.href))
    .map((tab) => ({
      ...tab,
      href: `/org/${slug}${tab.href}`,
    }));

  const footer = currentOrg
    ? {
        title: currentOrg.name,
        subtitle: roleLabel,
        initials: currentOrg.name.slice(0, 2).toUpperCase(),
        tone: "gold" as const,
      }
    : undefined;

  if (isLoading || !currentOrg) {
    return (
      <div className="min-h-screen flex bg-page">
        <div className="w-[232px] border-r border-line bg-panel p-5 space-y-3 shrink-0 hidden lg:block">
          <div className="w-8 h-8 bg-surface-2 rounded-lg animate-pulse" />
          <div className="h-3 w-32 bg-surface-2 rounded animate-pulse" />
          <div className="space-y-2 mt-6">
            {Array.from({ length: 5 }).map((_, i) => (
              <div key={i} className="h-8 w-full bg-surface-2 rounded-lg animate-pulse" />
            ))}
          </div>
        </div>
        <div className="flex-1 min-w-0 p-6 space-y-4">
          <div className="h-10 bg-surface-2 rounded-lg animate-pulse" />
          <div className="h-64 bg-surface-2 rounded-xl animate-pulse" />
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-page flex">
      <Sidebar items={items} footer={footer} />
      <div className="flex-1 min-w-0 flex flex-col">
        <AppHeader
          onOpenSearch={() => setSearchOpen(true)}
          onOpenMenu={() => setDrawerOpen(true)}
        />
        <main className="flex-1 px-4 sm:px-6 py-6">{children}</main>
      </div>
      <MobileNavDrawer
        items={items}
        footer={footer}
        isOpen={isDrawerOpen}
        onClose={() => setDrawerOpen(false)}
      />
      <SearchModal isOpen={isSearchOpen} onClose={() => setSearchOpen(false)} />
    </div>
  );
}
