"use client";

import { useEffect, useRef, useState } from "react";
import { Bell, BellOff, LoaderCircle } from "lucide-react";
import type { PublicPreferences } from "@/lib/public-preferences";

const ANDROID_HINT_KEY = "lf-android-banner-hint-dismissed-at";
const ANDROID_HINT_COOLDOWN_MS = 30 * 24 * 60 * 60 * 1000;

function isIosDevice() {
  return /iPad|iPhone|iPod/.test(navigator.userAgent) ||
    (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);
}

function isAndroidDevice() {
  return /Android/i.test(navigator.userAgent);
}

function isStandaloneApp() {
  return window.matchMedia("(display-mode: standalone)").matches ||
    (navigator as Navigator & { standalone?: boolean }).standalone === true;
}

function decodeApplicationServerKey(base64Url: string) {
  const padding = "=".repeat((4 - (base64Url.length % 4)) % 4);
  const base64 = (base64Url + padding).replace(/-/g, "+").replace(/_/g, "/");
  const raw = window.atob(base64);
  return Uint8Array.from(raw, (character) => character.charCodeAt(0));
}

function hasCurrentApplicationKey(subscription: PushSubscription, publicKey: string) {
  const currentKey = subscription.options.applicationServerKey;
  if (!currentKey) return true;
  const current = Array.from(new Uint8Array(currentKey));
  const expected = Array.from(decodeApplicationServerKey(publicKey));
  return current.length === expected.length && current.every((byte, index) => byte === expected[index]);
}

