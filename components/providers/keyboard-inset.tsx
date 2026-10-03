"use client";

import { useKeyboardInset } from "@/lib/hooks/use-keyboard-inset";

/**
 * Mounts the visual-viewport keyboard measurement for the whole app. Renders
 * nothing; it only keeps `--kb-inset` on <html> up to date.
 */
export function KeyboardInset() {
  useKeyboardInset();
  return null;
}
