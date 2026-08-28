"use client";

import { useEffect, useRef } from "react";
import { useAppStore } from "@/lib/store";
import type { DataResult } from "@/lib/auth/data-resolver";

/**
 * Client-side receiver for the server-resolved org data (from DataBootstrap).
 * On first mount it seeds the store with the SSR hint and marks team data as
 * loaded, skipping the client-side refreshOrgData/refreshAdminData fetches
 * that previously delayed content render for authenticated org admins.
 */
export function DataHydration({ data }: { data: DataResult }) {
  const applyServerData = useAppStore((s) => s.applyServerData);
  const hydrated = useRef(false);

  useEffect(() => {
    if (hydrated.current) return;
    hydrated.current = true;
    applyServerData(data);
  }, [data, applyServerData]);

  return null;
}