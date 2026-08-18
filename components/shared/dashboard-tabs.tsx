"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";

export interface DashboardTab {
  key: string;
  label: string;
}

export function DashboardTabs({
  tabs,
  defaultKey = tabs[0]?.key ?? "",
}: {
  tabs: DashboardTab[];
  defaultKey?: string;
}) {
  const pathname = usePathname();
  const router = useRouter();
  const searchParams = useSearchParams();

  const active = searchParams.get("tab");
  const current = active && tabs.some((t) => t.key === active) ? active : defaultKey;

  const setTab = (key: string) => {
    const params = new URLSearchParams(searchParams.toString());
    params.set("tab", key);
    router.replace(`${pathname}?${params.toString()}`, { scroll: false });
  };

  return (
    <div className="flex gap-1 bg-surface-2 rounded-lg p-1 w-fit max-w-full overflow-x-auto">
      {tabs.map((tab) => (
        <button
          key={tab.key}
          onClick={() => setTab(tab.key)}
          className={`px-3 py-1.5 text-sm font-medium whitespace-nowrap rounded-md transition-colors ${
            current === tab.key ? "bg-surface shadow-sm" : "text-muted hover:text-text"
          }`}
        >
          {tab.label}
        </button>
      ))}
    </div>
  );
}
