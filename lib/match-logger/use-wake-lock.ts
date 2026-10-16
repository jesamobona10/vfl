"use client";

import { useEffect } from "react";

/**
 * Keeps the screen awake while `active` (guide §5).
 *
 * Browsers release the lock whenever the tab is hidden, so we re-acquire it on
 * `visibilitychange`. Not all browsers support the Wake Lock API (older iOS
 * Safari), in which case this is a no-op.
 */
export function useWakeLock(active: boolean): void {
  useEffect(() => {
    if (!active) return;
    if (typeof navigator === "undefined" || !("wakeLock" in navigator)) return;

    let lock: WakeLockSentinel | null = null;

    const acquire = async () => {
      try {
        lock = await navigator.wakeLock.request("screen");
      } catch {
        /* denied, unsupported, or the document is not visible */
      }
    };

    void acquire();
    const onVisibility = () => {
      if (document.visibilityState === "visible") void acquire();
    };
    document.addEventListener("visibilitychange", onVisibility);

    return () => {
      document.removeEventListener("visibilitychange", onVisibility);
      void lock?.release().catch(() => {});
      lock = null;
    };
  }, [active]);
}
