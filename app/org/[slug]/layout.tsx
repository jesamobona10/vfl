"use client";

import { useEffect, useRef, useState } from "react";
import { useParams } from "next/navigation";
import { useAppStore } from "@/lib/store";
import { AppHeader } from "@/components/layout/app-header";
import { TabNav } from "@/components/layout/tab-nav";
import { SearchModal } from "@/components/search/search-modal";

export default function OrgLayout({ children }: { children: React.ReactNode }) {
  const params = useParams();
  const slug = params.slug as string;
  const currentOrg = useAppStore((s) => s.currentOrg);
  const fetchOrgBySlug = useAppStore((s) => s.fetchOrgBySlug);
  const setCurrentOrg = useAppStore((s) => s.setCurrentOrg);
  const initialized = useRef(false);
  const [isSearchOpen, setSearchOpen] = useState(false);

  useEffect(() => {
    if (!initialized.current && slug) {
      initialized.current = true;
      fetchOrgBySlug(slug);
    }
  }, [slug, fetchOrgBySlug]);

  useEffect(() => {
    return () => {
      setCurrentOrg(null);
      initialized.current = false;
    };
  }, [slug, setCurrentOrg]);

  if (!currentOrg) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-bg">
        <div className="animate-spin w-6 h-6 border-2 border-brand border-t-transparent rounded-full" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-bg">
      <AppHeader onOpenSearch={() => setSearchOpen(true)} />
      <TabNav />
      <main className="max-w-7xl mx-auto px-4 sm:px-6 py-6">{children}</main>
      <SearchModal isOpen={isSearchOpen} onClose={() => setSearchOpen(false)} />
    </div>
  );
}
