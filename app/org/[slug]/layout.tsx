"use client";

import { useState } from "react";
import { useParams } from "next/navigation";
import { useOrg } from "@/lib/hooks/use-org";
import { AppHeader } from "@/components/layout/app-header";
import { SearchModal } from "@/components/search/search-modal";

export default function OrgLayout({ children }: { children: React.ReactNode }) {
  const params = useParams();
  const slug = params.slug as string;
  const { data: currentOrg, isLoading } = useOrg(slug);
  const [isSearchOpen, setSearchOpen] = useState(false);

  if (isLoading || !currentOrg) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-bg">
        <div className="animate-spin w-6 h-6 border-2 border-brand border-t-transparent rounded-full" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-bg">
      <AppHeader onOpenSearch={() => setSearchOpen(true)} />
      <main className="max-w-7xl mx-auto px-4 sm:px-6 py-6">{children}</main>
      <SearchModal isOpen={isSearchOpen} onClose={() => setSearchOpen(false)} />
    </div>
  );
}
