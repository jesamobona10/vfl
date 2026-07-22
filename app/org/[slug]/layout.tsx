"use client";

import { useState } from "react";
import { useParams } from "next/navigation";
import { useOrg } from "@/lib/hooks/use-org";
import { AppHeader } from "@/components/layout/app-header";
import { OrgNav } from "@/components/layout/org-nav";
import { SearchModal } from "@/components/search/search-modal";

export default function OrgLayout({ children }: { children: React.ReactNode }) {
  const params = useParams();
  const slug = params.slug as string;
  const { data: currentOrg, isLoading } = useOrg(slug);
  const [isSearchOpen, setSearchOpen] = useState(false);

  if (isLoading || !currentOrg) {
    return (
      <div className="min-h-screen space-y-4 p-6 bg-bg">
        <div className="flex items-center gap-3 mb-6">
          <div className="w-8 h-8 bg-surface-2 rounded-lg animate-pulse" />
          <div className="space-y-2 flex-1">
            <div className="h-5 w-48 bg-surface-2 rounded animate-pulse" />
            <div className="h-3 w-28 bg-surface-2 rounded animate-pulse" />
          </div>
        </div>
        <div className="flex gap-2">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="h-8 w-24 bg-surface-2 rounded-lg animate-pulse" />
          ))}
        </div>
        <div className="h-64 bg-surface-2 rounded-xl animate-pulse" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-bg">
      <AppHeader onOpenSearch={() => setSearchOpen(true)} />
      <OrgNav orgSlug={slug} />
      <main className="max-w-7xl mx-auto px-4 sm:px-6 py-6">{children}</main>
      <SearchModal isOpen={isSearchOpen} onClose={() => setSearchOpen(false)} />
    </div>
  );
}
