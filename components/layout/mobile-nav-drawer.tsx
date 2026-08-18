"use client";

import { useEffect, useRef } from "react";
import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import { X } from "lucide-react";
import type { SidebarItem } from "./sidebar";

interface MobileNavDrawerProps {
  items: SidebarItem[];
  footer?: {
    title: string;
    subtitle: string;
    initials: string;
    tone?: "gold" | "brand";
  };
  isOpen: boolean;
  onClose: () => void;
}

export function MobileNavDrawer({ items, footer, isOpen, onClose }: MobileNavDrawerProps) {
  const pathname = usePathname();
  const searchParams = useSearchParams();

  useEffect(() => {
    if (!isOpen) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [isOpen, onClose]);

  const lastPathname = useRef(pathname);
  useEffect(() => {
    if (isOpen && lastPathname.current !== pathname) {
      onClose();
    }
    lastPathname.current = pathname;
  }, [pathname, isOpen, onClose]);

  if (!isOpen) return null;

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
    <div
      className="fixed inset-0 z-50 lg:hidden"
      role="dialog"
      aria-modal="true"
      aria-label="Navigation"
    >
      <div className="fixed inset-0 bg-black/40" onClick={onClose} aria-hidden="true" />
      <aside className="fixed inset-y-0 left-0 w-[280px] max-w-[85vw] bg-white border-r border-line flex flex-col shadow-2xl">
        <div className="flex items-center gap-2.5 px-5 py-5 border-b border-line">
          <div className="w-8 h-8 rounded-lg bg-brand-600 text-white flex items-center justify-center font-bold text-sm shrink-0">
            V
          </div>
          <div className="min-w-0 flex-1">
            <div className="text-[13.5px] font-semibold leading-tight">LeagueForge</div>
            <div className="text-[11px] text-ink-3 mt-0.5">School league management</div>
          </div>
          <button onClick={onClose} className="btn-icon" aria-label="Close navigation">
            <X size={18} />
          </button>
        </div>

        <nav className="flex-1 px-3 py-3 flex flex-col gap-0.5 overflow-y-auto">
          {items.map((item) => {
            const Icon = item.icon;
            const active = isActive(item);
            return (
              <Link
                key={item.href}
                href={item.href}
                className={`flex items-center gap-2.5 px-3 py-3 rounded-lg text-[13.5px] font-medium transition-colors ${
                  active ? "bg-brand-600 text-white" : "text-ink-2 hover:bg-brand-50 hover:text-ink"
                }`}
              >
                <Icon size={16} className="shrink-0" />
                {item.label}
              </Link>
            );
          })}
        </nav>

        {footer && (
          <div className="px-3 py-3.5 border-t border-line">
            <div className="flex items-center gap-2.5 px-2 py-2 rounded-lg">
              <div
                className={`w-[30px] h-[30px] rounded-lg flex items-center justify-center font-semibold text-xs shrink-0 ${
                  footerTone === "gold"
                    ? "bg-gold-tint text-gold-700"
                    : "bg-brand-100 text-brand-700"
                }`}
              >
                {footerInitials}
              </div>
              <div className="min-w-0">
                <div className="text-[12.5px] font-semibold leading-tight truncate">
                  {footer.title}
                </div>
                <div className="text-[11px] text-ink-3 mt-0.5 truncate">{footer.subtitle}</div>
              </div>
            </div>
          </div>
        )}
      </aside>
    </div>
  );
}
