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
} from "lucide-react";

const tabs = [
  { href: "/", label: "Dashboard", icon: LayoutDashboard },
  { href: "/live", label: "Live", icon: Radio },
  { href: "/fixtures", label: "Fixtures", icon: Calendar },
  { href: "/standings", label: "Standings", icon: Trophy },
  { href: "/teams", label: "Teams", icon: Users },
  { href: "/players", label: "Players", icon: UserCog },
  { href: "/admin", label: "Admin", icon: Shield, adminOnly: true },
  { href: "/reports", label: "Reports", icon: BarChart3 },
];

const teamAccountHidden = new Set(["/teams", "/reports", "/players"]);
const playerAccountOnly = new Set(["/fixtures", "/standings", "/players"]);

export function TabNav() {
  const pathname = usePathname();
  const isAdmin = useAppStore((s) => s.isAdmin);
  const currentTeamAccount = useAppStore((s) => s.currentTeamAccount);
  const isPlayer = useAppStore((s) => s.userProfile?.role === "player");

  return (
    <nav className="bg-surface border-b border-line px-6">
      <div className="flex gap-1 overflow-x-auto">
        {tabs.map((tab) => {
          if (tab.adminOnly && !isAdmin) return null;
          if (isPlayer && !playerAccountOnly.has(tab.href)) return null;
          if (currentTeamAccount && teamAccountHidden.has(tab.href)) return null;
          const active = pathname === tab.href;
          const Icon = tab.icon;
          return (
            <Link
              key={tab.href}
              href={tab.href}
              className={`flex items-center gap-2 px-4 py-3 text-sm font-medium border-b-2 transition-colors whitespace-nowrap ${
                active
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
