/**
 * Haptics and the iOS click-sound fallback for the Match Logger.
 *
 * `haptic()` follows the guide §5 snippet: it is a no-op when the Vibration
 * API is missing (iOS Safari) or when the user has switched haptics off.
 * `feedback()` is what the UI calls on press — it adds the optional click
 * sound, which is the only feedback iOS can give and is off by default.
 *
 * Preferences live in localStorage under `ml.haptics` / `ml.click`.
 *
 * @module match-logger/haptics
 */

export type HapticKind = "tap" | "select" | "confirm" | "undo" | "error";

const PATTERNS: Record<HapticKind, number | number[]> = {
  tap: 10,
  select: 12,
  confirm: [20, 30, 60],
  undo: 15,
  error: [40, 60, 40],
};

export const HAPTICS_STORAGE_KEY = "ml.haptics";
export const CLICK_STORAGE_KEY = "ml.click";

function readPref(key: string, fallback: boolean): boolean {
  if (typeof localStorage === "undefined") return fallback;
  try {
    const value = localStorage.getItem(key);
    return value == null ? fallback : value !== "off";
  } catch {
    return fallback;
  }
}

function writePref(key: string, on: boolean): void {
  if (typeof localStorage === "undefined") return;
  try {
    localStorage.setItem(key, on ? "on" : "off");
  } catch {
    /* storage unavailable (private mode) — keep the in-memory default */
  }
}

type PrefListener = () => void;
const prefListeners = new Set<PrefListener>();

/** Subscribe to preference changes (for `useSyncExternalStore`). */
export function subscribePrefs(listener: PrefListener): () => void {
  prefListeners.add(listener);
  return () => {
    prefListeners.delete(listener);
  };
}

function emitPrefs(): void {
  for (const listener of prefListeners) listener();
}

/** Snapshot helpers for `useSyncExternalStore` (primitive/stable values). */
export function getHapticsSnapshot(): boolean {
  return isHapticsEnabled();
}

export function getClickSnapshot(): boolean {
  return isClickEnabled();
}

export function getCanVibrateSnapshot(): boolean {
  return supportsHaptics();
}

/** True when the device can actually vibrate (Android; false on iOS). */
export function supportsHaptics(): boolean {
  return typeof navigator !== "undefined" && "vibrate" in navigator;
}

export function isHapticsEnabled(): boolean {
  return readPref(HAPTICS_STORAGE_KEY, true);
}

export function setHapticsEnabled(on: boolean): void {
  writePref(HAPTICS_STORAGE_KEY, on);
  emitPrefs();
}

export function isClickEnabled(): boolean {
  return readPref(CLICK_STORAGE_KEY, false);
}

export function setClickEnabled(on: boolean): void {
  writePref(CLICK_STORAGE_KEY, on);
  emitPrefs();
}

/** Fire a vibration pattern, honouring the user's toggle. */
export function haptic(kind: HapticKind): void {
  if (typeof navigator === "undefined" || !("vibrate" in navigator)) return;
  if (!isHapticsEnabled()) return;
  try {
    navigator.vibrate(PATTERNS[kind]);
  } catch {
    /* some browsers throw when the page is not visible */
  }
}

let audioContext: AudioContext | null = null;

/** Short synthesized click, used as the iOS fallback feedback. */
export function playClick(): void {
  if (typeof window === "undefined") return;
  try {
    const Ctor =
      window.AudioContext ??
      (window as unknown as { webkitAudioContext?: typeof AudioContext })
        .webkitAudioContext;
    if (!Ctor) return;
    audioContext = audioContext ?? new Ctor();
    const ctx = audioContext;
    if (ctx.state === "suspended") void ctx.resume();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = "square";
    osc.frequency.value = 1200;
    const t = ctx.currentTime;
    gain.gain.setValueAtTime(0.04, t);
    gain.gain.exponentialRampToValueAtTime(0.0001, t + 0.03);
    osc.connect(gain).connect(ctx.destination);
    osc.start(t);
    osc.stop(t + 0.04);
  } catch {
    /* WebAudio unavailable — silently skip */
  }
}

/**
 * The single press-feedback entry point for the logger UI. Must be called from
 * within a user gesture (a press handler), matching the guide's §5 rule.
 */
export function feedback(kind: HapticKind = "tap"): void {
  haptic(kind);
  if (isClickEnabled()) playClick();
}
