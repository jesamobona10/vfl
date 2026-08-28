"use client";

import { useEffect, useRef } from "react";
import { useAppStore } from "@/lib/store";
import type { SessionResult } from "@/lib/auth/session-resolver";

/**
 * Client-side receiver for the server-resolved session (from AuthBootstrap).
 * On first mount it seeds the store with the SSR hint and marks auth as
 * loaded, skipping the /api/auth/session network request that previously
 * gated first paint for authenticated users.
 *
 * When the server resolved no session, the store is left in its default
 * authLoading state so whichever consumer calls initializeAuth (currently the
 * AppShell mount effect) runs the normal client fetch.
 */
export function AuthHydration({ session }: { session: SessionResult }) {
  const applyServerSession = useAppStore((s) => s.applyServerSession);
  const hydrated = useRef(false);

  useEffect(() => {
    if (hydrated.current) return;
    hydrated.current = true;
    applyServerSession(session);
  }, [session, applyServerSession]);

  return null;
}