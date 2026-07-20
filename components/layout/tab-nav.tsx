"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useAppStore } from "@/lib/store";
import {
  LayoutDashboard,
  Calendar,
  Trophy,
  Users,
  UserCog,
  Shield,
  BarChart3,
  Radio,
  Swords,
  LayoutList,
} from "lucide-react";

interface Tab {
  href: string;
  label: string;
  icon: typeof LayoutDashboard;
  adminOnly?: boolean;
  orgOnly?: boolean;
}

const tabs: Tab[] = [
  { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard, orgOnly: true },
  { href: "/competitions", label: "Competitions", icon: LayoutList, orgOnly: true },
  { href: "/live", label: "Live", icon: Radio },
  { href: "/fixtures", label: "Fixtures", icon: Calendar },
  { href: "/knockout", label: "Knockout", icon: Swords },
  { href: "/standings", label: "Standings", icon: Trophy },
  { href: "/teams", label: "Teams", icon: Users },
  { href: "/players", label: "Players", icon: UserCog },
  { href: "/admin", label: "Admin", icon: Shield, adminOnly: true },
  { href: "/reports", label: "Reports", icon: BarChart3 },
];

const teamAccountHidden = new Set(["/teams", "/reports", "/players"]);
const playerAccountHidden = new Set(["/teams", "/reports", "/players", "/admin"]);

export function TabNav() {
  const pathname = usePathname();
  const isAdmin = useAppStore((s) => s.isAdmin);
  const currentTeamAccount = useAppStore((s) => s.currentTeamAccount);
  const isPlayer = useAppStore((s) => s.userProfile?.role === "player");
  const currentOrg = useAppStore((s) => s.currentOrg);

  const isOrgRoute = pathname.startsWith("/org/") && currentOrg;
  const orgSlug = currentOrg?.slug;

  return (
    <nav className="bg-surface border-b border-line px-6">
      <div className="flex gap-1 overflow-x-auto">
        {tabs.map((tab) => {
          if (tab.adminOnly && !isAdmin) return null;
          if (tab.orgOnly && !isOrgRoute) return null;
          if (isPlayer && playerAccountHidden.has(tab.href)) return null;
          if (currentTeamAccount && teamAccountHidden.has(tab.href)) return null;

          const resolvedHref = isOrgRoute && orgSlug
            ? `/org/${orgSlug}${tab.href === "/dashboard" ? "/dashboard" : tab.href}`
            : tab.href;

          const isActive = tab.href === "/competitions"
            ? pathname.startsWith(resolvedHref + "/") || pathname === resolvedHref
            : pathname === resolvedHref;

          const Icon = tab.icon;
          return (
            <Link
              key={tab.href}
              href={resolvedHref}
              className={`flex items-center gap-2 px-4 py-3 text-sm font-medium border-b-2 transition-colors whitespace-nowrap ${
                isActive
                  ? "border-brand text-brand"
                  : "border-transparent text-muted hover:text-text hover:border-line"
              }`}
            >
              <Icon size={16} />
              {tab.label}
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
