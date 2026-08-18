"use client";

import { useAppStore } from "@/lib/store";

let redirecting = false;

function isPublicRequestPath(raw: string): boolean {
  let path = raw;
  try {
    path = new URL(raw, window.location.origin).pathname;
  } catch {
    // keep raw
  }
  if (!path.startsWith("/api/")) return true;
  if (path.startsWith("/api/auth/")) return true;
  if (path.startsWith("/api/public/")) return true;
  if (path === "/api/org/register") return true;
  return false;
}

function redirectToLogin() {
  if (typeof window === "undefined" || redirecting) return;
  redirecting = true;
  const current = window.location.pathname + window.location.search;
  const next =
    current && !current.startsWith("/auth/") ? `?next=${encodeURIComponent(current)}` : "";
  window.location.href = `/auth/login${next}`;
}

export function handleUnauthorized() {
  if (typeof window === "undefined" || redirecting) return;
  useAppStore.setState({
    currentTeamAccount: null,
    isAdmin: false,
    userProfile: null,
    teamDataLoaded: false,
    authLoading: false,
  });
  void fetch("/api/auth/logout", { method: "POST" }).catch(() => {});
  redirectToLogin();
}

export function installAuthGuard() {
  if (typeof window === "undefined") return;
  if ((window as any).__lfAuthGuardInstalled) return;
  (window as any).__lfAuthGuardInstalled = true;

  const originalFetch = window.fetch.bind(window);
  window.fetch = async (input, init) => {
    const res = await originalFetch(input, init);
    if (res.status === 401) {
      const raw =
        typeof input === "string"
          ? input
          : input instanceof Request
            ? input.url
            : input instanceof URL
              ? input.toString()
              : "";
      if (!isPublicRequestPath(raw)) handleUnauthorized();
    }
    return res;
  };
}
