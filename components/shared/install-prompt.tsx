"use client";

import { useEffect, useState } from "react";
import { Download, Share, X } from "lucide-react";

const DISMISSED_AT_KEY = "lf-install-prompt-dismissed-at";
const DISMISS_COOLDOWN_MS = 7 * 24 * 60 * 60 * 1000;

type InstallPromptEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed"; platform: string }>;
};

declare global {
  interface WindowEventMap {
    beforeinstallprompt: InstallPromptEvent;
  }
}

function isInstalled() {
  const standalone = window.matchMedia("(display-mode: standalone)").matches;
  const iosStandalone = (window.navigator as Navigator & { standalone?: boolean }).standalone === true;
  return standalone || iosStandalone;
}

function isIos() {
  const userAgent = navigator.userAgent;
  return /iPad|iPhone|iPod/.test(userAgent) ||
    (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);
}

export function InstallPrompt() {
  const [installEvent, setInstallEvent] = useState<InstallPromptEvent | null>(null);
  const [showIosHelp, setShowIosHelp] = useState(false);
  const [installed, setInstalled] = useState(false);

  useEffect(() => {
    if (!("serviceWorker" in navigator)) return;
    void navigator.serviceWorker.register("/sw.js", { scope: "/" }).catch((error) => {
      console.error("Service worker registration failed:", error);
    });
  }, []);

  useEffect(() => {
    if (isInstalled()) {
      return;
    }

    const dismissedAt = Number(localStorage.getItem(DISMISSED_AT_KEY) || 0);
    if (dismissedAt && Date.now() - dismissedAt < DISMISS_COOLDOWN_MS) return;

    const iosHelpTimer = isIos()
      ? window.setTimeout(() => setShowIosHelp(true), 0)
      : undefined;

    const handleBeforeInstall = (event: InstallPromptEvent) => {
      event.preventDefault();
      setInstallEvent(event);
    };
    const handleInstalled = () => {
      setInstalled(true);
      setInstallEvent(null);
      setShowIosHelp(false);
    };

    window.addEventListener("beforeinstallprompt", handleBeforeInstall);
    window.addEventListener("appinstalled", handleInstalled);
    return () => {
      if (iosHelpTimer !== undefined) window.clearTimeout(iosHelpTimer);
      window.removeEventListener("beforeinstallprompt", handleBeforeInstall);
      window.removeEventListener("appinstalled", handleInstalled);
    };
  }, []);

  const dismiss = () => {
    localStorage.setItem(DISMISSED_AT_KEY, String(Date.now()));
    setInstallEvent(null);
    setShowIosHelp(false);
  };

  const install = async () => {
    if (!installEvent) return;
    await installEvent.prompt();
    const choice = await installEvent.userChoice;
    setInstallEvent(null);
    if (choice.outcome === "accepted") setInstalled(true);
    else localStorage.setItem(DISMISSED_AT_KEY, String(Date.now()));
  };

  if (installed || (!installEvent && !showIosHelp)) return null;

  return (
    <aside
      className="fixed inset-x-3 bottom-3 z-[100] mx-auto flex max-w-lg items-start gap-3 rounded-xl border border-line bg-surface p-4 shadow-xl sm:inset-x-auto sm:bottom-5"
      aria-label="Install LeagueForge"
    >
      <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-brand/10 text-brand">
        {showIosHelp ? <Share size={19} /> : <Download size={19} />}
      </div>
      <div className="min-w-0 flex-1">
        <p className="text-sm font-semibold">Install LeagueForge</p>
        {showIosHelp ? (
          <p className="mt-1 text-xs text-ink-3">
            Tap the Share button, then choose <strong>Add to Home Screen</strong>.
          </p>
        ) : (
          <p className="mt-1 text-xs text-ink-3">Add the app to your home screen for quick access and match alerts.</p>
        )}
        {installEvent && (
          <button type="button" className="btn-primary mt-3 px-3 py-1.5 text-xs" onClick={install}>
            Install app
          </button>
        )}
      </div>
      <button
        type="button"
        onClick={dismiss}
        className="btn-icon -mr-2 -mt-2 h-8 w-8 shrink-0"
        aria-label="Dismiss install prompt"
      >
        <X size={16} />
      </button>
    </aside>
  );
}
