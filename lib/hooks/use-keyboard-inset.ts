"use client";

import { useEffect } from "react";

/**
 * Publishes the on-screen keyboard height as the `--kb-inset` custom property
 * on <html>, so fixed layers (dialogs, toasts) can keep clear of it.
 *
 * The viewport meta declares `interactive-widget=resizes-content`, which makes
 * Chrome on Android resize the layout viewport for the keyboard. iOS Safari
 * does not honour it — there the layout viewport keeps its full height while
 * the visual viewport shrinks — so this hook covers that gap by measuring the
 * difference directly.
 *
 * Usage: reference it once near the root, then style with
 * `calc(... - var(--kb-inset, 0px))`.
 */
export function useKeyboardInset() {
  useEffect(() => {
    const root = document.documentElement;
    const viewport = window.visualViewport;
    if (!viewport) {
      root.style.setProperty("--kb-inset", "0px");
      return;
    }

    let frame = 0;
    const update = () => {
      frame = 0;
      const occluded = Math.max(
        0,
        window.innerHeight - viewport.height - viewport.offsetTop
      );
      // Ignore the sub-pixel jitter browsers emit while the keyboard animates.
      const inset = occluded > 80 ? Math.round(occluded) : 0;
      root.style.setProperty("--kb-inset", `${inset}px`);
    };

    const schedule = () => {
      if (frame) return;
      frame = window.requestAnimationFrame(update);
    };

    update();
    viewport.addEventListener("resize", schedule);
    viewport.addEventListener("scroll", schedule);
    return () => {
      if (frame) window.cancelAnimationFrame(frame);
      viewport.removeEventListener("resize", schedule);
      viewport.removeEventListener("scroll", schedule);
      root.style.setProperty("--kb-inset", "0px");
    };
  }, []);
}
