"use client";

import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import type { LucideIcon } from "lucide-react";
import { Shield } from "lucide-react";

export interface SidebarItem {
  href: string;
  label: string;
  icon: LucideIcon;
  /**
   * Optional trailing indicator. `"live"` renders a pulsing dot; a number
   * renders a count pill (hidden when 0).
   */
  badge?: "live" | number;
}

/** Shared trailing badge renderer for the desktop sidebar and mobile drawer. */
export function SidebarItemBadge({ badge, active }: { badge: SidebarItem["badge"]; active: boolean }) {
  if (badge === "live") {
    return (
      <span
        aria-hidden="true"
        className="ml-auto inline-block h-2 w-2 shrink-0 rounded-full bg-live-500 animate-pulse"
      />
    );
  }
  if (typeof badge === "number" && badge > 0) {
    return (
      <span
        className={`ml-auto inline-flex min-w-[20px] items-center justify-center rounded-full px-1.5 py-0.5 text-[11px] font-semibold ${
          active ? "bg-white/20 text-white" : "bg-live-tint text-live-500"
        }`}
      >
        {badge > 99 ? "99+" : badge}
      </span>
    );
  }
  return null;
}

interface SidebarProps {
  items: SidebarItem[];
  footer?: {
    title: string;
    subtitle: string;
    initials: string;
    tone?: "gold" | "brand";
  };
}

export function Sidebar({ items, footer }: SidebarProps) {
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const isActive = (item: SidebarItem) => {
    const search = searchParams.toString();
    const full = search ? `${pathname}?${search}` : pathname;
    if (item.href.includes("?")) {
      return full === item.href;
    }
    return pathname === item.href || pathname.startsWith(`${item.href}/`);
  };

  const footerTone = footer?.tone ?? "gold";
  const footerInitials = footer?.initials || "V";

  return (
    <aside className="hidden lg:flex w-[232px] shrink-0 bg-panel border-r border-line flex-col min-h-screen sticky top-0 h-screen">
      <Link href="/" className="flex items-center gap-2.5 px-5 py-5 border-b border-line">
        <div className="w-8 h-8 rounded-lg bg-brand-600 text-white flex items-center justify-center font-bold text-sm shrink-0">
          V
        </div>
        <div className="min-w-0">
          <div className="text-[13.5px] font-semibold leading-tight">LeagueForge</div>
          <div className="text-xs text-ink-3 mt-0.5">School league management</div>
        </div>
      </Link>

      <nav className="flex-1 px-3 py-3 flex flex-col gap-0.5 overflow-y-auto">
        {items.map((item) => {
          const Icon = item.icon;
          const active = isActive(item);
          return (
            <Link
              key={item.href}
              href={item.href}
              className={`flex items-center gap-2.5 px-3 py-2 rounded-lg text-[13.5px] font-medium transition-colors ${
                active ? "bg-brand-600 text-white" : "text-ink-2 hover:bg-brand-50 hover:text-ink"
              }`}
            >
              <Icon size={16} className="shrink-0" />
              {item.label}
              <SidebarItemBadge badge={item.badge} active={active} />
            </Link>
          );
        })}
      </nav>

      {footer && (
        <div className="px-3 py-3.5 border-t border-line">
          <div className="flex items-center gap-2.5 px-2 py-2 rounded-lg hover:bg-page transition-colors">
            <div
              className={`w-[30px] h-[30px] rounded-lg flex items-center justify-center font-semibold text-xs shrink-0 ${
                footerTone === "gold" ? "bg-gold-tint text-gold-700" : "bg-brand-100 text-brand-700"
              }`}
            >
              {footerInitials}
            </div>
            <div className="min-w-0">
              <div className="text-[12.5px] font-semibold leading-tight truncate">
                {footer.title}
              </div>
              <div className="text-xs text-ink-3 mt-0.5 truncate">{footer.subtitle}</div>
            </div>
          </div>
        </div>
      )}

      {!footer && (
        <div className="px-3 py-3.5 border-t border-line flex items-center gap-2.5 px-2 py-2">
          <Shield size={14} className="text-ink-3" />
          <span className="text-xs text-ink-3">v1.0</span>
        </div>
      )}
    </aside>
  );
}
