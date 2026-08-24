"use client";

import { useCallback, useSyncExternalStore } from "react";
import { Moon, Sun } from "lucide-react";

const STORAGE_KEY = "lf-theme";

const listeners = new Set<() => void>();

/**
 * Light/dark switch. The actual theme class (.dark on <html>) is applied
 * pre-paint by an inline script in app/layout.tsx; this control reads and
 * flips it, persisting the explicit choice.
 */
export function ThemeToggle() {
  const dark = useSyncExternalStore(
    (cb) => {
      listeners.add(cb);
      return () => listeners.delete(cb);
    },
    () => document.documentElement.classList.contains("dark"),
    () => false
  );

  const toggle = useCallback(() => {
    const next = !document.documentElement.classList.contains("dark");
    document.documentElement.classList.toggle("dark", next);
    try {
      localStorage.setItem(STORAGE_KEY, next ? "dark" : "light");
    } catch {}
    listeners.forEach((cb) => cb());
  }, []);

  return (
    <button
      type="button"
      onClick={toggle}
      className="btn-icon"
      aria-label={dark ? "Switch to light mode" : "Switch to dark mode"}
      title={dark ? "Light mode" : "Dark mode"}
    >
      {dark ? <Sun size={17} /> : <Moon size={17} />}
    </button>
  );
}