export function PushSubscriptionControl({ preferences }: { preferences: PublicPreferences }) {
  const [publicKey, setPublicKey] = useState<string | null>(null);
  const [subscription, setSubscription] = useState<PushSubscription | null>(null);
  const [needsRefresh, setNeedsRefresh] = useState(false);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [showAndroidHint, setShowAndroidHint] = useState(false);
  const lastPreferencesRef = useRef<string | null>(null);

  const iosNeedsInstall = typeof window !== "undefined" && isIosDevice() && !isStandaloneApp();

  useEffect(() => {
    if (!isAndroidDevice()) return;
    const dismissedAt = Number(localStorage.getItem(ANDROID_HINT_KEY) || 0);
    if (dismissedAt && Date.now() - dismissedAt < ANDROID_HINT_COOLDOWN_MS) return;
    setShowAndroidHint(true);
  }, []);

  useEffect(() => {
    if (!("serviceWorker" in navigator) || !("PushManager" in window) || !("Notification" in window)) {
      return;
    }

    let mounted = true;
    Promise.all([
      fetch("/api/public/push-subscriptions").then(async (response) => {
        if (!response.ok) return null;
        const body = await response.json();
        return typeof body.publicKey === "string" ? body.publicKey : null;
      }),
      navigator.serviceWorker.ready.then((registration) => registration.pushManager.getSubscription()),
    ])
      .then(async ([key, current]) => {
        if (!mounted) return;
        setPublicKey(key);
        setSubscription(current);
        if (current && key) {
          const keyMatches = hasCurrentApplicationKey(current, key);
          let registered = true;
          try {
            const response = await fetch(`/api/public/push-subscriptions?endpoint=${encodeURIComponent(current.endpoint)}`, { cache: "no-store" });
            if (response.ok) registered = Boolean((await response.json()).registered);
          } catch {
            // Keep the local subscription state if the status check is offline.
          }
          if (mounted) setNeedsRefresh(!keyMatches || !registered);
        }
        setLoading(false);
      })
      .catch(() => {
        if (mounted) {
          setLoading(false);
          setMessage("Could not check alert settings. Check your connection and reload this page.");
        }
      });

    return () => {
      mounted = false;
    };
  }, []);

  useEffect(() => {
    if (!preferences) return;
    const preferencesKey = JSON.stringify(preferences);
    if (lastPreferencesRef.current === null) {
      lastPreferencesRef.current = preferencesKey;
      return;
    }
    if (lastPreferencesRef.current === preferencesKey) return;
    lastPreferencesRef.current = preferencesKey;
    if (!subscription || needsRefresh) return;
    void fetch("/api/public/push-subscriptions", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ...subscription.toJSON(), preferences }),
    }).then(async (response) => {
      if (!response.ok) {
        const body = await response.json().catch(() => ({}));
        setMessage(body.error || "Unable to save alert preferences.");
      }
    }).catch(() => setMessage("Unable to save alert preferences. Check your connection and try again."));
  }, [subscription, preferences, needsRefresh]);

  const toggleSubscription = async () => {
    if (busy || (!subscription && !publicKey)) return;
    setBusy(true);
    setMessage(null);
    try {
      if (subscription && !needsRefresh) {
        const endpoint = subscription.endpoint;
        await subscription.unsubscribe();
        await fetch("/api/public/push-subscriptions", {
          method: "DELETE",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ endpoint }),
        });
        setSubscription(null);
        setNeedsRefresh(false);
      } else {
        if (!publicKey) throw new Error("Push notifications are not configured.");
        // Keep the permission request directly inside the tap gesture; iOS
        // Safari can reject it if it happens after awaiting serviceWorker.ready.
        const permission = await Notification.requestPermission();
        if (permission !== "granted") {
          setMessage("Allow notifications in your browser settings to receive match alerts.");
          return;
        }
        if (subscription && needsRefresh) {
          const endpoint = subscription.endpoint;
          await subscription.unsubscribe();
          await fetch("/api/public/push-subscriptions", {
            method: "DELETE",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ endpoint }),
          }).catch(() => undefined);
          setSubscription(null);
          setNeedsRefresh(false);
        }
        await navigator.serviceWorker.register("/sw.js", { scope: "/" });
        const registration = await navigator.serviceWorker.ready;
        const created = await registration.pushManager.subscribe({
          userVisibleOnly: true,
          applicationServerKey: decodeApplicationServerKey(publicKey),
        });
        const response = await fetch("/api/public/push-subscriptions", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ ...created.toJSON(), preferences }),
        });
        if (!response.ok) {
          await created.unsubscribe();
          const body = await response.json().catch(() => ({}));
          throw new Error(body.error || "Unable to enable match alerts.");
        }
        setSubscription(created);
        setNeedsRefresh(false);
        // Android still needs a one-time channel change before alerts banner,
        // so surface the reminder while the choice is fresh.
        if (isAndroidDevice()) setShowAndroidHint(true);
      }
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Unable to update match alerts.");
    } finally {
      setBusy(false);
    }
  };

  const pushSupported = typeof window !== "undefined" && "serviceWorker" in navigator && "PushManager" in window && "Notification" in window;
  if (iosNeedsInstall) {
    return (
      <div className="rounded-xl border border-line bg-surface p-3 text-xs text-ink-2" role="status">
        <p className="font-semibold text-ink">Install LeagueForge to get iPhone match alerts</p>
        <p className="mt-1">In Safari, tap Share, choose <strong>Add to Home Screen</strong>, open LeagueForge from its Home Screen icon, then enable alerts here. iPhone web push requires iOS 16.4 or later.</p>
      </div>
    );
  }
  if (!pushSupported) {
    return <p className="text-xs text-ink-3" role="status">This browser does not support match alerts. On iPhone, open the installed Home Screen app.</p>;
  }
  if (loading) {
    return <div className="flex min-h-10 items-center gap-2 text-xs text-ink-3" role="status"><LoaderCircle size={14} className="animate-spin" /> Checking alert settings…</div>;
  }
  if (!publicKey && !subscription) {
    return <p className="text-xs text-ink-3" role="status">Match alerts are temporarily unavailable. Please try again later.</p>;
  }

  const permissionDenied = Notification.permission === "denied";
  return (
    <div className="flex flex-wrap items-center gap-3">
      <button
        type="button"
        onClick={toggleSubscription}
        disabled={busy || (!subscription && permissionDenied)}
        aria-pressed={Boolean(subscription && !needsRefresh)}
        className="btn-secondary inline-flex min-h-10 max-w-full items-center gap-2 whitespace-nowrap px-3 py-2 text-xs"
      >
        {subscription && !needsRefresh ? <BellOff size={15} /> : <Bell size={15} />}
        <span className="sm:hidden">{busy ? "Saving…" : needsRefresh ? "Refresh alerts" : subscription ? "Turn alerts off" : "Enable team alerts"}</span>
        <span className="hidden sm:inline">{busy ? "Saving…" : needsRefresh ? "Refresh match alerts" : subscription ? "Turn off match alerts" : "Enable alerts for my teams"}</span>
      </button>
      {needsRefresh && <p className="w-full text-xs text-ink-3" role="status">This browser’s saved alert connection is expired or uses an old key. Tap Refresh match alerts to reconnect it.</p>}
      {message && <p className="w-full text-xs text-ink-3" role="status">{message}</p>}
      {permissionDenied && (
        <p className="w-full text-xs text-ink-3" role="status">
          Notifications are blocked in this browser. Change its site permission to enable match alerts.
        </p>
      )}
      {subscription && showAndroidHint && (
        <div className="w-full rounded-xl border border-line bg-surface p-3 text-xs text-ink-2">
          <p className="font-semibold text-ink">Make alerts pop up on Android</p>
          <p className="mt-1">
            Android keeps alerts in the notification panel until the site channel is set to the
            highest importance. Open <strong>Settings &rarr; Apps &rarr; Chrome &rarr; Notifications &rarr; LeagueForge</strong>,
            then set <strong>Importance</strong> to the top level &mdash; <strong>Urgent</strong>, or
            <strong> High</strong> on some phones. Anything lower plays a sound but stays in the panel.
          </p>
          <button
            type="button"
            className="btn-secondary mt-3 px-3 py-1.5 text-xs"
            onClick={() => {
              localStorage.setItem(ANDROID_HINT_KEY, String(Date.now()));
              setShowAndroidHint(false);
            }}
          >
            Got it
          </button>
        </div>
      )}
    </div>
  );
}
