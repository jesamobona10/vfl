"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { LayoutDashboard, Calendar, Trophy, Users, Shield, UserCog } from "lucide-react";

interface OrgTab {
  href: string;
  label: string;
  icon: typeof LayoutDashboard;
}

const tabs: OrgTab[] = [
  { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { href: "/fixtures", label: "Fixtures", icon: Calendar },
  { href: "/standings", label: "Standings", icon: Trophy },
  { href: "/players", label: "Players", icon: Users },
  { href: "/teams", label: "Teams", icon: Shield },
  { href: "/team-accounts", label: "Team Accounts", icon: UserCog },
];

export function OrgNav({ orgSlug }: { orgSlug: string }) {
  const pathname = usePathname();

  return (
    <nav className="bg-surface border-b border-line px-6">
      <div className="flex gap-1 overflow-x-auto">
        {tabs.map((tab) => {
          const resolvedHref = `/org/${orgSlug}${tab.href}`;
          const isActive =
            tab.href === "/dashboard"
              ? pathname === resolvedHref
              : pathname.startsWith(resolvedHref);

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
