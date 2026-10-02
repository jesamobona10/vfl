"use client";

import { useEffect, useState } from "react";
import { Bell, BellOff } from "lucide-react";
import type { PublicPreferences } from "@/lib/public-preferences";

function decodeApplicationServerKey(base64Url: string) {
  const padding = "=".repeat((4 - (base64Url.length % 4)) % 4);
  const base64 = (base64Url + padding).replace(/-/g, "+").replace(/_/g, "/");
  const raw = window.atob(base64);
  return Uint8Array.from(raw, (character) => character.charCodeAt(0));
}

export function PushSubscriptionControl({ preferences }: { preferences: PublicPreferences }) {
  const [publicKey, setPublicKey] = useState<string | null>(null);
  const [subscription, setSubscription] = useState<PushSubscription | null>(null);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

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
      .then(([key, current]) => {
        if (!mounted) return;
        setPublicKey(key);
        setSubscription(current);
      })
      .catch(() => {});

    return () => {
      mounted = false;
    };
  }, []);

  useEffect(() => {
    if (!subscription || !preferences) return;
    fetch("/api/public/push-subscriptions", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ...subscription.toJSON(), preferences }),
    }).catch(() => {});
  }, [subscription, preferences]);

  const toggleSubscription = async () => {
    if (!publicKey || busy) return;
    setBusy(true);
    setMessage(null);
    try {
      const registration = await navigator.serviceWorker.ready;
      if (subscription) {
        const endpoint = subscription.endpoint;
        await subscription.unsubscribe();
        await fetch("/api/public/push-subscriptions", {
          method: "DELETE",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ endpoint }),
        });
        setSubscription(null);
      } else {
        const permission = await Notification.requestPermission();
        if (permission !== "granted") {
          setMessage("Allow notifications in your browser settings to receive match alerts.");
          return;
        }
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
      }
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Unable to update match alerts.");
    } finally {
      setBusy(false);
    }
  };

  if (!publicKey) return null;

  const permissionDenied = Notification.permission === "denied";
  return (
    <div className="flex flex-wrap items-center gap-3">
      <button
        type="button"
        onClick={toggleSubscription}
        disabled={busy || permissionDenied}
        className="btn-secondary inline-flex items-center gap-2 px-3 py-2 text-xs"
      >
        {subscription ? <BellOff size={15} /> : <Bell size={15} />}
        {busy ? "Saving..." : subscription ? "Turn off match alerts" : "Enable alerts for my teams"}
      </button>
      {message && <p className="w-full text-xs text-ink-3" role="status">{message}</p>}
      {permissionDenied && (
        <p className="w-full text-xs text-ink-3" role="status">
          Notifications are blocked in this browser. Change its site permission to enable match alerts.
        </p>
      )}
    </div>
  );
}
